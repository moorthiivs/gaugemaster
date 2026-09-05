import { CanvasBlock, TableGridBlock, MatrixTableBlock, TextBlock, SplitRowBlock } from "@/types/template";

export interface GeneratedTemplateResult {
  name: string;
  description: string;
  instrumentType: string;
  defaultUnit: string;
  defaultTolerance: number;
  decimalPlaces: number;
  acceptanceCriteria?: {
    enabled: boolean;
    type: "percentage" | "absolute";
    value: number;
  };
  blocks: CanvasBlock[];
}

const LOCAL_STORAGE_KEY = "GM_GEMINI_API_KEY";

export function getStoredGeminiApiKey(): string {
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local && local.trim()) return local.trim();
  const envKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (envKey && envKey !== "AIzaSyDummyKeyReplaceWithYourActualGeminiKey") {
    return envKey.trim();
  }
  return "";
}

export function saveStoredGeminiApiKey(key: string): void {
  if (!key || !key.trim()) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } else {
    localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
  }
}

const SYSTEM_PROMPT = `
You are an expert Metrology and Calibration Template Designer for ISO/IEC 17025 accredited laboratories.
Your task is to analyze the provided calibration sheet (from an Image, Drawing, or Excel data) and generate a complete, high-precision, production-ready Visual Canvas Template JSON.

CRITICAL INSTRUCTIONS & STRICT FIDELITY:
1. Return ONLY valid, pure JSON without any comments, markdown formatting, explanations, or code blocks.
2. STRICT FIDELITY - EXTRACT ONLY WHAT IS IN THE DOCUMENT:
   - Extract ONLY the tables, sections, and text notes that are ACTUALLY visible in the uploaded image or document.
   - NEVER invent, hallucinate, or add tables (such as Acceptance Criteria, Flatness of the anvils, Parallelism of anvils, etc.) if they do NOT exist in the uploaded sheet.
   - If the uploaded sheet contains ONLY ONE table (e.g. Instrumental Error of Depth Measurement, Caliper Jaws, or Test Points), output ONLY that single table!
   - Do NOT generate an Acceptance Criteria table unless an acceptance criteria or permissible error table is explicitly drawn or listed on the sheet.
3. SIDE-BY-SIDE TABLES:
   - ONLY when two or more tables are visibly placed horizontally side-by-side in the document (such as "Flatness of the anvils" and "Parallelism of anvils", or "Go / No-Go" dual inspection tables), place them inside a "split_row" block with "columnsCount": 2, "columnRatio": "50/50", and put each table inside "children".
   - If the document has only one table, or tables stacked vertically, do NOT use split_row.
4. ACCEPTANCE CRITERIA TABLES:
   - ONLY when the document explicitly displays an "Acceptance critiria", "Acceptance Criteria", "Permissible Error", or reference tolerance matrix table, generate it as a "matrix_table" block with its exact columns and rows.
   - If the document does NOT contain an acceptance criteria table, DO NOT generate any matrix_table!
5. MULTI-TRIAL READINGS & FORMULAS:
   - When a table has repeat measurement trial columns (e.g. "1", "2", "3", "4", "5"), define them as type "trial" with IDs "t1", "t2", "t3", "t4", "t5".
   - If there is an "Avg" column, use type "formula" with formula "AVERAGE(t1,t2,t3,t4,t5)".
   - For "Error", use type "formula" with formula "avg - nominal" (or "reading - nominal" for single reading).
   - For "Judgement" or "Judge.", use type "status" and formula "IF(ABS(error)<=tolerance,'PASS','FAIL')".
6. EXACT NUMERICAL ACCURACY:
   - Extract every nominal dimension (e.g. 0.00, 20.00, 50.00, 100.00, 130.00, 150.00, 200.00, 250.00, 300.00 or 127.510, etc.) exactly as written without truncation.
   - Detect decimal precision from the numbers (e.g. 2 decimals for 0.00, 3 decimals for 127.510).
7. FOOTER NOTES:
   - Preserve any notes below tables (e.g. expanded uncertainty notes, equipment used, or inspection conditions) in the table's "footerNote".

OUTPUT JSON SCHEMA:
{
  "name": "Instrument / Test Name from Document",
  "description": "Concise description of the calibration inspection extracted from the sheet",
  "instrumentType": "Identified Instrument Type",
  "defaultUnit": "mm",
  "defaultTolerance": 0.01,
  "decimalPlaces": 2,
  "blocks": [
    {
      "id": "table_1",
      "type": "table_grid",
      "title": "Title as written on the sheet",
      "width": "100%",
      "unit": "mm",
      "tolerance": 0.01,
      "decimal_places": 2,
      "columns": [
        { "id": "point_number", "label": "Sl.No.", "type": "nominal", "width": "10%" },
        { "id": "nominal", "label": "SLIP SIZE / Nominal", "type": "nominal", "width": "25%" },
        { "id": "reading", "label": "OBSERVED READING / Actual", "type": "reading", "width": "25%" },
        { "id": "error", "label": "ERROR", "type": "formula", "formula": "reading - nominal", "width": "20%" },
        { "id": "status", "label": "JUDGEMENT", "type": "status", "formula": "IF(ABS(error)<=tolerance,'PASS','FAIL')", "width": "20%" }
      ],
      "rows": [
        { "point_number": 1, "nominal": 0.0, "unit": "mm" },
        { "point_number": 2, "nominal": 20.0, "unit": "mm" }
      ],
      "footerNote": "EXPANDED UNCERTAINTY : ±13.0µm ( The uncertainty of measurement is expressed at 95.45% Confidence with coverage factor K-2)"
    }
  ]
}
`;

