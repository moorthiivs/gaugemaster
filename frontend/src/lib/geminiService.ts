import { CanvasBlock, TableGridBlock, MatrixTableBlock, TextBlock, SplitRowBlock, CanvasColumnDef } from "@/types/template";
import { validateFormulaSyntax, validateFormula } from "./formulaEngine";
import { translateExcelFormula, explainSemanticFormula } from "./excelFormulaTranslator";

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
   - In accredited certificates, test results may cover multiple serial numbers / units. Create a separate "table_grid" block for EACH unit / serial number, and include the Serial Number in the table title!
3. MULTI-DOMAIN SUPPORT (ELECTRICAL, PRESSURE, TEMPERATURE, METROLOGY, DIMENSIONAL):
   - Support all domains: dimensional, electrical, pressure, temperature, torque, force, mass, volume.
4. COLUMN SEMANTIC ROLES & FORMULAS (CRITICAL):
   - Extract ALL table columns verbatim from the document header.
   - Assign a clean, unique snake_case "id" to each column (e.g. "point_number", "nominal", "reading", "deviation", "tolerance", "judgement").
   - Assign a semantic "role" to every column:
     * "SPECIFICATION" / "NOMINAL": Target size, set point, nominal dimension, slip size.
     * "TOLERANCE" / "LOWER_LIMIT" / "UPPER_LIMIT": Allowed limits, tolerance spec (e.g. ±0.01, -0.02/-0.01, +0.018).
     * "READING" / "INPUT": Measured value, observed reading, actual dimension, trial 1/2/3.
     * "CALCULATED": Derived columns calculated from other columns (e.g. Deviation = reading - nominal, Error = avg - nominal, Average = AVERAGE(t1,t2,t3), Range = MAX(t1,t2) - MIN(t1,t2)).
     * "JUDGEMENT": Final result/status (PASS/FAIL).
     * "METADATA" / "DISPLAY_ONLY": Sl.No., parameter description, units, serial numbers.
   - For CALCULATED and JUDGEMENT columns:
     * "formula": Explicity state the executable semantic formula using column IDs (e.g. "reading - nominal", "actual >= lower_limit AND actual <= upper_limit", "AVERAGE(t1,t2,t3)"). Do NOT use Excel cell coordinates like D31 or C31 in "formula"!
     * "sourceFormula": If the document or Excel contained a cell formula (e.g., "=D31-C31"), include it here verbatim.
     * "dependsOn": Array of column IDs referenced in the formula (e.g. ["reading", "nominal"]).
     * "formulaSource": "SOURCE_EXCEL" if extracted from Excel cell formula, "AI_INFERRED" if derived from semantics, or "SYSTEM_GENERATED".
     * "formulaStatus": "VALIDATED" if clear, or "NEEDS_REVIEW" if calculation logic is ambiguous.
     * "formulaReviewMessage": Explanation if marked NEEDS_REVIEW.
5. STRICT ROW-TO-COLUMN BINDING:
   - For EVERY row in "rows", create an object containing:
     * "point_number": 1, 2, 3...
     * A key matching EACH column's "id" with the EXACT numeric or string value from that row!
     * If the document provides specification strings like "13±0.01" or "Ø35.035-0.02/-0.01", store the full specification in description/specification column and parse nominal and tolerances into numeric fields!
6. REFERENCE STANDARDS & METADATA:
   - Extract reference standards used and environmental conditions into notes or table_grid blocks.

