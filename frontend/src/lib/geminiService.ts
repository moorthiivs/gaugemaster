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
Your task is to analyze the provided calibration document (PDF certificate, Word format, Excel sheet, or Image/Drawing) and generate a complete, high-precision, production-ready Visual Canvas Template JSON according to the schema.

CRITICAL EXTRACTION & FIDELITY RULES:
1. PURE JSON OUTPUT:
   - Return ONLY valid, pure JSON without any comments, markdown fences, explanations, or extraneous text.
2. EXTRACT ALL ORIGINAL CALIBRATION DATA TABLES VERBATIM:
   - Accurately identify the core calibration results tables (e.g. Section 10 "Results" or error test tables).
   - In accredited certificates, test results may cover multiple serial numbers / units (for example, 3 Current Transformers tested in one report: OC-3271/1/11/11, OC-3271/1/17/11, OC-3271/1/16/11). In this case, create a separate "table_grid" block for EACH unit / serial number, and include the Serial Number in the table title!
   - If the certificate tests a single instrument, extract its test table(s).
3. MULTI-DOMAIN SUPPORT (ELECTRICAL, PRESSURE, TEMPERATURE, METROLOGY, DIMENSIONAL):
   - Do NOT assume every template is a micrometer or caliper!
   - For electrical instruments (Current Transformers, Voltage Transformers, Energy Meters, Multimeters): Extract columns such as Set Burden, Load %, Ratio Error %, Allowed Limits %, Expanded Uncertainty %, Coverage Factor (k), Phase Error (Min), Allowed Limits (Min), etc.
   - For pressure/temperature/torque/dimensional: Extract test points, ascending/descending readings, hysteresis, error, and permissible limits.
4. EXACT COLUMN DEFINITIONS & DESCRIPTIVE IDs:
   - Extract ALL table columns verbatim from the document header.
   - Assign a clean, unique snake_case "id" to each column (e.g. "point_number", "set_burden", "load_percent", "ratio_error", "allowed_limits_ratio", "uncertainty_ratio", "coverage_factor_ratio", "phase_error", "allowed_limits_phase", "uncertainty_phase", "coverage_factor_phase").
   - Column types:
     * "nominal": for nominal test points, load %, target values, slip sizes, set points.
     * "reading": for observed readings, measured errors (ratio error, phase error), actual values.
     * "tolerance": for allowed limits, permissible tolerances, specification limits.
     * "text": for burden ratings ("100 % 10VA", "25 % 2.5VA"), reference standards, coverage factor labels, or non-numeric strings.
     * "trial": for repeat measurement trials ("t1", "t2", etc.).
     * "formula": for calculated error ("reading - nominal", "avg - nominal") or average ("AVERAGE(t1,t2,t3)").
     * "status": for Pass/Fail judgements.
5. STRICT ROW-TO-COLUMN BINDING (CRITICAL):
   - For EVERY row in "rows", create an object containing:
     * "point_number": 1, 2, 3...
     * A key matching EACH column's "id" with the EXACT numeric or string value from that row in the document!
     * DO NOT use placeholder zeroes or collapse rows into empty objects.
     * If the table has 10 rows, output all 10 rows with their complete data!
6. REFERENCE STANDARDS & METADATA:
   - If reference standards used (equipment, validity, traceability) are shown, extract them into a "table_grid" block with all rows containing the actual standard name, valid date, traceability, and parameter.
   - If environmental conditions (Temp, Humidity, Frequency) or general notes exist, include them in "footerNote" or as a "text_block".