/**
 * Converts a File object to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Fallback static model list if dynamic discovery is unavailable
 */
const DEFAULT_CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-pro-exp-02-05",
];

/**
 * Dynamically queries available models from Gemini API and sorts multimodal models first.
 */
async function discoverUsableModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const rawModels: string[] = (data.models || [])
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => m.name.replace(/^models\//, ""));

      // Filter out TTS, pure image-gen, and embedding models
      const suitable = rawModels.filter((name: string) => {
        const lower = name.toLowerCase();
        return !lower.includes("-tts") && !lower.includes("-image") && !lower.includes("embedding") && !lower.includes("aqa");
      });

      if (suitable.length > 0) {
        // Prioritize: verified production multimodal models first, avoid unreleased 404s (e.g. 2.5)
        const sorted = [...suitable].sort((a, b) => {
          const score = (n: string) => {
            const low = n.toLowerCase();
            if (low === "gemini-2.0-flash") return 1;
            if (low === "gemini-1.5-flash") return 2;
            if (low === "gemini-1.5-pro") return 3;
            if (low === "gemini-2.0-flash-lite") return 4;
            if (low.includes("flash") && low.includes("2.0")) return 5;
            if (low.includes("flash") && low.includes("1.5")) return 6;
            if (low.includes("flash") && !low.includes("2.5")) return 7;
            if (low.includes("pro") && !low.includes("2.5")) return 8;
            return 99; // Demote experimental / unreleased models like 2.5
          };
          return score(a) - score(b);
        });
        return sorted;
      }
    }
  } catch (err) {
    console.warn("Dynamic model discovery failed, using fallback list", err);
  }
  return DEFAULT_CANDIDATE_MODELS;
}

/**
 * Sanitizes and safely parses LLM JSON response with comment stripping and trailing comma fixes
 */