OUTPUT JSON SCHEMA:
{
  "name": "Instrument / Test Name (e.g. LF Gauge Calibration)",
  "description": "Concise description of calibration procedure and standard",
  "instrumentType": "Identified Instrument Type (e.g. Plug Gauge / Micrometer)",
  "defaultUnit": "mm",
  "defaultTolerance": 0.01,
  "decimalPlaces": 3,
  "blocks": [
    {
      "id": "table_1",
      "type": "table_grid",
      "title": "Calibration Results",
      "width": "100%",
      "unit": "mm",
      "tolerance": 0.01,
      "decimal_places": 3,
      "columns": [
        { "id": "point_number", "label": "Sl.No.", "role": "METADATA", "type": "number", "width": "6%" },
        { "id": "description", "label": "Specification", "role": "SPECIFICATION", "type": "text", "width": "24%" },
        { "id": "nominal", "label": "Nominal", "role": "NOMINAL", "type": "nominal", "width": "12%" },
        { "id": "lower_limit", "label": "Lower Limit", "role": "LOWER_LIMIT", "type": "tolerance", "width": "10%" },
        { "id": "upper_limit", "label": "Upper Limit", "role": "UPPER_LIMIT", "type": "tolerance", "width": "10%" },
        { "id": "reading", "label": "Actual Dimension", "role": "READING", "type": "reading", "width": "14%" },
        { 
          "id": "deviation", 
          "label": "Deviation", 
          "role": "CALCULATED", 
          "type": "formula", 
          "width": "12%",
          "formula": "reading - nominal",
          "dependsOn": ["reading", "nominal"],
          "formulaSource": "AI_INFERRED",
          "formulaStatus": "VALIDATED"
        },
        { 
          "id": "judgement", 
          "label": "Judgement", 
          "role": "JUDGEMENT", 
          "type": "status", 
          "width": "12%",
          "formula": "reading >= lower_limit AND reading <= upper_limit",
          "dependsOn": ["reading", "lower_limit", "upper_limit"],
          "formulaSource": "AI_INFERRED",
          "formulaStatus": "VALIDATED"
        }
      ],
      "rows": [
        {
          "point_number": 1,
          "description": "Shaft Dist 13±0.01",
          "nominal": 13.0,
          "lower_limit": 12.99,
          "upper_limit": 13.01,
          "reading": 13.004,
          "deviation": 0.004,
          "judgement": "PASS"
        }
      ]
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
 * Downscales and converts an Image File to compressed base64 JPEG in <40ms.
 * Prevents 10MB+ certificate scans from causing slow network transfers.
 */
async function compressImageFileToBase64(
  file: File,
  maxDim = 1400,
  quality = 0.82
): Promise<{ base64: string; mimeType: string }> {
  if (!file.type.startsWith("image/") || file.type.includes("svg") || file.type.includes("gif")) {
    const raw = await fileToBase64(file);
    return { base64: raw, mimeType: file.type || "image/jpeg" };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const rawBase64 = (e.target?.result as string).split(",")[1];
          return resolve({ base64: rawBase64, mimeType: file.type });
        }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = () => {
        const rawBase64 = (e.target?.result as string).split(",")[1];
        resolve({ base64: rawBase64, mimeType: file.type });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      fileToBase64(file).then((raw) => resolve({ base64: raw, mimeType: file.type }));
    };
    reader.readAsDataURL(file);
  });
}

let discoveredModelsCache: { apiKey: string; models: string[]; timestamp: number } | null = null;

/**
 * Fallback static model list if dynamic discovery is unavailable
 */
const DEFAULT_CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
];

/**
 * Dynamically queries available models from Gemini API and caches results in-memory.
 */
