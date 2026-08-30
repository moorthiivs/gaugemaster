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
Your task is to analyze the provided calibration sheet (from an Image, Drawing, or Excel data) and generate a complete, production-ready Visual Canvas Template JSON.

CRITICAL: Return ONLY valid, pure JSON without any comments, markdown formatting, explanations, or code blocks.

The output JSON structure MUST match this exact schema:
{
  "name": "Template Name (e.g. Vernier Caliper IS 3651 or Plug Gauge ISO 1502)",
  "description": "Concise description of calibration features, jaws, or thread specs",
  "instrumentType": "Vernier Caliper",
  "defaultUnit": "mm",
  "defaultTolerance": 0.02,
  "decimalPlaces": 3,
  "acceptanceCriteria": {
    "enabled": true,
    "type": "absolute",
    "value": 0.02
  },
  "blocks": [
    {
      "id": "note_1",
      "type": "text_block",
      "content": "All measuring faces and jaws are verified free from dents, corrosion, and physical damage.",
      "style": "callout"
    },
    {
      "id": "table_1",
      "type": "table_grid",
      "title": "Calibration of External Jaws / Main Specification",
      "width": "100%",
      "unit": "mm",
      "tolerance": 0.02,
      "decimal_places": 3,
      "columns": [
        { "id": "point_number", "label": "Sl.No.", "type": "nominal", "width": "8%" },
        { "id": "nominal", "label": "Std. Spec", "type": "nominal", "width": "22%" },
        { "id": "reading", "label": "Actual Reading", "type": "reading", "width": "25%" },
        { "id": "error", "label": "Error", "type": "formula", "formula": "reading - nominal", "width": "25%" },
        { "id": "status", "label": "Judgement", "type": "status", "formula": "IF(ABS(error)<=tolerance,'PASS','FAIL')", "width": "20%" }
      ],
      "rows": [
        { "point_number": 1, "nominal": 10.0, "tolerance": 0.02, "unit": "mm" },
        { "point_number": 2, "nominal": 20.0, "tolerance": 0.02, "unit": "mm" }
      ],
      "footerNote": "Measured using calibrated length masters / slip gauges."
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
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-pro",
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
        // Prioritize: flash models (2.5-flash, 2.0-flash, 1.5-flash) > pro models > others
        const sorted = [...suitable].sort((a, b) => {
          const score = (n: string) => {
            const low = n.toLowerCase();
            if (low.includes("flash") && low.includes("2.5")) return 1;
            if (low.includes("flash") && low.includes("2.0")) return 2;
            if (low.includes("flash") && low.includes("1.5")) return 3;
            if (low.includes("flash")) return 4;
            if (low.includes("pro") && low.includes("2.5")) return 5;
            if (low.includes("pro") && low.includes("1.5")) return 6;
            if (low.includes("pro")) return 7;
            return 8;
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
    defaultTolerance: typeof parsed.defaultTolerance === "number" ? parsed.defaultTolerance : 0.01,
    decimalPlaces: typeof parsed.decimalPlaces === "number" ? parsed.decimalPlaces : 3,
    acceptanceCriteria: parsed.acceptanceCriteria,
    blocks: Array.isArray(parsed.blocks) && parsed.blocks.length > 0 ? parsed.blocks : [],
  };

  result.blocks = result.blocks.map((block, idx) => {
    const bId = block.id || `block_${Date.now()}_${idx}`;
    if (block.type === "table_grid") {
      const tbl = block as TableGridBlock;
      return {
        ...tbl,
        id: bId,
        decimal_places: tbl.decimal_places ?? result.decimalPlaces,
        unit: tbl.unit ?? result.defaultUnit,
        tolerance: tbl.tolerance ?? result.defaultTolerance,
        columns:
          tbl.columns?.map((c, cIdx) => ({
            ...c,
            id: c.id || `col_${cIdx}`,
            label: c.label || `Column ${cIdx + 1}`,
            type: c.type || "reading",
          })) || [],
        rows:
          tbl.rows?.map((r, rIdx) => ({
            ...r,
            point_number: r.point_number ?? rIdx + 1,
            nominal: typeof r.nominal === "number" ? r.nominal : 0,
          })) || [],
      };
    }
    return { ...block, id: bId };
  });

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