function cleanAndParseJson(text: string): GeneratedTemplateResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "");
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Strip single-line JS comments (// ...) and multi-line comments (/* ... */)
  cleaned = cleaned.replace(/\/\/.*$/gm, "");
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    console.error("Initial JSON parse failed, attempting fallback regex parsing:", cleaned.substring(0, 200));
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0].replace(/,\s*([}\]])/g, "$1"));
    } else {
      throw new Error(`Invalid JSON returned from AI model: ${err.message}`);
    }
  }

  const result: GeneratedTemplateResult = {
    name: parsed.name || "AI Generated Template",
    description: parsed.description || "Auto-generated from uploaded document",
    instrumentType: parsed.instrumentType || "Standard Instrument",
    defaultUnit: parsed.defaultUnit || "mm",
    defaultTolerance: typeof parsed.defaultTolerance === "number" ? parsed.defaultTolerance : 0.005,
    decimalPlaces: typeof parsed.decimalPlaces === "number" ? parsed.decimalPlaces : 3,
    acceptanceCriteria: parsed.acceptanceCriteria,
    blocks: Array.isArray(parsed.blocks) && parsed.blocks.length > 0 ? parsed.blocks : [],
  };

  // Helper to sanitize table_grid block
  const sanitizeTableGrid = (tbl: TableGridBlock, fallbackId: string): TableGridBlock => {
    // Normalise columns
    let cols = (tbl.columns || []).map((c, cIdx) => {
      let colType = c.type;
      let label = c.label || `Column ${cIdx + 1}`;
      let colId = c.id || `col_${cIdx}`;

      // Recognize trial columns "1", "2", "3", "4", "5"
      if (/^[1-5]$/.test(label.trim())) {
        colType = "trial";
        colId = `t${label.trim()}`;
      } else if (label.toLowerCase() === "avg" || label.toLowerCase() === "average") {
        colType = "formula";
        colId = "avg";
      } else if (label.toLowerCase() === "error") {
        colType = "formula";
        colId = "error";
      } else if (label.toLowerCase().includes("judge") || label.toLowerCase() === "status") {
        colType = "status";
        colId = "status";
      }

      return {
        ...c,
        id: colId,
        label,
        type: colType || (c.formula ? "formula" : "reading"),
      };
    });

    // Check if table has trials t1..t5 and ensure formula for avg and error
    const hasTrials = cols.some((c) => c.type === "trial");
    if (hasTrials) {
      const trialIds = cols.filter((c) => c.type === "trial").map((c) => c.id);
      cols = cols.map((c) => {
        if (c.id === "avg" || c.label.toLowerCase() === "avg") {
          return {
            ...c,
            type: "formula",
            formula: c.formula || `AVERAGE(${trialIds.join(",")})`,
          };
        }
        if (c.id === "error" || c.label.toLowerCase() === "error") {
          return {
            ...c,
            type: "formula",
            formula: c.formula || "avg - nominal",
          };
        }
        if (c.id === "status" || c.type === "status") {
          return {
            ...c,
            type: "status",
            formula: c.formula || `IF(ABS(error)<=${tbl.tolerance ?? result.defaultTolerance},'PASS','FAIL')`,
          };
        }
        return c;
      });
    }

    // Check for Parallelism table and ensure Corner descriptions
    const isParallelism = (tbl.title || "").toLowerCase().includes("parallelism");
    let rows = (tbl.rows || []).map((r, rIdx) => {
      let desc = r.description;
      if (isParallelism && (!desc || desc === "0" || desc === "0.0" || typeof desc === "number")) {
        desc = `Corner ${rIdx + 1}`;
      }
      return {
        ...r,
        point_number: r.point_number ?? rIdx + 1,
        nominal: typeof r.nominal === "number" ? r.nominal : 0,
        description: desc,
      };
    });

    // If Parallelism table has 4 rows, ensure position column exists
    if (isParallelism && !cols.some((c) => c.id === "description")) {
      cols.unshift({
        id: "description",
        label: "Position",
        type: "text",
        width: "28%",
      });
    }

    let footerNote = tbl.footerNote;
    if (isParallelism && !footerNote) {
      footerNote = "Measuring anvil should be free from dent and damages.";
    }

    return {
      ...tbl,
      id: tbl.id || fallbackId,
      type: "table_grid",
      orientation: tbl.orientation || "auto",
      decimal_places: tbl.decimal_places ?? result.decimalPlaces,
      unit: tbl.unit ?? result.defaultUnit,
      tolerance: tbl.tolerance ?? result.defaultTolerance,
      columns: cols,
      rows,
      footerNote,
    };
  };

  // Helper to sanitize matrix_table block
  const sanitizeMatrixTable = (mt: MatrixTableBlock, fallbackId: string): MatrixTableBlock => {
    const rawHeaders = Array.isArray(mt.headers) ? mt.headers : [];
    const headers = rawHeaders.length > 0
      ? rawHeaders.map((hRow) =>
          Array.isArray(hRow)
            ? hRow.map((cell: any) =>
                typeof cell === "string" ? { text: cell } : { text: cell?.text || String(cell || "") }
              )
            : [{ text: "Sl.No." }, { text: "Actual mesured" }, { text: "Error" }]
        )
      : [
          [
            { text: "Sl.No." },
            { text: "Actual mesured" },
            { text: "Error" },
          ],
        ];

    const rawRows = Array.isArray(mt.rows) ? mt.rows : [];
    const rows: string[][] = rawRows.map((r: any) => {
      if (Array.isArray(r)) {
        return r.map((cell: any) =>
          cell !== null && typeof cell === "object" ? cell.text || JSON.stringify(cell) : String(cell ?? "")
        );
      } else if (r && typeof r === "object") {
        return Object.values(r).map((cell: any) =>
          cell !== null && typeof cell === "object" ? cell.text || JSON.stringify(cell) : String(cell ?? "")
        );
      } else {
        return [String(r ?? "")];
      }
    });

    return {
      ...mt,
      id: mt.id || fallbackId,
      type: "matrix_table",
      title: mt.title || "Acceptance critiria",
      headers,
      rows,
    };
  };

  // Process and sanitize all raw blocks
  let processedBlocks: CanvasBlock[] = result.blocks.map((block: any, idx) => {
    const bId = block.id || `block_${Date.now()}_${idx}`;

    if (block.type === "table_grid") {
      return sanitizeTableGrid(block as TableGridBlock, bId);
    }

    if (block.type === "split_row") {
      const split = block as SplitRowBlock;
      return {
        ...split,
        id: bId,
        type: "split_row",
        columnsCount: split.columnsCount || 2,
        columnRatio: split.columnRatio || "50/50",
        children: (split.children || []).map((child: any, cIdx) => {
          const cId = child.id || `${bId}_child_${cIdx}`;
          if (child.type === "table_grid") {
            return sanitizeTableGrid(child as TableGridBlock, cId);
          }
          if (child.type === "matrix_table") {
            return sanitizeMatrixTable(child as MatrixTableBlock, cId);
          }
          return { ...child, id: cId };
        }),
      };
    }

    if (block.type === "matrix_table") {
      return sanitizeMatrixTable(block as MatrixTableBlock, bId);
    }

    return { ...block, id: bId };
  });

  // Heuristic A: Auto-bundle consecutive side-by-side tables (e.g. Flatness & Parallelism) into a split_row
  const consolidatedBlocks: CanvasBlock[] = [];
  for (let i = 0; i < processedBlocks.length; i++) {
    const current = processedBlocks[i];
    const next = processedBlocks[i + 1];

    if (
      current.type === "table_grid" &&
      next &&
      next.type === "table_grid"
    ) {
      const title1 = (current as TableGridBlock).title?.toLowerCase() || "";
      const title2 = (next as TableGridBlock).title?.toLowerCase() || "";

      const isFlatnessAndParallel =
        (title1.includes("flatness") && title2.includes("parallel")) ||
        (title1.includes("parallel") && title2.includes("flatness"));

      const isBothHalfWidth =
        (current as TableGridBlock).width === "50%" && (next as TableGridBlock).width === "50%";

      if (isFlatnessAndParallel || isBothHalfWidth) {
        consolidatedBlocks.push({
          id: `split_row_${Date.now()}_${i}`,
          type: "split_row",
          columnsCount: 2,
          columnRatio: "50/50",
          children: [
            { ...(current as TableGridBlock), width: "50%" },
            { ...(next as TableGridBlock), width: "50%" },
          ],
        });
        i++; // Skip the next block since it was bundled
        continue;
      }
    }

    consolidatedBlocks.push(current);
  }
  result.blocks = consolidatedBlocks;
  return result;
}