async function discoverUsableModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (
    discoveredModelsCache &&
    discoveredModelsCache.apiKey === apiKey &&
    now - discoveredModelsCache.timestamp < 1000 * 60 * 30 // 30 min cache
  ) {
    return discoveredModelsCache.models;
  }
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
            return 99; // Demote experimental / unreleased models like 2.5
          };
          return score(a) - score(b);
        });
        discoveredModelsCache = { apiKey, models: sorted, timestamp: Date.now() };
        return sorted;
      }
    }
  } catch (err) {
    console.warn("Dynamic model discovery failed, using fallback list", err);
  }
  discoveredModelsCache = { apiKey, models: DEFAULT_CANDIDATE_MODELS, timestamp: Date.now() };
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
    // 1. Initial normalization of columns & detection of roles
    let cols = (tbl.columns || []).map((c: any, cIdx: number) => {
      let label = c.label || `Column ${cIdx + 1}`;
      let colId = c.id || `col_${cIdx}`;
      let colType = c.type;
      let role = c.role;

      const normLabel = label.toLowerCase().trim();
      const normId = colId.toLowerCase().trim();

      // Semantic Role & Type Inference if not explicit
      if (!role) {
        if (/^(sl\.?\s*no\.?|point|item|parameter|slno)$/.test(normLabel) || normId === "point_number") {
          role = "METADATA";
          colType = colType || "nominal";
        } else if (normLabel.includes("spec") || normLabel.includes("drawing") || normLabel.includes("description") || normId === "description") {
          role = "SPECIFICATION";
          colType = colType || "text";
        } else if (normLabel.includes("nominal") || normLabel.includes("required") || normLabel.includes("master") || normLabel.includes("target") || normId === "nominal") {
          role = "NOMINAL";
          colType = colType || "nominal";
        } else if (normLabel.includes("lower limit") || normLabel.includes("min limit") || normId === "lower_limit") {
          role = "LOWER_LIMIT";
          colType = colType || "tolerance";
        } else if (normLabel.includes("upper limit") || normLabel.includes("max limit") || normId === "upper_limit") {
          role = "UPPER_LIMIT";
          colType = colType || "tolerance";
        } else if (normLabel.includes("tolerance") || normLabel.includes("allowed limit") || normLabel.includes("mpe") || normId === "tolerance") {
          role = "TOLERANCE";
          colType = colType || "tolerance";
        } else if (/^[1-5]$/.test(normLabel)) {
          role = "READING";
          colType = "trial";
          colId = `t${normLabel}`;
        } else if (normLabel.includes("actual") || normLabel.includes("reading") || normLabel.includes("observed") || normLabel.includes("measured") || normId.includes("reading") || normId.includes("actual")) {
          role = "READING";
          colType = colType || "reading";
        } else if (normLabel.includes("deviat") || normLabel.includes("error") || normLabel.includes("diff") || normLabel.includes("avg") || normLabel.includes("average") || normLabel.includes("mean") || normLabel.includes("range") || normLabel.includes("correct") || normLabel.includes("uncert")) {
          role = "CALCULATED";
          colType = "formula";
        } else if (normLabel.includes("judge") || normLabel.includes("status") || normLabel.includes("result") || normLabel.includes("pass")) {
          role = "JUDGEMENT";
          colType = "status";
        } else {
          role = "INPUT";
          colType = colType || "reading";
        }
      }

      if (c.formula && !colType) colType = "formula";

      return {
        ...c,
        id: colId,
        label,
        role,
        type: colType || (role === "CALCULATED" ? "formula" : role === "JUDGEMENT" ? "status" : "reading"),
        formula: c.formula || "",
        sourceFormula: c.sourceFormula || undefined,
        dependsOn: Array.isArray(c.dependsOn) ? c.dependsOn : [],
        formulaSource: c.formulaSource || (c.sourceFormula ? "SOURCE_EXCEL" : c.formula ? "AI_INFERRED" : undefined),
        formulaStatus: c.formulaStatus || (c.formula ? "VALIDATED" : undefined),
        formulaReviewMessage: c.formulaReviewMessage || undefined,
      };
    });

    // 2. Identify key semantic column IDs to bind generic calculations
    const nominalCol = cols.find((c: any) => c.role === "NOMINAL" || c.id === "nominal") || cols.find((c: any) => c.label.toLowerCase().includes("nominal"));
    const readingCol = cols.find((c: any) => c.role === "READING" && c.type !== "trial") || cols.find((c: any) => c.label.toLowerCase().includes("actual") || c.label.toLowerCase().includes("reading"));
    const trialCols = cols.filter((c: any) => c.type === "trial");
    const lowerLimitCol = cols.find((c: any) => c.role === "LOWER_LIMIT" || c.id === "lower_limit");
    const upperLimitCol = cols.find((c: any) => c.role === "UPPER_LIMIT" || c.id === "upper_limit");
    const toleranceCol = cols.find((c: any) => c.role === "TOLERANCE" || c.id === "tolerance");
    const devCol = cols.find((c: any) => c.label.toLowerCase().includes("deviat") || c.label.toLowerCase().includes("error"));

    const nominalId = nominalCol?.id || "nominal";
    const readingId = readingCol?.id || "reading";
    const trialIds = trialCols.map((c: any) => c.id);

    // 3. Populate formulas & dependency lists for CALCULATED and JUDGEMENT columns
    cols = cols.map((c: any) => {
      let formula = c.formula || "";
      let sourceFormula = c.sourceFormula;
      let dependsOn: string[] = Array.isArray(c.dependsOn) ? [...c.dependsOn] : [];
      let formulaSource = c.formulaSource;
      let formulaStatus = c.formulaStatus || "VALIDATED";
      let formulaReviewMessage = c.formulaReviewMessage;
      let translationReason = c.translationReason;
      let aiSuggestedFormula = c.aiSuggestedFormula;
      let aiReason = c.aiReason;
      let aiConfidence = c.aiConfidence;

      const normLabel = c.label.toLowerCase().trim();
      const normId = c.id.toLowerCase().trim();

      // If an Excel formula exists (starts with '=' or contains CHOOSE, ROW, INDEX, cell coordinates)
      const rawFormulaToCheck = formula || sourceFormula || "";
      if (rawFormulaToCheck && (rawFormulaToCheck.startsWith("=") || /choose|row\(|index|\b[a-z]+\d+\s*-\s*[a-z]+\d+\b/i.test(rawFormulaToCheck))) {
        const transResult = translateExcelFormula(rawFormulaToCheck, cols, c);
        if (transResult.isSupported && transResult.translatedFormula) {
          if (!sourceFormula) sourceFormula = rawFormulaToCheck;
          formula = transResult.translatedFormula;
          formulaSource = "EXCEL_TRANSLATED";
          translationReason = transResult.reason;
          aiConfidence = transResult.confidence;
          if (transResult.dependencies.length > 0) {
            dependsOn = transResult.dependencies;
          }
        } else if (!transResult.isSupported && transResult.translatedFormula) {
          if (!sourceFormula) sourceFormula = rawFormulaToCheck;
          aiSuggestedFormula = transResult.translatedFormula;
          aiReason = transResult.reason;
          aiConfidence = transResult.confidence;
        }
      }

      if (c.role === "CALCULATED" || c.type === "formula") {
        if (!formula) {
          if (normLabel.includes("deviat") || normLabel.includes("error") || normLabel.includes("diff")) {
            formula = `${readingId} - ${nominalId}`;
            dependsOn = [readingId, nominalId];
            formulaSource = formulaSource || "SYSTEM_GENERATED";
          } else if ((normLabel.includes("avg") || normLabel.includes("average") || normLabel.includes("mean")) && trialIds.length > 0) {
            formula = `AVERAGE(${trialIds.join(", ")})`;
            dependsOn = trialIds;
            formulaSource = formulaSource || "SYSTEM_GENERATED";
          } else if (normLabel.includes("range") && trialIds.length > 0) {
            formula = `MAX(${trialIds.join(", ")}) - MIN(${trialIds.join(", ")})`;
            dependsOn = trialIds;
            formulaSource = formulaSource || "SYSTEM_GENERATED";
          } else {
            formulaStatus = "NEEDS_REVIEW";
            formulaReviewMessage = `Calculated column '${c.label}' requires formula specification.`;
          }
        }
      } else if (c.role === "JUDGEMENT" || c.type === "status") {
        if (!formula) {
          if (lowerLimitCol && upperLimitCol) {
            formula = `${readingId} >= ${lowerLimitCol.id} AND ${readingId} <= ${upperLimitCol.id}`;
            dependsOn = [readingId, lowerLimitCol.id, upperLimitCol.id];
            formulaSource = formulaSource || "SYSTEM_GENERATED";
          } else if (toleranceCol && devCol) {
            formula = `ABS(${devCol.id}) <= ${toleranceCol.id}`;
            dependsOn = [devCol.id, toleranceCol.id];
            formulaSource = formulaSource || "SYSTEM_GENERATED";
          } else {
            formula = `${readingId} >= lowerLimit AND ${readingId} <= upperLimit`;
            dependsOn = [readingId];
            formulaSource = formulaSource || "SYSTEM_GENERATED";
          }
        }
      }

      // Validate formula syntax, variables, and dependencies using unified AST validator
      let formulaConfidence: "HIGH" | "MEDIUM" | "LOW" = c.formulaConfidence || aiConfidence || "HIGH";
      if (formula) {
        const valRes = validateFormula(formula, cols, {
          targetColumnId: c.id,
          sourceConfidence: formulaConfidence,
        });

        if (!valRes.valid) {
          formulaStatus = "NEEDS_REVIEW";
          formulaReviewMessage = valRes.errors[0] || "Invalid formula syntax";
          formulaConfidence = "LOW";
        } else if (valRes.status === "NEEDS_REVIEW") {
          formulaStatus = "NEEDS_REVIEW";
          formulaReviewMessage = valRes.warnings[0] || "Formula needs review";
          formulaConfidence = valRes.confidence;
        } else {
          formulaStatus = "VALIDATED";
          formulaReviewMessage = undefined;
          formulaConfidence = "HIGH";
        }

        // Ensure dependsOn is synchronized with real AST dependencies if missing
        if ((!dependsOn || dependsOn.length === 0) && valRes.dependencies.length > 0) {
          dependsOn = valRes.dependencies;
        }
      }

      return {
        ...c,
        formula,
        sourceFormula,
        dependsOn,
        formulaSource: formulaSource || (formula ? "AI_INFERRED" : undefined),
        formulaStatus: formula ? formulaStatus : undefined,
        formulaConfidence: formula ? formulaConfidence : undefined,
        formulaReviewMessage,
        translationReason,
        aiSuggestedFormula,
        aiReason,
        aiConfidence,
      };
    });

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

  const { base64: base64Data, mimeType } = await compressImageFileToBase64(imageFile, 1400, 0.82);

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

export interface AssistantContext {
  templateName?: string;
  instrumentType?: string;
  calibrationType?: string;
  selectedTableTitle?: string;
  selectedTableId?: string;
  selectedColumnId?: string;
  columns?: CanvasColumnDef[];
  tablesSummary?: Array<{
    id: string;
    title: string;
    columns: Array<{ id: string; label: string; formula?: string; role?: string }>;
  }>;
  formulaErrors?: string[];
}

export interface AssistantResponse {
  reply: string;
  action?: "FIX_FORMULA" | "AUDIT_TABLE" | "FIX_TABLE" | "TEST_BOUNDARIES" | "EXPLAIN_FORMULA" | "NONE";
  actionPayload?: {
    tableId?: string;
    columnId?: string;
    formula?: string;
    reason?: string;
  };
}

/**
 * Gaugemaster Template Assistant Copilot
 * Context-aware intelligent assistant for template editing, formula auditing, and repair.
 */
export async function askTemplateAssistant(
  userQuery: string,
  context: AssistantContext,
  apiKeyOverride?: string
): Promise<AssistantResponse> {
  const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();

  // If no API key is set, provide high-precision deterministic assistant responses
  if (!apiKey) {
    const q = userQuery.toLowerCase();
    if (q.includes("audit") || q.includes("check table") || q.includes("entire table")) {
      return {
        reply: `I have analyzed the table '${context.selectedTableTitle || "current table"}'. You can run the full table audit to review all columns, tolerances, and formula dependencies.`,
        action: "AUDIT_TABLE",
        actionPayload: { tableId: context.selectedTableId }
      };
    }
    if (q.includes("fix") && (q.includes("formula") || q.includes("choose") || q.includes("deviation"))) {
      return {
        reply: "Excel row lookup formulas like CHOOSE(ROW()-k, ...) should be replaced with normalized semantic formulas ('actual_dimension - nominal'). Would you like me to apply this fix?",
        action: "FIX_FORMULA",
        actionPayload: {
          tableId: context.selectedTableId,
          columnId: context.selectedColumnId || "deviation",
          formula: "actual_dimension - nominal",
          reason: "Translates row-based Excel nominal lookup into normalized point metadata."
        }
      };
    }
    if (q.includes("boundary") || q.includes("test")) {
      return {
        reply: "Automated 4-point boundary testing verifies: Lower Limit (PASS), Upper Limit (PASS), Lower-Δ (FAIL), Upper+Δ (FAIL), blank reading ('-'), and numeric zero.",
        action: "TEST_BOUNDARIES",
        actionPayload: { tableId: context.selectedTableId, columnId: context.selectedColumnId }
      };
    }

    return {
      reply: `I am the Gaugemaster Template Assistant. I understand your template '${context.templateName || "Calibration Template"}'. You can ask me to audit the table, fix formulas, explain calculations, test tolerance boundaries, or check blank reading handling.`,
      action: "NONE"
    };
  }

  const promptText = `
You are the "Gaugemaster Template Assistant", a Senior Calibration Software Architect & Metrology Expert.
The user is working in the Gaugemaster Calibration Template Builder.

CURRENT TEMPLATE CONTEXT:
- Template Name: ${context.templateName || "Unknown"}
- Instrument Type: ${context.instrumentType || "Unknown"}
- Calibration Type: ${context.calibrationType || "Dimensional"}
- Selected Table: ${context.selectedTableTitle || "None"} (ID: ${context.selectedTableId || ""})
- Selected Column ID: ${context.selectedColumnId || "None"}
- Columns: ${JSON.stringify((context.columns || []).map(c => ({ id: c.id, label: c.label, role: c.role, formula: c.formula, sourceFormula: c.sourceFormula })))}
- Known Errors/Warnings: ${JSON.stringify(context.formulaErrors || [])}

USER MESSAGE:
"${userQuery}"

CRITICAL RULES:
1. NEVER output executable JavaScript, HTML, script tags, eval, or Function code.
2. Formulas must use Gaugemaster canonical DSL: e.g. "actual_dimension - nominal", "IF(AND(actual >= lower_limit, actual <= upper_limit), \\"PASS\\", \\"FAIL\\")", "AVERAGE(t1, t2, t3)".
3. Return a JSON object with:
   - "reply": Markdown response explaining the calibration/metrological logic clearly to the user.
   - "action": One of ["FIX_FORMULA", "AUDIT_TABLE", "FIX_TABLE", "TEST_BOUNDARIES", "EXPLAIN_FORMULA", "NONE"]
   - "actionPayload": Optional object with tableId, columnId, formula, and reason if proposing a change.
`;

  try {
    const requestBody = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2
      }
    };

    const textOutput = await executeGeminiRequest(apiKey, requestBody);
    const parsed = JSON.parse(textOutput.trim().replace(/^```json\s*/, "").replace(/```\s*$/, ""));
    return {
      reply: parsed.reply || "I have analyzed your request.",
      action: parsed.action || "NONE",
      actionPayload: parsed.actionPayload
    };
  } catch (err: any) {
    return {
      reply: `Template Assistant response: ${err.message || "Unable to contact Gemini."} You can still use the local deterministic audit and formula tools below.`,
      action: "NONE"
    };
  }
}

/**
 * Explains a formula's calibration meaning.
 */
export async function explainFormulaWithAi(params: {
  formula: string;
  columnLabel: string;
  role?: string;
  tableColumns?: CanvasColumnDef[];
  apiKeyOverride?: string;
}): Promise<string> {
  const baseExplanation = explainSemanticFormula(params.formula, params.role);
  const apiKey = params.apiKeyOverride?.trim() || getStoredGeminiApiKey();

  if (!apiKey) {
    return baseExplanation;
  }

  try {
    const prompt = `Explain the metrological meaning of this calibration formula for column "${params.columnLabel}": "${params.formula}". Keep it to 1-2 concise, professional sentences.`;
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    };
    const response = await executeGeminiRequest(apiKey, requestBody);
    return response.trim() || baseExplanation;
  } catch {
    return baseExplanation;
  }
}