OUTPUT JSON SCHEMA:
{
  "name": "Instrument / Test Name (e.g. 132kV Current Transformer Calibration)",
  "description": "Concise description of calibration procedure, standard (e.g. IS -2705 Part-II), and accuracy class",
  "instrumentType": "Identified Instrument Type (e.g. Current Transformer)",
  "defaultUnit": "Unit of measurement (e.g. %, mm, bar, °C, V, A)",
  "defaultTolerance": 0.2,
  "decimalPlaces": 3,
  "blocks": [
    {
      "id": "table_1",
      "type": "table_grid",
      "title": "Title from Document (e.g. Results: CT Sr. No. OC-3271/1/11/11)",
      "width": "100%",
      "unit": "%",
      "tolerance": 0.2,
      "decimal_places": 3,
      "columns": [
        { "id": "point_number", "label": "Sl.No.", "type": "nominal", "width": "6%" },
        { "id": "set_burden", "label": "Set Burden VA / %", "type": "text", "width": "12%" },
        { "id": "load_pct", "label": "Load %", "type": "nominal", "width": "9%" },
        { "id": "ratio_error", "label": "Ratio Error %", "type": "reading", "width": "10%" },
        { "id": "allowed_limits_ratio", "label": "Allowed Limits ± %", "type": "tolerance", "width": "10%" },
        { "id": "uncertainty_ratio", "label": "± Expanded Uncertainty %", "type": "text", "width": "11%" },
        { "id": "coverage_factor_ratio", "label": "Coverage Factor (k)", "type": "text", "width": "9%" },
        { "id": "phase_error", "label": "Phase Error (Min)", "type": "reading", "width": "10%" },
        { "id": "allowed_limits_phase", "label": "Allowed Limits ± (Min)", "type": "tolerance", "width": "11%" },
        { "id": "uncertainty_phase", "label": "± Expanded Uncertainty (Min)", "type": "text", "width": "12%" }
      ],
      "rows": [
        {
          "point_number": 1,
          "set_burden": "100 % 10VA",
          "load_pct": 120,
          "nominal": 120,
          "ratio_error": -0.05,
          "allowed_limits_ratio": 0.20,
          "uncertainty_ratio": "0.061",
          "coverage_factor_ratio": "2.00",
          "phase_error": 3.32,
          "allowed_limits_phase": 10.00,
          "uncertainty_phase": "2.63"
        }
      ],
      "footerNote": "Expanded uncertainty is based on combined uncertainty with coverage factor k=2 at 95% confidence level."
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
        // Prioritize: verified production multimodal models first, avoid unreleased 404s (e.g. 2.5) or overloaded alias endpoints
        const sorted = [...suitable].sort((a, b) => {
          const score = (n: string) => {
            const low = n.toLowerCase();
            if (low === "gemini-2.0-flash") return 1;
            if (low === "gemini-1.5-flash") return 2;
            if (low === "gemini-2.0-flash-001") return 3;
            if (low === "gemini-1.5-flash-002") return 4;
            if (low === "gemini-1.5-flash-001") return 5;
            if (low === "gemini-1.5-pro") return 6;
            if (low === "gemini-2.0-flash-lite") return 7;
            if (low.includes("flash") && low.includes("2.0") && !low.includes("latest")) return 8;
            if (low.includes("flash") && low.includes("1.5") && !low.includes("latest")) return 9;
            if (low.includes("flash") && !low.includes("latest") && !low.includes("2.5")) return 10;
            if (low.includes("latest")) return 30; // Deprioritize alias endpoints that frequently return 503
            if (low.includes("pro") && !low.includes("2.5")) return 40;
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
    let rows = (tbl.rows || []).map((r: any, rIdx: number) => {
      const rowObj: any = {
        point_number: rIdx + 1,
      };

      if (Array.isArray(r)) {
        // Array representation: map by column index
        cols.forEach((col, cIdx) => {
          if (r[cIdx] !== undefined) rowObj[col.id] = r[cIdx];
        });
        rowObj.point_number = typeof r[0] === "number" && cols[0]?.id === "point_number" ? r[0] : rIdx + 1;
      } else if (typeof r === "object" && r !== null) {
        // Object representation: preserve all keys
        Object.assign(rowObj, r);
        rowObj.point_number = r.point_number ?? r.sl_no ?? r.sino ?? rIdx + 1;

        // Build lowercase alphanumeric key map for flexible matching
        const rawKeys = Object.keys(r);
        const lowerKeyMap = new Map<string, string>();
        rawKeys.forEach((k) => lowerKeyMap.set(k.toLowerCase().replace(/[^a-z0-9]/g, ""), k));

        cols.forEach((col, cIdx) => {
          if (rowObj[col.id] !== undefined) return;

          // 1. Normalized label match (e.g. "Load %" -> "load")
          const normLabel = col.label.toLowerCase().replace(/[^a-z0-9]/g, "");
          const matchedKey = lowerKeyMap.get(normLabel);
          if (matchedKey && r[matchedKey] !== undefined) {
            rowObj[col.id] = r[matchedKey];
            return;
          }

          // 2. Index match ("col_0", "col_1")
          const idxKey = `col_${cIdx}`;
          if (r[idxKey] !== undefined) {
            rowObj[col.id] = r[idxKey];
            return;
          }

          // 3. Common property fallbacks
          if (col.id === "nominal" && r.nominal !== undefined) rowObj[col.id] = r.nominal;
          if (col.id === "description" && r.description !== undefined) rowObj[col.id] = r.description;
          if (col.id === "reading" && r.reading !== undefined) rowObj[col.id] = r.reading;
          if (col.id === "tolerance" && r.tolerance !== undefined) rowObj[col.id] = r.tolerance;
        });
      }

      if (isParallelism && (!rowObj.description || rowObj.description === "0" || typeof rowObj.description === "number")) {
        rowObj.description = `Corner ${rIdx + 1}`;
      }

      // Ensure nominal has a sensible numeric value if nominal column exists or any numeric column exists
      if (rowObj.nominal === undefined) {
        if (typeof rowObj.load_pct === "number") rowObj.nominal = rowObj.load_pct;
        else if (typeof rowObj.load === "number") rowObj.nominal = rowObj.load;
        else if (typeof rowObj.load_percent === "number") rowObj.nominal = rowObj.load_percent;
        else {
          const numEntry = Object.entries(rowObj).find(([k, v]) => k !== "point_number" && typeof v === "number");
          rowObj.nominal = numEntry ? (numEntry[1] as number) : 0;
        }
      }

      return rowObj;
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

/**
 * Generate Template from PDF Calibration Certificate / Document
 */
export async function generateTemplateFromPdf(
  pdfFile: File,
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

  const base64Data = await fileToBase64(pdfFile);

  const promptText = `
CRITICAL MULTI-PAGE CALIBRATION CERTIFICATE EXTRACTION TASK:
Please inspect this calibration certificate / test report PDF document and extract the complete, production-ready Visual Canvas Template JSON according to the schema.

STRICT ACCURACY RULES FOR THIS PDF CERTIFICATE:
1. FOCUS ON THE CORE CALIBRATION RESULTS TABLES:
   - Accurately identify the main calibration measurement test tables (e.g. Section 10 "Results" or error test tables).
   - In accredited certificates, test results may cover multiple serial numbers / units (for example, 3 Current Transformers tested in one report: OC-3271/1/11/11, OC-3271/1/17/11, OC-3271/1/16/11). In this case, create a separate "table_grid" block for EACH unit / serial number, and include the Serial Number in the table title!
   - If the certificate tests a single instrument, extract its test table(s).
2. VERBATIM COLUMN HEADERS & TYPE MAPPING:
   - Extract every column header from the table (e.g. "Set Burden VA / %", "Load %", "Ratio Error %", "Allowed Limits ± %", "± Expanded Uncertainty %", "Coverage Factor (k)", "Phase Error (Min)", "Allowed Limits ± (Min)", "± Expanded Uncertainty (Min)", "Coverage Factor (k)").
   - Give each column a clean, unique snake_case id (e.g. "set_burden", "load_pct", "ratio_error", "allowed_limits_ratio", "uncert_ratio", "coverage_factor_ratio", "phase_error", "allowed_limits_phase", "uncert_phase", "coverage_factor_phase").
   - Set column types:
     * "nominal" for test loads, nominal test points, set points.
     * "reading" for measured errors (ratio error, phase error), observed readings, actual values.
     * "tolerance" for allowed limits, permissible tolerances.
     * "text" for burden ratings ("100 % 10VA", "25 % 2.5VA"), reference standards, coverage factor labels, or non-numeric strings.
3. PRESERVE ALL ORIGINAL TABLE ROW DATA (DO NOT USE ZEROES OR PLACEHOLDERS):
   - For every single row in the calibration table, populate the row object with the real values from the document using the column IDs as keys!
   - Example row object:
     {
       "point_number": 1,
       "set_burden": "100 % 10VA",
       "load_pct": 120,
       "nominal": 120,
       "ratio_error": -0.05,
       "allowed_limits_ratio": 0.20,
       "uncert_ratio": "0.061",
       "coverage_factor_ratio": "2.00",
       "phase_error": 3.32,
       "allowed_limits_phase": 10.00,
       "uncert_phase": "2.63",
       "coverage_factor_phase": "2.00"
     }
   - Extract ALL rows across all test conditions (e.g. 100% VA and 25% VA). Do NOT truncate rows!
4. REFERENCE STANDARDS:
   - If reference standards used are included, extract them into a table_grid block with their exact names, serial numbers, calibration validity dates, and traceability.
5. INSTRUMENT DETAILS:
   - Set "name" to the instrument name (e.g. "132kV Current Transformer Calibration"), "instrumentType" (e.g. "Current Transformer"), "defaultUnit" ("%"), "defaultTolerance" (e.g. 0.2), and decimal places (e.g. 3).

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
              mime_type: "application/pdf",
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
 * Generate Template from Word Document (.docx / .doc extracted text and tables)
 */
export async function generateTemplateFromWord(
  wordContent: string,
  fileName: string,
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
Here is the text and table structure extracted from an uploaded calibration Word document (${fileName}):

--- WORD DOCUMENT CONTENT START ---
${wordContent}
--- WORD DOCUMENT CONTENT END ---

${userInstructions ? `Additional User Instructions: ${userInstructions}` : ""}

Analyze the calibration document, tables, measurement trials, nominal values, tolerances, units, and criteria, and convert them into the structured Visual Canvas Template JSON schema.
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