/**
 * Execute Gemini generateContent with auto-discovered model list.
 */
async function executeGeminiRequest(
  apiKey: string,
  requestBody: any
): Promise<string> {
  const models = await discoverUsableModels(apiKey);
  let lastError = "Failed to connect to Google Gemini API";

  for (const modelName of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const responseData = await response.json();
        const textOutput = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput && textOutput.trim()) {
          console.log(`Gemini: Successfully generated template using model "${modelName}"`);
          return textOutput;
        }
        lastError = `Model ${modelName} returned an empty response.`;
      } else {
        const errText = await response.text();
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error?.message) {
            lastError = errJson.error.message;
          }
        } catch {
          lastError = `Model ${modelName} error (${response.status}): ${response.statusText}`;
        }

        // If rate limited (429)
        if (response.status === 429) {
          lastError = "Google Gemini Free Tier Rate Limit reached (429). Please wait a few moments and try again.";
        }

        // If key is invalid (401 / 403), stop immediately and notify user
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `Gemini API Key Authentication failed (${response.status}). ` +
            "Please check your API key at https://aistudio.google.com/apikey"
          );
        }
      }
    } catch (err: any) {
      if (err.message?.includes("Authentication") || err.message?.includes("Rate Limit")) throw err;
      lastError = err.message || "Network error while connecting to Gemini API";
    }
  }

  throw new Error(lastError);
}

/**
 * Generate Template from Image (Scanned Drawing, Photo, Certificate)
 */
export async function generateTemplateFromImage(
  imageFile: File,
  userInstructions?: string,
  apiKeyOverride?: string
): Promise<GeneratedTemplateResult> {
  const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Google Gemini API Key is missing.\n\n" +
      "Get a free key from https://aistudio.google.com/apikey\n" +
      "Then enter it in the API Key field above."
    );
  }

  const base64Data = await fileToBase64(imageFile);
  const mimeType = imageFile.type || "image/png";

  const promptText = `
Please inspect this calibration standard / drawing / test sheet image and generate a structured Visual Canvas Template.
${userInstructions ? `Additional User Instructions: ${userInstructions}` : ""}
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1,
    },
  };

  const textOutput = await executeGeminiRequest(apiKey, requestBody);
  return cleanAndParseJson(textOutput);
}

/**
 * Generate Template from Excel Data (Parsed rows / text / CSV)
 */
export async function generateTemplateFromExcel(
  excelContent: string,
  userInstructions?: string,
  apiKeyOverride?: string
): Promise<GeneratedTemplateResult> {
  const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Google Gemini API Key is missing.\n\n" +
      "Get a free key from https://aistudio.google.com/apikey\n" +
      "Then enter it in the API Key field above."
    );
  }

  const promptText = `
Here is the raw extracted tabular content from an uploaded calibration Excel workbook / sheet:

--- EXCEL CONTENT START ---
${excelContent}
--- EXCEL CONTENT END ---

${userInstructions ? `Additional User Instructions: ${userInstructions}` : ""}

Analyze the table columns, nominal test points, tolerances, units, formulas, and criteria, and convert them into the structured Visual Canvas Template JSON schema.
`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: SYSTEM_PROMPT }, { text: promptText }],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1,
    },
  };

  const textOutput = await executeGeminiRequest(apiKey, requestBody);
  return cleanAndParseJson(textOutput);
}
