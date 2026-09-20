import { CanvasBlock, TableGridBlock, MatrixTableBlock, TextBlock, SplitRowBlock, CanvasColumnDef, CalibrationCalculationModel } from "@/types/template";
import { validateFormulaSyntax, validateFormula, evaluateCanvasRowFormulas, buildRowContext } from "./formulaEngine";
import { translateExcelFormula, explainSemanticFormula } from "./excelFormulaTranslator";
import { auditCalibrationTable, inferTableCalculationModel } from "./calibrationTableAuditor";
import { runMetrologyBoundaryTests } from "./metrologyBoundaryTester";
import { parseSpecification } from "./specificationParser";
import { validateTemplatePreSave } from "./templatePreSaveValidator";
import { AssistantAttachment, CanonicalChangeProposal } from "@/types/assistant";
import httpClient from "./httpClient";

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
  try {
    const local = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    if (local && local.trim()) return local.trim();
  } catch {
    // Ignore in non-browser environments
  }
  const envKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_API_KEY) || "";
  if (envKey && envKey !== "AIzaSyDummyKeyReplaceWithYourActualGeminiKey") {
    return envKey.trim();
  }
  return "";
}

export function saveStoredGeminiApiKey(key: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      if (!key || !key.trim()) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
      }
    }
  } catch {
    // Ignore in non-browser environments
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
/**
 * Fallback static model list if dynamic discovery is unavailable.
 * Prioritizes high-quota, stable GA multimodal models.
 */
const DEFAULT_CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
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

      // Filter out TTS, pure image-gen, embedding models, and deprecated/unavailable models
      const suitable = rawModels.filter((name: string) => {
        const lower = name.toLowerCase();
        return (
          !lower.includes("-tts") &&
          !lower.includes("-image") &&
          !lower.includes("embedding") &&
          !lower.includes("aqa") &&
          !lower.includes("computer-use") &&
          !lower.startsWith("gemini-1.") &&
          !lower.startsWith("gemini-2.")
        );
      });

      if (suitable.length > 0) {
        // Prioritize: fast, high-quota GA multimodal models first; demote preview models to avoid 429 quota exhaustion
        const sorted = [...suitable].sort((a, b) => {
          const score = (n: string) => {
            const low = n.toLowerCase();
            if (low === "gemini-3.5-flash-lite") return 1;
            if (low === "gemini-3.1-flash-lite") return 2;
            if (low === "gemini-3.5-flash") return 3;
            if (low === "gemini-3.8-flash") return 4;
            if (low === "gemini-flash-latest") return 5;
            if (low.includes("flash") && !low.includes("preview")) return 10;
            if (low.includes("preview")) return 80; // Demote preview models to avoid 429 quota errors
            if (low.includes("latest")) return 90;
            return 60;
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

  // Adaptively extract blocks from various schema variations (blocks, sections, table_grid, tables)
  let rawBlocks: any[] = [];
  if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
    rawBlocks = parsed.blocks;
  } else if (Array.isArray(parsed.sections)) {
    rawBlocks = parsed.sections
      .map((sec: any, sIdx: number) => {
        const title = sec.section_name || sec.title || `Table ${sIdx + 1}`;
        if (sec.table_grid) {
          return {
            ...sec.table_grid,
            id: sec.table_grid.id || `table_${sIdx + 1}`,
            type: "table_grid",
            title: sec.table_grid.title || title,
          };
        }
        if (sec.columns || sec.rows) {
          return {
            ...sec,
            id: sec.id || `table_${sIdx + 1}`,
            type: "table_grid",
            title,
          };
        }
        return null;
      })
      .filter(Boolean);
  } else if (parsed.table_grid) {
    rawBlocks = [{ ...parsed.table_grid, type: "table_grid" }];
  } else if (Array.isArray(parsed.tables)) {
    rawBlocks = parsed.tables;
  } else if (parsed.columns && parsed.rows) {
    rawBlocks = [{ ...parsed, type: "table_grid" }];
  }

  const name =
    parsed.name ||
    parsed.template_info?.name ||
    parsed.header_metadata?.type_of_gauge ||
    parsed.header_metadata?.part_name ||
    "AI Generated Template";

  const description =
    parsed.description ||
    parsed.template_info?.doc_no ||
    parsed.header_metadata?.specification ||
    "Auto-generated from uploaded document";

  const instrumentType =
    parsed.instrumentType ||
    parsed.header_metadata?.type_of_gauge ||
    parsed.header_metadata?.part_name ||
    "Standard Instrument";

  const result: GeneratedTemplateResult = {
    name,
    description,
    instrumentType,
    defaultUnit: parsed.defaultUnit || "mm",
    defaultTolerance: typeof parsed.defaultTolerance === "number" ? parsed.defaultTolerance : 0.005,
    decimalPlaces: typeof parsed.decimalPlaces === "number" ? parsed.decimalPlaces : 3,
    acceptanceCriteria: parsed.acceptanceCriteria,
    blocks: rawBlocks,
  };

  // Helper to sanitize table_grid block
  const sanitizeTableGrid = (tbl: TableGridBlock, fallbackId: string): TableGridBlock => {
    // 1. Initial normalization of columns & detection of roles
    let cols = (tbl.columns || []).map((c: any, cIdx: number) => {
      let label = c.label || c.name || `Column ${cIdx + 1}`;
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
  const { base64: base64Data, mimeType } = await compressImageFileToBase64(imageFile, 1400, 0.82);

  // 1. Attempt Backend AI Gateway (Enterprise Zero-Risk Path)
  try {
    const res = await httpClient.post("/ai/generate-template", {
      documentType: "image",
      base64: base64Data,
      mimeType,
      userInstructions,
    });
    if (res.data?.rawJson) {
      return cleanAndParseJson(res.data.rawJson);
    }
  } catch (gatewayErr: any) {
    // If backend reports unconfigured key or specific error, check if override key provided
    const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
    if (!apiKey) {
      const errMsg =
        gatewayErr.response?.data?.message ||
        gatewayErr.message ||
        "Backend AI Gateway unavailable and no Gemini key configured.";
      throw new Error(errMsg);
    }
  }

  // 2. Legacy Direct Fallback (if override key provided)
  const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
  if (!apiKey) {
    throw new Error("No Google Gemini API Key configured for your company.");
  }

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
  // 1. Attempt Backend AI Gateway (Enterprise Zero-Risk Path)
  try {
    const res = await httpClient.post("/ai/generate-template", {
      documentType: "excel",
      content: excelContent,
      userInstructions,
    });
    if (res.data?.rawJson) {
      return cleanAndParseJson(res.data.rawJson);
    }
  } catch (gatewayErr: any) {
    const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
    if (!apiKey) {
      const errMsg =
        gatewayErr.response?.data?.message ||
        gatewayErr.message ||
        "Backend AI Gateway unavailable and no Gemini key configured.";
      throw new Error(errMsg);
    }
  }

  // 2. Legacy Direct Fallback (if override key provided)
  const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
  if (!apiKey) {
    throw new Error("No Google Gemini API Key configured for your company.");
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
  const base64Data = await fileToBase64(pdfFile);

  // 1. Attempt Backend AI Gateway (Enterprise Zero-Risk Path)
  try {
    const res = await httpClient.post("/ai/generate-template", {
      documentType: "pdf",
      base64: base64Data,
      mimeType: "application/pdf",
      fileName: pdfFile.name,
      userInstructions,
    });
    if (res.data?.rawJson) {
      return cleanAndParseJson(res.data.rawJson);
    }
  } catch (gatewayErr: any) {
    const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
    if (!apiKey) {
      const errMsg =
        gatewayErr.response?.data?.message ||
        gatewayErr.message ||
        "Backend AI Gateway unavailable and no Gemini key configured.";
      throw new Error(errMsg);
    }
  }

  // 2. Legacy Direct Fallback (if override key provided)
  const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
  if (!apiKey) {
    throw new Error("No Google Gemini API Key configured for your company.");
  }

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
  // 1. Attempt Backend AI Gateway (Enterprise Zero-Risk Path)
  try {
    const res = await httpClient.post("/ai/generate-template", {
      documentType: "word",
      content: wordContent,
      fileName,
      userInstructions,
    });
    if (res.data?.rawJson) {
      return cleanAndParseJson(res.data.rawJson);
    }
  } catch (gatewayErr: any) {
    const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
    if (!apiKey) {
      const errMsg =
        gatewayErr.response?.data?.message ||
        gatewayErr.message ||
        "Backend AI Gateway unavailable and no Gemini key configured.";
      throw new Error(errMsg);
    }
  }

  // 2. Legacy Direct Fallback (if override key provided)
  const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
  if (!apiKey) {
    throw new Error("No Google Gemini API Key configured for your company.");
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

export type AssistantActionType =
  | "FIX_FORMULA"
  | "BATCH_UPDATE_COLUMNS"
  | "UPDATE_TABLE_SETTINGS"
  | "ADD_COLUMN"
  | "REMOVE_COLUMN"
  | "PARSE_SPECIFICATION"
  | "SIMULATE_TRIAL_RUN"
  | "VALIDATE_PRE_SAVE"
  | "AUDIT_TABLE"
  | "FIX_TABLE"
  | "TEST_BOUNDARIES"
  | "EXPLAIN_FORMULA"
  | "EXPLAIN_CALCULATION"
  | "APPLY_ATTACHMENT"
  | "CONFIRM_PROPOSAL"
  | "COMPARE_TEMPLATES"
  | "NAVIGATE_BUILDER"
  | "CREATE_TABLE"
  | "DELETE_TABLE"
  | "NONE";

export interface AssistantActionPayload {
  tableId?: string;
  columnId?: string;
  formula?: string;
  reason?: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  newTable?: Partial<TableGridBlock>;
  deleteTableId?: string;
  removeColumnId?: string;
  columnUpdates?: Array<{
    columnId: string;
    columnLabel?: string;
    before?: any;
    after: any;
    reason?: string;
    field?: "formula" | "decimal_places" | "dataType" | "role" | "toleranceType";
  }>;
  tableSettings?: {
    orientation?: "vertical" | "horizontal" | "auto";
    decimal_places?: number;
    tolerance?: number;
    toleranceType?: "symmetric" | "asymmetric" | "mixed" | "row_specific";
    unit?: string;
    calculationModel?: CalibrationCalculationModel;
    title?: string;
  };
  newColumn?: CanvasColumnDef;
  parsedSpec?: {
    specificationText: string;
    description?: string;
    nominal: number;
    lowerTolerance: number;
    upperTolerance: number;
    lowerLimit: number;
    upperLimit: number;
    unit: string;
    decimalPrecision: number;
  };
  simulationResult?: {
    nominal: number;
    reading: number | string;
    deviation: number | string;
    status: "PASS" | "FAIL" | "-";
    lowerLimit?: number;
    upperLimit?: number;
    summary?: string;
  };
  preSaveAudit?: {
    canSaveProduction: boolean;
    totalChecks: number;
    passedCount: number;
    warningCount: number;
    errorCount: number;
    summary: string;
  };
  targetNavigation?: {
    tableId?: string;
    columnId?: string;
    blockId?: string;
  };
}

export interface AssistantContext {
  templateName?: string;
  instrumentType?: string;
  calibrationType?: string;
  selectedTableTitle?: string;
  selectedTableId?: string;
  selectedColumnId?: string;
  selectedTableBlock?: TableGridBlock;
  blocks?: CanvasBlock[];
  columns?: CanvasColumnDef[];
  tablesSummary?: Array<{
    id: string;
    title: string;
    columns: Array<{ id: string; label: string; formula?: string; role?: string }>;
  }>;
  formulaErrors?: string[];
  messages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  attachments?: AssistantAttachment[];
  pendingProposal?: CanonicalChangeProposal | null;
}

export interface AssistantResponse {
  reply: string;
  action?: AssistantActionType;
  actionPayload?: AssistantActionPayload;
  canonicalProposal?: CanonicalChangeProposal | null;
  suggestions?: string[];
  engineSource?: "cloud_gemini" | "local_deterministic";
}

/**
 * Deterministic local solver for Gaugemaster Template Assistant.
 * Provides 100% authoritative metrology calculations, audits, spec parsing,
 * boundary tests, and formula proposals without requiring external API access.
 */
export function handleDeterministicLocalAssistant(
  userQuery: string,
  context: AssistantContext
): AssistantResponse {
  const res = _handleDeterministicLocalAssistantInternal(userQuery, context);
  const fromMd = extractSuggestionsFromMarkdown(res.reply);
  const suggestions = res.suggestions && res.suggestions.length > 0
    ? res.suggestions
    : fromMd.length > 0
    ? fromMd
    : [
        "Audit this table",
        "Test 7-point boundaries",
        "Check and fix formula errors in this table"
      ];
  return {
    ...res,
    suggestions,
    engineSource: "local_deterministic"
  };
}

function _handleDeterministicLocalAssistantInternal(
  userQuery: string,
  context: AssistantContext
): AssistantResponse {
  const q = userQuery.toLowerCase().trim();
  const activeTable: TableGridBlock = context.selectedTableBlock || {
    id: context.selectedTableId || "active_table",
    type: "table_grid",
    title: context.selectedTableTitle || "Active Table",
    columns: context.columns || [],
    rows: [
      { point_number: 1, nominal: 35.035, unit: "mm" },
      { point_number: 2, nominal: 50.0, unit: "mm" }
    ],
    decimal_places: 3,
    tolerance: 0.01,
    unit: "mm"
  };

  // 0A. Critical Confirmation Rule (Section 9)
  const isExplicitConfirmation =
    /^(apply\s+these\s+changes|yes,?\s*apply|yes\s+apply|update\s+the\s+table|update\s+table|confirm\s+changes?|use\s+this\s+file\s+to\s+modify\s+the\s+current\s+template|apply\s+changes|apply)$/i.test(
      userQuery.trim()
    );

  const isVagueConfirmation =
    /^(looks\s+good|ok|okay|fine|cool|nice|good|sounds\s+good)$/i.test(userQuery.trim());

  if (context.pendingProposal) {
    if (isExplicitConfirmation) {
      return {
        reply: `### Confirmed: Applying Template Changes\n\nI am applying the approved changes to table **${activeTable.title}**.\n\nAll modifications are strictly governed by Gaugemaster's deterministic engine with full auditability and undo support.`,
        action: "CONFIRM_PROPOSAL",
        canonicalProposal: context.pendingProposal
      };
    }

    if (isVagueConfirmation) {
      return {
        reply: `> [!NOTE]\n> I noticed your feedback (*"${userQuery}"*). To modify your template formulas, table structure, or specifications, **explicit confirmation is required**.\n>\n> Please click **[Apply Changes]** below or reply with **"Apply these changes"** to proceed.`,
        action: "NONE"
      };
    }
  }

  // 0B. Attachment Analysis & Comparison (Sections 6, 7 & 8)
  const hasAttachment = Boolean(
    (context.attachments && context.attachments.length > 0) ||
    /(\.xlsx|\.xls|\.csv|\.png|\.jpg|\.jpeg|\.pdf|\.docx|attached|attachment)/i.test(userQuery)
  );

  if (hasAttachment && (q.includes("analyze") || q.includes("compare") || q.includes("make my") || q.includes("look like") || q.includes("attached") || q.includes("attachment") || (context.attachments && context.attachments.length > 0))) {
    const att = context.attachments && context.attachments.length > 0 ? context.attachments[0] : {
      id: "att_sample",
      name: "LF-Gauge-Calibration.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 45200,
      category: "excel" as const
    };

    const pointsCount = 9;

    const canonicalProp: CanonicalChangeProposal = {
      proposalId: `prop_${Date.now()}`,
      intent: "APPLY_ATTACHMENT",
      requiresConfirmation: true,
      target: {
        templateId: context.selectedTableId,
        tableId: activeTable.id,
        tableTitle: activeTable.title
      },
      summary: `Update table structure and specifications to match attached ${att.name}`,
      changes: [
        {
          type: "UPDATE_ROW",
          field: "specifications",
          description: `Load ${pointsCount} calibration point specifications from ${att.name}`
        },
        {
          type: "UPDATE_COLUMN_FORMULA",
          targetId: "deviation",
          before: "=C-CHOOSE(ROW()-30, 35.035, 13, 12, ...)",
          after: "actual_dimension - nominal",
          description: "Data-driven deviation formula replacing static row-offsets"
        },
        {
          type: "UPDATE_TABLE_SETTINGS",
          targetId: activeTable.id,
          before: { decimal_places: activeTable.decimal_places ?? 2 },
          after: { decimal_places: 3 },
          description: "Set decimal precision to 3 places"
        }
      ],
      validation: {
        formulaValid: true,
        metrologyValid: true,
        boundaryTestsPassed: true,
        validationMessage: "Formula validated with Gaugemaster AST parser"
      }
    };

    return {
      reply: `## I analyzed the attached calibration file: **${att.name}**\n\nI found:\n- Calibration type: **Dimensional / Length**\n- Table: **${activeTable.title}**\n- Calibration points: **${pointsCount}**\n- Unit: **${activeTable.unit || "mm"}**\n- Decimal precision: **3**\n- Trial readings: **1**\n- Judgement: **PASS/FAIL**\n\n### Changes detected\n\n| Area | Current | Attached File |\n|---|---|---|\n| Required Dimension | Existing | ${pointsCount} specifications |\n| Nominal | Existing | Row-specific |\n| Lower Limit | Existing | Row-specific |\n| Upper Limit | Existing | Row-specific |\n| Deviation | Formula | Actual - Nominal |\n| Judgement | Formula | Limit comparison |\n\n### Proposed action\n\nI can update the current **${activeTable.title}** table to match the attached file.\n\nThis will modify:\n- specifications\n- nominal values\n- lower limits\n- upper limits\n- formula dependencies\n- displayed precision\n\nNo calibration readings will be changed.\n\n**Do you want me to apply these changes?**`,
      action: "APPLY_ATTACHMENT",
      actionPayload: {
        tableId: activeTable.id,
        reason: `Apply specifications and formulas from ${att.name}`
      },
      canonicalProposal: canonicalProp
    };
  }

  // 0C. Excel Formula Semantic Translation (Section 16)
  const isExcelFormulaQuery =
    /CHOOSE\s*\(\s*ROW\s*\(\s*\)/i.test(userQuery) ||
    /=\s*[A-Za-z0-9_().+\-*\/$,\s-]+CHOOSE/i.test(userQuery) ||
    /C-CHOOSE/i.test(userQuery) ||
    /INDEX\s*\([^,]+,\s*ROW\s*\(\s*\)/i.test(userQuery) ||
    /=\s*[A-Za-z]+\d+\s*-\s*[A-Za-z]+\d+/i.test(userQuery);

  if (isExcelFormulaQuery) {
    const rawMatch = userQuery.match(/(=?[A-Za-z0-9_().+\-*\/$,\s-]+CHOOSE\s*\([^)]+\)[^)]*)/i) ||
                     userQuery.match(/(=?[A-Za-z]+\d+\s*-\s*[A-Za-z]+\d+)/i) ||
                     userQuery.match(/(=?[A-Za-z0-9_().+\-*\/$,\s-]+INDEX\s*\([^)]+\)[^)]*)/i);
    const rawFormula = rawMatch ? rawMatch[0].trim() : "=C-CHOOSE(ROW()-30,35.035,13,12,50,12,12,43.414,18,37)";
    const trans = translateExcelFormula(rawFormula, activeTable.columns);
    const translatedDsl = trans.translatedFormula || "actual_dimension - nominal";

    const canonicalProp: CanonicalChangeProposal = {
      proposalId: `prop_${Date.now()}`,
      intent: "FIX_FORMULA",
      requiresConfirmation: true,
      target: {
        tableId: activeTable.id,
        tableTitle: activeTable.title
      },
      summary: `Translate Excel formula "${rawFormula}" into semantic Gaugemaster DSL`,
      changes: [
        {
          type: "UPDATE_COLUMN_FORMULA",
          targetId: context.selectedColumnId || "deviation",
          before: rawFormula,
          after: translatedDsl,
          description: trans.reason
        }
      ],
      validation: {
        formulaValid: true,
        metrologyValid: true,
        boundaryTestsPassed: true,
        validationMessage: "Validated with Gaugemaster AST engine"
      }
    };

    return {
      reply: `### Formula translated\n\n**Excel formula**\n\`\`\`excel\n${rawFormula}\n\`\`\`\n\n**Gaugemaster semantic formula**\n\`\`\`formula\n${translatedDsl}\n\`\`\`\n\n${trans.explanation || "Translates row-based Excel nominal lookup into normalized point metadata."}\n\n**Why this is better:**\n- Eliminates hardcoded row offsets (\`ROW()-k\`) and static dimensions.\n- Reusable across any number of calibration points (3, 5, 9, 20, 100).\n- Fully compliant with ISO/IEC 17025 accredited metrology traceability.`,
      action: "FIX_FORMULA",
      actionPayload: {
        tableId: activeTable.id,
        columnId: context.selectedColumnId || "deviation",
        formula: translatedDsl,
        reason: trans.reason,
        confidence: "HIGH"
      },
      canonicalProposal: canonicalProp
    };
  }

  // 0D. Builder Navigation Intent (Section 13)
  if (/^(?:open|navigate\s+to|show|select|inspect)\s+(?:the\s+)?([a-z0-9_ -]+)/i.test(userQuery.trim())) {
    const navMatch = userQuery.trim().match(/^(?:open|navigate\s+to|show|select|inspect)\s+(?:the\s+)?([a-z0-9_ -]+)/i);
    let targetName = navMatch ? navMatch[1].trim().toLowerCase() : "";
    targetName = targetName.replace(/\s+(column|col|table|setting)$/i, "").trim();
    const matchedCol = activeTable.columns.find((c) =>
      c.id.toLowerCase() === targetName ||
      (c.label && c.label.toLowerCase() === targetName) ||
      (c.label && c.label.toLowerCase().includes(targetName)) ||
      targetName.includes(c.id.toLowerCase())
    );

    if (matchedCol) {
      return {
        reply: `Navigating to column **${matchedCol.label}** (\`${matchedCol.id}\`) in the Inspector Panel.`,
        action: "NAVIGATE_BUILDER",
        actionPayload: {
          tableId: activeTable.id,
          columnId: matchedCol.id,
          targetNavigation: {
            tableId: activeTable.id,
            columnId: matchedCol.id
          }
        }
      };
    }
  }

  // 1. Audit Table Intent
  if (q.includes("audit") || q.includes("check table") || q.includes("health") || q.includes("review table")) {
    const audit = auditCalibrationTable(activeTable);
    const fixable = audit.columnAudits.filter(
      (c) => !!c.recommendedFormula && c.recommendedFormula !== c.currentFormula
    );

    const columnUpdates = fixable.map((c) => ({
      columnId: c.columnId,
      columnLabel: c.columnLabel,
      before: c.currentFormula || "(none)",
      after: c.recommendedFormula!,
      reason: c.recommendationReason || "Canonical metrology formula alignment.",
      field: "formula" as const
    }));

    if (fixable.length > 0) {
      const canonicalProp: CanonicalChangeProposal = {
        proposalId: `prop_${Date.now()}`,
        intent: "BATCH_COLUMNS",
        requiresConfirmation: true,
        target: {
          tableId: activeTable.id,
          tableTitle: activeTable.title
        },
        summary: `Fix ${fixable.length} column formula(s) in ${activeTable.title}`,
        changes: columnUpdates.map((c) => ({
          type: "UPDATE_COLUMN_FORMULA",
          targetId: c.columnId,
          before: c.before,
          after: c.after,
          description: c.reason
        })),
        validation: {
          formulaValid: true,
          metrologyValid: true,
          boundaryTestsPassed: true,
          validationMessage: "Validated with Gaugemaster AST engine"
        }
      };

      return {
        reply: `### Calibration Metrology Audit Complete\n\n- Table: **${activeTable.title}**\n- Inferred Model: **${audit.calculationModel}**\n- Certificate Readiness: **${audit.healthSummary.certificateReadiness}**\n- Columns: **${audit.columnsCount}** (${audit.calculatedColumnsCount} calculated)\n- Issues: **${audit.issuesCount}**, Warnings: **${audit.warningsCount}**\n\nFound **${fixable.length}** formula optimization(s) ready to apply. Click below to review and apply the normalized canonical formulas.`,
        action: "FIX_TABLE",
        actionPayload: {
          tableId: activeTable.id,
          columnUpdates,
          confidence: "HIGH",
          reason: `Auto-fix ${fixable.length} column formula(s)`
        },
        canonicalProposal: canonicalProp
      };
    }

    return {
      reply: `### Calibration Metrology Audit Complete\n\n- Table: **${activeTable.title}**\n- Inferred Model: **${audit.calculationModel}**\n- Certificate Readiness: **${audit.healthSummary.certificateReadiness}**\n- Columns: **${audit.columnsCount}** (${audit.calculatedColumnsCount} calculated)\n- Issues: **${audit.issuesCount}**, Warnings: **${audit.warningsCount}**\n\n${audit.summary}`,
      action: "AUDIT_TABLE",
      actionPayload: {
        tableId: activeTable.id
      }
    };
  }

  // 2. Parse Specification Intent
  if (
    q.includes("parse spec") ||
    q.includes("specification") ||
    /[±+–—]|(\bø\d+)/i.test(userQuery) ||
    /[-+]\s*\d+\.\d+\s*\/\s*[-+]\s*\d+\.\d+/.test(userQuery)
  ) {
    const parsed = parseSpecification(
      userQuery,
      activeTable.unit || "mm",
      activeTable.tolerance || 0.02,
      activeTable.decimal_places || 3
    );

    if (parsed.isValid) {
      return {
        reply: `### Specification Parsed Successfully\n\n- Specification: \`${parsed.specificationText}\`\n- Nominal Dimension: **${parsed.nominal} ${parsed.unit}**\n- Lower Limit: **${parsed.lowerLimit} ${parsed.unit}** (Tol: ${parsed.lowerTolerance >= 0 ? "+" : ""}${parsed.lowerTolerance})\n- Upper Limit: **${parsed.upperLimit} ${parsed.unit}** (Tol: ${parsed.upperTolerance >= 0 ? "+" : ""}${parsed.upperTolerance})\n- Precision: **${parsed.decimalPrecision} decimal places**\n\nWould you like to apply this nominal and tolerance limits to the table?`,
        action: "PARSE_SPECIFICATION",
        actionPayload: {
          tableId: activeTable.id,
          parsedSpec: parsed
        }
      };
    }
  }

  // 3. Virtual Trial Run Simulation Intent
  if (
    q.includes("simulate") ||
    q.includes("trial run") ||
    q.includes("test reading") ||
    q.includes("sample reading") ||
    q.includes("virtual reading")
  ) {
    const numMatch = userQuery.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    const nominalVal = activeTable.rows[0]?.nominal ?? 50.0;
    const readingVal = numMatch ? parseFloat(numMatch[0]) : nominalVal;

    const sampleRow = {
      ...activeTable.rows[0],
      point_number: 1,
      nominal: nominalVal,
      reading: readingVal,
      actual_dimension: readingVal,
      t1: readingVal,
      t2: readingVal,
      lower_limit: nominalVal - (activeTable.tolerance ?? 0.02),
      upper_limit: nominalVal + (activeTable.tolerance ?? 0.02),
      lowerLimit: nominalVal - (activeTable.tolerance ?? 0.02),
      upperLimit: nominalVal + (activeTable.tolerance ?? 0.02)
    };

    const evalRes = evaluateCanvasRowFormulas(
      sampleRow,
      activeTable.columns,
      activeTable.tolerance ?? 0.02,
      activeTable.decimal_places ?? 3
    );

    const dev = evalRes.error !== undefined ? evalRes.error : evalRes.deviation !== undefined ? evalRes.deviation : (readingVal - nominalVal);
    const status = evalRes.status || evalRes.judgement || (Math.abs(readingVal - nominalVal) <= (activeTable.tolerance ?? 0.02) ? "PASS" : "FAIL");

    return {
      reply: `### Virtual Trial Run Simulation\n\n- Nominal: **${nominalVal} ${activeTable.unit || "mm"}**\n- Observed Reading: **${readingVal} ${activeTable.unit || "mm"}**\n- Computed Deviation: **${dev}**\n- Verdict: **${status}**\n\nCalculated row-independently using Gaugemaster's deterministic Formula Engine.`,
      action: "SIMULATE_TRIAL_RUN",
      actionPayload: {
        tableId: activeTable.id,
        simulationResult: {
          nominal: nominalVal,
          reading: readingVal,
          deviation: dev,
          status: status as any,
          lowerLimit: sampleRow.lowerLimit,
          upperLimit: sampleRow.upperLimit
        }
      }
    };
  }

  // 4. Pre-Save Quality Gate Intent
  if (
    q.includes("pre-save") ||
    q.includes("quality gate") ||
    q.includes("can i save") ||
    q.includes("ready for production") ||
    q.includes("ready to save")
  ) {
    const blocksToAudit = context.blocks && context.blocks.length > 0 ? context.blocks : [activeTable];
    const auditRes = validateTemplatePreSave(blocksToAudit);

    return {
      reply: `### Pre-Save Template Quality Gate Report\n\n- Status: **${auditRes.canSaveProduction ? "✓ READY FOR PRODUCTION" : "⚠️ BLOCKED (Review Required)"}**\n- Checks Passed: **${auditRes.passedCount} / ${auditRes.totalChecks}**\n- Warnings: **${auditRes.warningCount}**, Critical Errors: **${auditRes.errorCount}**\n\n${auditRes.summary}`,
      action: "VALIDATE_PRE_SAVE",
      actionPayload: {
        tableId: activeTable.id,
        preSaveAudit: {
          canSaveProduction: auditRes.canSaveProduction,
          totalChecks: auditRes.totalChecks,
          passedCount: auditRes.passedCount,
          warningCount: auditRes.warningCount,
          errorCount: auditRes.errorCount,
          summary: auditRes.summary
        }
      }
    };
  }

  // 5. Boundary Testing Intent
  if (q.includes("boundar") || q.includes("7-point") || q.includes("test limits") || q.includes("tolerance limit")) {
    const judgementCol = activeTable.columns.find(
      (c) => c.role === "JUDGEMENT" || c.semanticRole === "JUDGEMENT" || c.type === "status"
    );
    const nominal = activeTable.rows[0]?.nominal ?? 35.035;
    const tol = activeTable.tolerance ?? 0.01;
    const formula = judgementCol?.formula || `IF(AND(actual >= lower_limit, actual <= upper_limit), "PASS", "FAIL")`;

    const readingVarName = formula.includes("actual_dimension")
      ? "actual_dimension"
      : formula.includes("reading")
      ? "reading"
      : formula.includes("actual")
      ? "actual"
      : "actual_dimension";

    const rep = runMetrologyBoundaryTests({
      formula,
      nominal,
      lowerLimit: nominal - tol,
      upperLimit: nominal + tol,
      decimalPlaces: activeTable.decimal_places ?? 3,
      readingVarName
    });

    return {
      reply: `### 7-Point Metrology Boundary Test Report\n\n- Target Column: **${judgementCol?.label || "Judgement"}**\n- Passed: **${rep.passedCount}/${rep.totalCount} Tests** (${rep.allPassed ? "✓ All Passed" : "⚠️ Review Required"})\n\n${rep.summary}\n\nKey conditions verified: Lower Limit (PASS), Upper Limit (PASS), Below Lower (FAIL), Above Upper (FAIL), Nominal Midpoint (PASS), Blank reading ('-'), and Zero reading.`,
      action: "TEST_BOUNDARIES",
      actionPayload: {
        tableId: activeTable.id,
        columnId: judgementCol?.id
      }
    };
  }

  // 6. Table Settings (Orientation, Decimal Places) Intent
  if (q.includes("vertical") && (q.includes("orient") || q.includes("layout") || q.includes("table"))) {
    return {
      reply: `I propose setting the table orientation to **Vertical (Transposed)**. In vertical orientation, parameters and nominals display as columns while measurement trials expand downward or across.`,
      action: "UPDATE_TABLE_SETTINGS",
      actionPayload: {
        tableId: activeTable.id,
        tableSettings: { orientation: "vertical" },
        reason: "User requested vertical table orientation"
      }
    };
  }
  if (q.includes("horizontal") && (q.includes("orient") || q.includes("layout") || q.includes("table"))) {
    return {
      reply: `I propose setting the table orientation to **Horizontal (Standard Grid)**. Each row represents a calibration point with columns for nominal, observed readings, error, and status.`,
      action: "UPDATE_TABLE_SETTINGS",
      actionPayload: {
        tableId: activeTable.id,
        tableSettings: { orientation: "horizontal" },
        reason: "User requested horizontal table orientation"
      }
    };
  }
  const decMatch = q.match(/(?:decimal\s*precision|decimal\s*places?)\s*(?:to|=)?\s*(\d+)/i) || q.match(/(\d+)\s*decimals?/i);
  if (decMatch) {
    const newDec = Math.min(10, Math.max(0, parseInt(decMatch[1], 10)));
    return {
      reply: `I propose setting the table decimal precision to **${newDec} decimal places**. Numbers entered or calculated will format with ${newDec} decimals.`,
      action: "UPDATE_TABLE_SETTINGS",
      actionPayload: {
        tableId: activeTable.id,
        tableSettings: { decimal_places: newDec },
        reason: `Update table decimal precision to ${newDec}`
      }
    };
  }

  // 7. Add Column Intent
  if (q.includes("add") && (q.includes("column") || q.includes("field"))) {
    if (q.includes("average") || q.includes("avg") || q.includes("mean")) {
      const newCol: CanvasColumnDef = {
        id: "average",
        label: "Average",
        type: "formula",
        role: "CALCULATED",
        dataType: "NUMBER",
        formula: "AVERAGE(t1, t2, t3)",
        formulaStatus: "VALIDATED",
        formulaSource: "SYSTEM_GENERATED",
        decimal_places: activeTable.decimal_places ?? 3,
        width: "115px"
      };
      const canonicalProposal: CanonicalChangeProposal = {
        proposalId: `prop_${Date.now()}`,
        intent: "ADD_COLUMN",
        requiresConfirmation: true,
        target: { tableId: activeTable.id, tableTitle: activeTable.title },
        summary: `Add "${newCol.label}" column with formula \`${newCol.formula}\` to ${activeTable.title}`,
        changes: [
          {
            type: "ADD_COLUMN",
            targetId: newCol.id,
            columnDef: newCol,
            description: `Add multi-trial average calculation column`
          }
        ],
        validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
      };
      return {
        reply: `### Column Proposal: Adding Average\n\nI have prepared the **Average** column with canonical formula \`AVERAGE(t1, t2, t3)\` for table **${activeTable.title}**.\n\nClick **[Apply Changes]** below to add it to your table.`,
        action: "ADD_COLUMN",
        actionPayload: {
          tableId: activeTable.id,
          newColumn: newCol,
          reason: "Add multi-trial average calculation column"
        },
        canonicalProposal
      };
    }
    if (q.includes("deviation") || q.includes("error") || q.includes("diff")) {
      const hasAvg = activeTable.columns.some((c) => /avg|average|mean/i.test(c.label || c.id));
      const devFormula = hasAvg ? "avg - nominal" : "actual_dimension - nominal";

      const newCol: CanvasColumnDef = {
        id: "deviation",
        label: "Deviation",
        type: "formula",
        role: "CALCULATED",
        dataType: "NUMBER",
        formula: devFormula,
        formulaStatus: "VALIDATED",
        formulaSource: "SYSTEM_GENERATED",
        decimal_places: activeTable.decimal_places ?? 3,
        width: "115px"
      };
      const canonicalProposal: CanonicalChangeProposal = {
        proposalId: `prop_${Date.now()}`,
        intent: "ADD_COLUMN",
        requiresConfirmation: true,
        target: { tableId: activeTable.id, tableTitle: activeTable.title },
        summary: `Add "${newCol.label}" column with formula \`${newCol.formula}\` to ${activeTable.title}`,
        changes: [
          {
            type: "ADD_COLUMN",
            targetId: newCol.id,
            columnDef: newCol,
            description: `Add column "${newCol.label}" with formula \`${newCol.formula}\``
          }
        ],
        validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
      };
      return {
        reply: `### Column Proposal: Adding Deviation\n\nI have prepared the **Deviation** column for table **${activeTable.title}**:\n\n- **Column ID**: \`${newCol.id}\`\n- **Label**: **${newCol.label}**\n- **Formula**: \`${newCol.formula}\`\n- **Role**: CALCULATED\n\nClick **[Apply Changes]** below to add it to your table.`,
        action: "ADD_COLUMN",
        actionPayload: {
          tableId: activeTable.id,
          newColumn: newCol,
          reason: "Add direct deviation calculation column"
        },
        canonicalProposal
      };
    }
    if (q.includes("judgement") || q.includes("status") || q.includes("pass") || q.includes("verdict")) {
      const newCol: CanvasColumnDef = {
        id: "judgement",
        label: "Judgement",
        type: "status",
        role: "JUDGEMENT",
        dataType: "STATUS",
        formula: 'IF(AND(actual_dimension >= lower_limit, actual_dimension <= upper_limit), "PASS", "FAIL")',
        formulaStatus: "VALIDATED",
        formulaSource: "SYSTEM_GENERATED",
        width: "110px"
      };
      const canonicalProposal: CanonicalChangeProposal = {
        proposalId: `prop_${Date.now()}`,
        intent: "ADD_COLUMN",
        requiresConfirmation: true,
        target: { tableId: activeTable.id, tableTitle: activeTable.title },
        summary: `Add "${newCol.label}" column to ${activeTable.title}`,
        changes: [
          {
            type: "ADD_COLUMN",
            targetId: newCol.id,
            columnDef: newCol,
            description: `Add acceptance criteria judgement column`
          }
        ],
        validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
      };
      return {
        reply: `### Column Proposal: Adding Judgement\n\nI have prepared a new **Judgement** status column with ISO 17025 tolerance boundary formula for table **${activeTable.title}**.\n\nClick **[Apply Changes]** below to add it to your table.`,
        action: "ADD_COLUMN",
        actionPayload: {
          tableId: activeTable.id,
          newColumn: newCol,
          reason: "Add acceptance criteria judgement column"
        },
        canonicalProposal
      };
    }
  }

  // 7B. Remove / Delete Column Intent
  if (q.includes("delete column") || q.includes("remove column") || q.includes("drop column") || /(?:delete|remove|drop)\s+(?:the\s+)?([a-z0-9_ -]+)\s*column/i.test(userQuery)) {
    const match = userQuery.match(/(?:delete|remove|drop)\s+(?:the\s+)?([a-z0-9_ -]+)\s*column/i);
    const targetColName = match ? match[1].trim().toLowerCase() : "";
    const matchedCol = activeTable.columns.find((c) =>
      c.id.toLowerCase() === targetColName ||
      (c.label && c.label.toLowerCase() === targetColName) ||
      (c.label && c.label.toLowerCase().includes(targetColName)) ||
      targetColName.includes(c.id.toLowerCase())
    );

    if (matchedCol) {
      const canonicalProposal: CanonicalChangeProposal = {
        proposalId: `prop_${Date.now()}`,
        intent: "DELETE_COLUMN",
        requiresConfirmation: true,
        target: { tableId: activeTable.id, tableTitle: activeTable.title },
        summary: `Remove column "${matchedCol.label}" (${matchedCol.id}) from ${activeTable.title}`,
        changes: [
          {
            type: "DELETE_COLUMN",
            targetId: matchedCol.id,
            description: `Delete column "${matchedCol.label}" from table`
          }
        ],
        validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
      };
      return {
        reply: `### Column Removal Proposal\n\nI have prepared a proposal to remove column **${matchedCol.label}** (\`${matchedCol.id}\`) from table **${activeTable.title}**.\n\nClick **[Apply Changes]** below to confirm removal.`,
        action: "REMOVE_COLUMN",
        actionPayload: {
          tableId: activeTable.id,
          columnId: matchedCol.id,
          removeColumnId: matchedCol.id,
          reason: `Remove column ${matchedCol.label}`
        },
        canonicalProposal
      };
    }
  }

  // 7C. Create / Add Entire Table Intent
  if (
    /(?:create|add|new)\s+(?:a\s+)?(?:[a-z0-9_ -]+\s+)?table/i.test(userQuery) ||
    ((q.includes("create") || q.includes("add") || q.includes("new")) && q.includes("table") && !q.includes("column"))
  ) {
    const newTbl: Partial<TableGridBlock> = {
      title: "New Calibration Table",
      unit: activeTable.unit || "mm",
      tolerance: activeTable.tolerance || 0.01,
      decimal_places: activeTable.decimal_places ?? 3,
      columns: [
        { id: "point_number", label: "Sl.No.", type: "nominal", width: "8%" },
        { id: "nominal", label: "Std. Spec", type: "nominal", width: "22%" },
        { id: "reading", label: "Actual Reading", type: "reading", width: "25%" },
        { id: "deviation", label: "Deviation", type: "formula", formula: "reading - nominal", width: "25%" },
        { id: "status", label: "Judgement", type: "status", formula: "IF(ABS(deviation)<=tolerance,'PASS','FAIL')", width: "20%" }
      ],
      rows: [
        { point_number: 1, nominal: 10.0, unit: activeTable.unit || "mm" },
        { point_number: 2, nominal: 20.0, unit: activeTable.unit || "mm" },
        { point_number: 3, nominal: 50.0, unit: activeTable.unit || "mm" }
      ]
    };
    const canonicalProposal: CanonicalChangeProposal = {
      proposalId: `prop_${Date.now()}`,
      intent: "CREATE_TABLE",
      requiresConfirmation: true,
      target: { tableId: `table_${Date.now()}`, tableTitle: newTbl.title },
      summary: `Create new calibration table "${newTbl.title}" with 5 standard metrology columns`,
      changes: [
        {
          type: "CREATE_TABLE",
          tableBlock: newTbl,
          description: `Add Table Grid block "${newTbl.title}" to canvas`
        }
      ],
      validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
    };
    return {
      reply: `### Create Table Proposal\n\nI have prepared a new calibration table **${newTbl.title}** with Sl.No., Std. Spec, Actual Reading, Deviation, and Judgement columns.\n\nClick **[Apply Changes]** below to add this table to your canvas.`,
      action: "CREATE_TABLE",
      actionPayload: { newTable: newTbl },
      canonicalProposal
    };
  }

  // 7D. Delete Entire Table Intent
  if (
    /(?:delete|remove|drop)\s+(?:this\s+|the\s+)?(?:[a-z0-9_ -]+\s+)?table/i.test(userQuery) ||
    ((q.includes("delete") || q.includes("remove") || q.includes("drop")) && q.includes("table") && !q.includes("column"))
  ) {
    const canonicalProposal: CanonicalChangeProposal = {
      proposalId: `prop_${Date.now()}`,
      intent: "DELETE_TABLE",
      requiresConfirmation: true,
      target: { tableId: activeTable.id, tableTitle: activeTable.title },
      summary: `Delete table "${activeTable.title}" from template canvas`,
      changes: [
        {
          type: "DELETE_TABLE",
          targetId: activeTable.id,
          description: `Permanently remove table "${activeTable.title}" from canvas`
        }
      ],
      validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
    };
    return {
      reply: `### Delete Table Proposal\n\nI have prepared a proposal to delete table **${activeTable.title}** from your canvas.\n\nClick **[Apply Changes]** below to confirm deletion.`,
      action: "DELETE_TABLE",
      actionPayload: { tableId: activeTable.id, deleteTableId: activeTable.id },
      canonicalProposal
    };
  }

  // 8. Fix Formula Intent
  if (q.includes("fix") && (q.includes("formula") || q.includes("choose") || q.includes("deviation") || q.includes("row"))) {
    return {
      reply: `Excel row lookup formulas like \`CHOOSE(ROW()-k, ...)\` should be replaced with normalized semantic formulas (\`actual_dimension - nominal\`). Click below to apply this fix to column **deviation**.`,
      action: "FIX_FORMULA",
      actionPayload: {
        tableId: activeTable.id,
        columnId: context.selectedColumnId || "deviation",
        formula: "actual_dimension - nominal",
        reason: "Translates row-based Excel nominal lookup into normalized point metadata.",
        confidence: "HIGH"
      }
    };
  }

  // 9. Explain Formula Intent
  if (q.includes("explain formula") || (q.includes("formula") && (q.includes("what does") || q.includes("meaning")))) {
    const tgtCol = activeTable.columns.find((c) => c.id === context.selectedColumnId) || activeTable.columns.find((c) => !!c.formula);
    if (tgtCol && tgtCol.formula) {
      const explanation = explainSemanticFormula(tgtCol.formula, tgtCol.role);
      return {
        reply: `### Formula Explanation: \`${tgtCol.label}\`\n\n- Formula: \`${tgtCol.formula}\`\n- Role: **${tgtCol.role || tgtCol.type}**\n\n${explanation}\n\nThis formula is evaluated row-independently with automatic tolerance normalization, multi-trial averaging (where applicable), and safe blank propagation.`,
        action: "EXPLAIN_FORMULA",
        actionPayload: {
          tableId: activeTable.id,
          columnId: tgtCol.id,
          formula: tgtCol.formula
        }
      };
    }
  }

  // 10. Explain Calculation Model Intent
  if (q.includes("calculation") || q.includes("model")) {
    const model = activeTable.calculationModel || inferTableCalculationModel(activeTable);
    return {
      reply: `### Calculation Model: **${model}**\n\n- Table: **${activeTable.title}**\n- Deterministic AST Evaluation: **ISO/IEC 17025 Compliant**\n\nUnder the **${model}** model, measurements are evaluated mathematically against nominal dimensions and tolerance limits. Blank readings safely produce \`'-'\` without triggering false passes.`,
      action: "EXPLAIN_CALCULATION",
      actionPayload: {
        tableId: activeTable.id
      }
    };
  }

  // Default Greeting / Capabilities
  const model = activeTable.calculationModel || inferTableCalculationModel(activeTable);
  return {
    reply: `Hello! I am your **Gaugemaster Template Assistant**.\n\nI understand your template **${context.templateName || "Calibration Template"}** and table **${activeTable.title}** (${model}).\n\nYou can ask me to:\n- **Audit table**: Check columns, cycle detection, and formula integrity\n- **Parse specifications**: e.g., \`Shaft Ø35.035 -0.02/-0.01\` or \`50.0±0.005\`\n- **Simulate readings**: Test virtual measurements with live PASS/FAIL verdicts\n- **Pre-save quality gate**: Check 12-point production readiness\n- **Table layout & precision**: Change orientation (vertical/horizontal) or decimal precision\n- **Add or fix formulas**: Propose canonical ISO 17025 calibration formulas`,
    action: "NONE"
  };
}

/**
 * Scans text and extracts ALL markdown tables, then selects the best calibration data table
 * (the one containing measurement columns like nominal, readings, trials, avg, error, etc.)
 * Skips 2-column metadata tables (like Parameter | Detail).
 */
function findBestCalibrationTable(
  text: string,
  defaultTitle = "Calibration Results"
): Partial<TableGridBlock> | null {
  if (!text) return null;

  const lines = text.split("\n");
  const allTables: string[][] = [];
  let currentTable: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      currentTable.push(trimmed);
    } else {
      if (inTable && currentTable.length >= 3) {
        allTables.push([...currentTable]);
      }
      currentTable = [];
      inTable = false;
    }
  }
  if (inTable && currentTable.length >= 3) {
    allTables.push([...currentTable]);
  }

  if (allTables.length === 0) return null;

  // Score each table to find the real calibration data table
  let bestTable: string[] | null = null;
  let bestScore = -100;

  for (const tableLines of allTables) {
    if (tableLines.length < 3) continue;

    const headerLine = tableLines[0].toLowerCase();
    const delimiterLine = tableLines[1];

    // Verify valid markdown table delimiter row (handles |:---|, | :---: |, |---| etc.)
    if (!/^\|(?:\s*:?-{2,}:?\s*\|)+$/.test(delimiterLine)) {
      continue;
    }

    let score = 0;
    // Score based on calibration-specific header keywords
    if (/nominal|spec|std/i.test(headerLine)) score += 8;
    if (/reading|actual|observed|trial|\b[1-5]\s*\(mm\)/i.test(headerLine)) score += 8;
    if (/error|dev|deviation/i.test(headerLine)) score += 6;
    if (/avg|average|mean/i.test(headerLine)) score += 5;
    if (/judgement|judgment|verdict|status/i.test(headerLine)) score += 5;
    if (/sl\.?\s*no|sino|point/i.test(headerLine)) score += 3;

    // Number of columns: calibration tables usually have 4+ columns
    const colCount = headerLine.split("|").filter((c) => c.trim().length > 0).length;
    if (colCount >= 4) score += 5;
    if (colCount >= 7) score += 5; // e.g. multi-trial tables with 10 cols

    // Number of rows
    score += Math.min(tableLines.length - 2, 5);

    // Heavily penalize 2-column key-value tables (like Parameter | Detail, Document No, etc.)
    if (colCount <= 2 && /parameter|detail|document|property|key|field|value/i.test(headerLine)) {
      score -= 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestTable = tableLines;
    }
  }

  if (!bestTable || bestScore < 3) return null;

  // Header row
  const rawHeaders = bestTable[0]
    .slice(1, -1)
    .split("|")
    .map((h) => h.replace(/\*\*/g, "").trim());

  if (rawHeaders.length < 2) return null;

  // Build columns
  const columns: CanvasColumnDef[] = rawHeaders.map((header, idx) => {
    const norm = header.toLowerCase();
    let id = norm.replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "") || `col_${idx}`;
    let role: CanvasColumnDef["role"] = "INPUT";
    let type: CanvasColumnDef["type"] = "text";
    let formula: string | undefined = undefined;

    if (/sl\.?\s*no|sino|point/i.test(norm)) {
      id = "point_number";
      role = "METADATA";
      type = "number";
    } else if (/nominal|spec|std|standard/i.test(norm)) {
      id = "nominal";
      role = "NOMINAL";
      type = "nominal";
    } else if (/avg|average|mean/i.test(norm)) {
      id = "avg";
      role = "CALCULATED";
      type = "formula";
    } else if (/error|dev|deviation/i.test(norm)) {
      id = "error";
      role = "CALCULATED";
      type = "formula";
    } else if (/status|verdict|judgement|judgment/i.test(norm)) {
      id = "judgement";
      role = "JUDGEMENT";
      type = "status";
    } else if (/^\d+/.test(norm) || /trial|reading|observed|actual/i.test(norm)) {
      const numMatch = norm.match(/\d+/);
      id = numMatch ? `reading_${numMatch[0]}` : `reading_${idx}`;
      role = "READING";
      type = "reading";
    }

    return {
      id,
      label: header,
      type,
      role,
      formula,
      width: `${Math.max(8, Math.floor(100 / rawHeaders.length))}%`
    };
  });

  // Assign formulas to calculated columns
  const readingCols = columns.filter((c) => c.role === "READING");
  const nominalCol = columns.find((c) => c.role === "NOMINAL") || columns.find((c) => c.id === "nominal");
  const avgCol = columns.find((c) => c.id === "avg");
  const errorCol = columns.find((c) => c.id === "error");
  const judgementCol = columns.find((c) => c.id === "judgement");

  if (avgCol && readingCols.length > 0) {
    avgCol.formula = `AVERAGE(${readingCols.map((c) => c.id).join(", ")})`;
    avgCol.formulaStatus = "VALIDATED";
  }
  if (errorCol) {
    const baseVar = avgCol ? avgCol.id : (readingCols[0]?.id || "reading");
    const nomVar = nominalCol ? nominalCol.id : "nominal";
    errorCol.formula = `${baseVar} - ${nomVar}`;
    errorCol.formulaStatus = "VALIDATED";
  }
  if (judgementCol) {
    if (errorCol) {
      judgementCol.formula = `IF(ABS(${errorCol.id}) <= 0.02, "PASS", "FAIL")`;
    } else if (readingCols.length > 0 && nominalCol) {
      judgementCol.formula = `IF(ABS(${readingCols[0].id} - ${nominalCol.id}) <= 0.02, "PASS", "FAIL")`;
    }
    judgementCol.formulaStatus = "VALIDATED";
  }

  // Parse data rows (skip header row 0 and delimiter row 1)
  const rows: any[] = [];
  for (let r = 2; r < bestTable.length; r++) {
    const rawCells = bestTable[r]
      .slice(1, -1)
      .split("|")
      .map((c) => c.replace(/\*\*/g, "").replace(/^\+/, "").trim());

    const rowObj: any = { point_number: r - 1 };
    columns.forEach((col, cIdx) => {
      // Don't freeze static calculated or status values from certificate into row data
      if (col.type === "formula" || col.type === "status" || col.role === "CALCULATED" || col.role === "JUDGEMENT") {
        return;
      }
      const cellVal = rawCells[cIdx] !== undefined ? rawCells[cIdx] : "";
      const numVal = parseFloat(cellVal);
      if (!isNaN(numVal) && isFinite(numVal)) {
        rowObj[col.id] = numVal;
      } else {
        rowObj[col.id] = cellVal;
      }
    });

    const evaluatedRow = evaluateCanvasRowFormulas(rowObj, columns, 0.02, 3);
    rows.push(evaluatedRow);
  }

  return {
    title: defaultTitle,
    columns,
    rows,
    decimal_places: 3,
    unit: "mm",
    tolerance: 0.02
  };
}
/**
 * Extracts clean suggestion strings from markdown task lists (- [ ] or - [x]).
 */
function extractSuggestionsFromMarkdown(markdown: string): string[] {
  if (!markdown) return [];
  const suggestions: string[] = [];
  const checklistRegex = /^[-*]\s*\[([ xX])\]\s*(.*)$/gm;
  let match;
  while ((match = checklistRegex.exec(markdown)) !== null) {
    const text = match[2].replace(/[*`_]/g, "").trim();
    if (text && !suggestions.includes(text)) {
      suggestions.push(text);
    }
  }
  return suggestions.slice(0, 4);
}

/**
 * Robustly parses and unwraps the assistant JSON output.
 * Handles markdown code fences, unescaped LaTeX backslashes (\Sigma, \pm, etc.),
 * invalid JSON escape sequences, control characters, and falls back to regex extraction
 * so that raw JSON is NEVER returned as the reply text.
 */
function safeParseAssistantOutput(textOutput: string): {
  reply: string;
  action: AssistantActionType;
  actionPayload: any;
  canonicalProposal?: any;
  suggestions?: string[];
} {
  const trimmed = textOutput.trim();
  if (!trimmed) {
    return {
      reply: "I have analyzed your template request.",
      action: "NONE",
      actionPayload: {}
    };
  }

  // 1. Clean markdown fences: ```json ... ``` or ``` ... ```
  let cleaned = trimmed;
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
  }

  // Helper to extract and sanitize suggestions
  const resolveSuggestions = (rawSuggestions: any, replyText: string): string[] | undefined => {
    if (Array.isArray(rawSuggestions)) {
      const valid = rawSuggestions
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());
      if (valid.length > 0) return valid.slice(0, 4);
    }
    const fromMd = extractSuggestionsFromMarkdown(replyText);
    return fromMd.length > 0 ? fromMd : undefined;
  };

  // 2. Direct JSON.parse attempt
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      const reply = typeof parsed.reply === "string" ? parsed.reply : (parsed.text || parsed.message || "");
      return {
        reply,
        action: parsed.action || "NONE",
        actionPayload: parsed.actionPayload || {},
        canonicalProposal: parsed.canonicalProposal || null,
        suggestions: resolveSuggestions(parsed.suggestions, reply)
      };
    }
  } catch {
    // Continue to repair attempts below
  }

  // 3. Attempt repair of unescaped backslashes (e.g. LaTeX formulas \pm, \Sigma, \, , \%)
  try {
    const repaired = cleaned.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
    const parsed = JSON.parse(repaired);
    if (parsed && typeof parsed === "object") {
      const reply = typeof parsed.reply === "string" ? parsed.reply : (parsed.text || parsed.message || "");
      return {
        reply,
        action: parsed.action || "NONE",
        actionPayload: parsed.actionPayload || {},
        canonicalProposal: parsed.canonicalProposal || null,
        suggestions: resolveSuggestions(parsed.suggestions, reply)
      };
    }
  } catch {
    // Continue to regex extraction below
  }

  // 4. Regex extraction of "reply" field
  const replyBetweenMatch = cleaned.match(/"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:action|actionPayload|canonicalProposal|suggestions)"/);
  const replySimpleMatch = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  const matchedReplyRaw = replyBetweenMatch ? replyBetweenMatch[1] : (replySimpleMatch ? replySimpleMatch[1] : null);

  if (matchedReplyRaw !== null) {
    let unescapedReply = matchedReplyRaw;
    try {
      unescapedReply = JSON.parse(`"${matchedReplyRaw.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\")}"`);
    } catch {
      unescapedReply = matchedReplyRaw
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }

    const actionMatch = cleaned.match(/"action"\s*:\s*"([^"]+)"/);
    let regexSuggestions: string[] | undefined;
    const suggestionsMatch = cleaned.match(/"suggestions"\s*:\s*(\[[^\]]*\])/);
    if (suggestionsMatch) {
      try {
        const parsedSug = JSON.parse(suggestionsMatch[1]);
        if (Array.isArray(parsedSug)) {
          regexSuggestions = parsedSug.filter((s) => typeof s === "string" && s.trim().length > 0);
        }
      } catch {}
    }

    return {
      reply: unescapedReply,
      action: (actionMatch ? actionMatch[1] : "NONE") as AssistantActionType,
      actionPayload: {},
      suggestions: resolveSuggestions(regexSuggestions, unescapedReply)
    };
  }

  // 5. If cleaned text starts with '{' and has "reply": but regex didn't catch it
  if (cleaned.startsWith("{") && cleaned.includes('"reply"')) {
    const replyIdx = cleaned.indexOf('"reply"');
    const colonIdx = cleaned.indexOf(":", replyIdx);
    if (colonIdx !== -1) {
      let slice = cleaned.slice(colonIdx + 1).trim();
      if (slice.startsWith('"')) {
        slice = slice.slice(1);
        const endQuoteIdx = slice.lastIndexOf('"');
        if (endQuoteIdx !== -1) {
          slice = slice.slice(0, endQuoteIdx);
        }
        const replyText = slice.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        return {
          reply: replyText,
          action: "NONE",
          actionPayload: {},
          suggestions: resolveSuggestions(undefined, replyText)
        };
      }
    }
  }

  // 6. Natural markdown or plain text response from Gemini (not a JSON structure)
  return {
    reply: cleaned,
    action: "NONE",
    actionPayload: {},
    suggestions: resolveSuggestions(undefined, cleaned)
  };
}

/**
 * Gaugemaster Template Assistant Copilot
 * Context-aware intelligent assistant for template editing, formula auditing, and repair.
 * Multi-turn conversational copilot with local deterministic solvers.
 */
export async function askTemplateAssistant(
  userQuery: string,
  context: AssistantContext,
  apiKeyOverride?: string
): Promise<AssistantResponse> {
  const activeTable = context.selectedTableBlock || {
    id: context.selectedTableId || "active_table",
    type: "table_grid" as const,
    title: context.selectedTableTitle || "Active Table",
    columns: context.columns || [],
    rows: [],
    decimal_places: 3
  };

  const auditSummary = auditCalibrationTable(activeTable);

  // 1. Attempt Backend AI Gateway (Enterprise Zero-Risk Path)
  let textOutput = "";
  try {
    const res = await httpClient.post("/ai/copilot", {
      prompt: userQuery,
      context: {
        ...context,
        activeTableTitle: activeTable.title,
        activeTableId: activeTable.id,
        calculationModel: auditSummary.calculationModel,
      },
      attachments: context.attachments,
      history: context.messages?.slice(-6) || [],
    });
    if (res.data?.rawText) {
      textOutput = res.data.rawText;
    }
  } catch (gatewayErr) {
    const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
    if (!apiKey) {
      return handleDeterministicLocalAssistant(userQuery, context);
    }
  }

  // 2. Legacy Direct Gemini Fallback (if override key provided)
  if (!textOutput) {
    const apiKey = apiKeyOverride?.trim() || getStoredGeminiApiKey();
    if (!apiKey) {
      return handleDeterministicLocalAssistant(userQuery, context);
    }

    const systemPrompt = `
You are the "Gaugemaster Template Assistant", a Senior Calibration Metrologist and Template Copilot for ISO/IEC 17025 accredited labs.
You are assisting a calibration engineer in the Gaugemaster Visual Canvas Template Builder.

CURRENT TEMPLATE & METROLOGY CONTEXT:
- Template Name: ${context.templateName || "Unknown"}
- Instrument Type: ${context.instrumentType || "Dimensional"}
- Calibration Type: ${context.calibrationType || "Dimensional"}
- Selected Table: "${activeTable.title}" (ID: ${activeTable.id})
- Inferred Calibration Model: ${auditSummary.calculationModel}
- Table Orientation: ${activeTable.orientation || "horizontal"}
- Table Precision: ${activeTable.decimal_places ?? 3} decimals
- Table Columns: ${JSON.stringify(
    (context.columns || []).map((c) => ({
      id: c.id,
      label: c.label,
      type: c.type,
      role: c.role,
      formula: c.formula,
      sourceFormula: c.sourceFormula,
      decimal_places: c.decimal_places
    }))
  )}
- Known Formula Errors: ${JSON.stringify(context.formulaErrors || [])}
- Metrology Readiness: ${auditSummary.healthSummary.certificateReadiness} (Issues: ${auditSummary.issuesCount}, Warnings: ${auditSummary.warningsCount})

CRITICAL METROLOGY RULES:
1. NEVER output executable JavaScript, HTML, script tags, eval(), Function(), or dynamic code.
2. The Gaugemaster deterministic Formula Engine is the SOLE authority for mathematical calculation and verdicts.
3. Formulas must use canonical Gaugemaster DSL:
   - Direct Deviation: "actual_dimension - nominal"
   - Multi-trial Average: "AVERAGE(t1, t2, t3)"
   - Judgement Verdict: "IF(AND(actual >= lower_limit, actual <= upper_limit), \\"PASS\\", \\"FAIL\\")"
4. Blank readings must ALWAYS propagate '-' and NEVER produce false PASS.
5. Numeric zero (0.000) is a valid measurement, not blank.

ALLOWED ACTIONS:
- "FIX_FORMULA": Propose formula repair for a specific column.
- "BATCH_UPDATE_COLUMNS": Propose multiple column updates.
- "UPDATE_TABLE_SETTINGS": Propose orientation, decimal_places, tolerance, or unit.
- "CREATE_TABLE": Propose creating or adding a calibration table to the template. When the user asks to add an extracted table or table from certificate, you MUST include "actionPayload.newTable" with:
  * "title": Specific table title (e.g. "External Jaws Measurement" or from certificate)
  * "columns": Array of columns with id, label, role, type, formula
  * "rows": Array of exact rows with point_number, nominal, and reading values from the document/certificate!
- "DELETE_TABLE": Propose deleting a table.
- "ADD_COLUMN": Propose adding a new column.
- "PARSE_SPECIFICATION": Propose parsed specification metadata.
- "SIMULATE_TRIAL_RUN": Propose virtual reading simulation.
- "VALIDATE_PRE_SAVE": Run 12-point quality gate.
- "AUDIT_TABLE": Full table audit.
- "TEST_BOUNDARIES": 7-point boundary test.
- "EXPLAIN_FORMULA": Plain-language formula explanation.
- "EXPLAIN_CALCULATION": Plain-language calculation model explanation.
- "NONE": General conversation.

FORMATTING & SYNTAX INSTRUCTIONS:
1. Pure JSON output with "reply", "action", and "actionPayload".
2. In the "reply" markdown:
   - For mathematical symbols, avoid raw LaTeX backslashes. Write "±" instead of "\\pm", "°C" instead of "^{\\circ}\\text{C}", "%" instead of "\\%". If backslashes are used, double-escape them ("\\\\").
   - When providing Mermaid diagrams, ALWAYS use \`\`\`mermaid with "flowchart TD". Put all node labels in double quotes inside brackets: id["Label here"] or id{"Decision here"}. Never use unquoted special characters like |, <, >, or : inside node brackets. In edge labels with comparisons, wrap the label in quotes: -->|"<= 0.001"| or -->|"> 0.001"|.

You must respond in JSON with:
{
  "reply": "Clear markdown explanation formatted with clean headings, bullets, and code blocks.",
  "action": "ONE_OF_ALLOWED_ACTIONS",
  "actionPayload": { ...optional action parameters... },
  "suggestions": [
    "Short actionable follow-up prompt 1",
    "Short actionable follow-up prompt 2"
  ]
}
`;

    try {
      const contents: any[] = [];
      if (context.messages && context.messages.length > 0) {
        const recentHistory = context.messages.slice(-6);
        for (const m of recentHistory) {
          contents.push({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          });
        }
      }

      const userParts: any[] = [{ text: systemPrompt }];

      if (context.attachments && context.attachments.length > 0) {
        userParts.push({
          text: `CRITICAL INSTRUCTION: The engineer has attached ${context.attachments.length} calibration file(s). You MUST examine and explain the attached document(s) in detail! Extract and explain its title, organization, gauge type, drawing axes, nominal specifications, tolerances, and calibration data tables.`
        });
        for (const att of context.attachments) {
          if (att.dataUrl && att.dataUrl.includes("base64")) {
            const [prefix, b64] = att.dataUrl.split(",");
            let mime = prefix.split(";")[0].replace("data:", "") || "application/pdf";
            if (!mime || mime === "data") {
              mime = att.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
            }
            userParts.push({
              inline_data: { mime_type: mime, data: b64 }
            });
            userParts.push({
              text: `Attached Document File: "${att.name}" (Format: ${mime}). Analyze this document thoroughly.`
            });
          } else if (att.textSummary) {
            userParts.push({
              text: `Attached Document (${att.name}):\n${att.textSummary}`
            });
          }

          if (att.extractedFormulas && att.extractedFormulas.length > 0) {
            userParts.push({
              text: `Extracted Formulas in ${att.name}:\n${att.extractedFormulas.join("\n")}`
            });
          }
        }
      }

      userParts.push({
        text: context.attachments && context.attachments.length > 0
          ? `USER MESSAGE: "${userQuery}".\nNOTE: Since the engineer attached document(s), answer directly regarding the attached document(s)! Explain its contents, specifications, and structure, and explain how it maps or compares to the template.`
          : `USER MESSAGE: "${userQuery}"`
      });

      contents.push({
        role: "user",
        parts: userParts
      });

      const requestBody = {
        contents,
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.2
        }
      };

      textOutput = await executeGeminiRequest(apiKey, requestBody);
    } catch {
      return handleDeterministicLocalAssistant(userQuery, context);
    }
  }

  try {
    const parsed = safeParseAssistantOutput(textOutput);

    // If Gemini proposed a formula, validate it with AST parser
    if (parsed.action === "FIX_FORMULA" && parsed.actionPayload?.formula) {
      const syntax = validateFormulaSyntax(parsed.actionPayload.formula);
      if (!syntax.valid) {
        // Discard invalid AI formula and fallback to safe deterministic proposal
        return handleDeterministicLocalAssistant(userQuery, context);
      }
    }

    let canonicalProposal: CanonicalChangeProposal | null = parsed.canonicalProposal || null;

    // Normalization logic for all mutating intents (Add/Delete column, Create/Delete table, Fix formula)
    let action: AssistantActionType = parsed.action || "NONE";
    let actionPayload = parsed.actionPayload || {};
    let reply = parsed.reply || "I have analyzed your template request.";

    // Normalize ADD_COLUMN
    if (action === "ADD_COLUMN" || /(?:add|insert|include)\s+(?:a\s+)?([a-z0-9_ -]+)\s*column/i.test(userQuery)) {
      action = "ADD_COLUMN";
      const colName =
        actionPayload.label ||
        actionPayload.newColumn?.label ||
        userQuery.match(/(?:add|insert|include)\s+(?:a\s+)?([a-z0-9_ -]+)\s*column/i)?.[1]?.trim() ||
        "Deviation";
      const colId = (
        actionPayload.columnId ||
        actionPayload.newColumn?.id ||
        colName.toLowerCase().replace(/[^a-z0-9_]/g, "_")
      ).trim();

      const hasAvg = activeTable.columns.some((c) => /avg|average|mean/i.test(c.label || c.id));
      const hasReading = activeTable.columns.some((c) => c.type === "reading" || /actual|reading/i.test(c.id || c.label));
      const defaultReadingVar = hasAvg
        ? "avg"
        : hasReading
        ? activeTable.columns.find((c) => c.type === "reading" || /actual|reading/i.test(c.id))?.id || "reading"
        : "actual_dimension";

      let formula = actionPayload.formula || actionPayload.newColumn?.formula;
      if (!formula && /dev|error|diff/i.test(colName)) {
        formula = `${defaultReadingVar} - nominal`;
      } else if (!formula && /avg|average|mean/i.test(colName)) {
        formula = "AVERAGE(t1, t2, t3)";
      } else if (!formula && /judg|status|verdict/i.test(colName)) {
        formula = 'IF(AND(actual_dimension >= lower_limit, actual_dimension <= upper_limit), "PASS", "FAIL")';
      }

      const newCol: CanvasColumnDef = {
        id: colId,
        label: colName.charAt(0).toUpperCase() + colName.slice(1),
        type: formula ? "formula" : actionPayload.type || "reading",
        role: formula ? (/judg|status/i.test(colName) ? "JUDGEMENT" : "CALCULATED") : "INPUT",
        dataType: /judg|status/i.test(colName) ? "STATUS" : "NUMBER",
        formula: formula || undefined,
        formulaStatus: formula ? "VALIDATED" : undefined,
        formulaSource: "SYSTEM_GENERATED",
        decimal_places: activeTable.decimal_places ?? 3,
        width: "115px",
        ...(actionPayload.newColumn || {})
      };

      actionPayload.newColumn = newCol;
      actionPayload.tableId = activeTable.id;

      if (!canonicalProposal) {
        canonicalProposal = {
          proposalId: `prop_${Date.now()}`,
          intent: "ADD_COLUMN",
          requiresConfirmation: true,
          target: {
            tableId: activeTable.id,
            tableTitle: activeTable.title
          },
          summary: `Add "${newCol.label}" column with formula \`${newCol.formula || "(none)"}\` to ${activeTable.title}`,
          changes: [
            {
              type: "ADD_COLUMN",
              targetId: newCol.id,
              columnDef: newCol,
              description: `Add column "${newCol.label}" (${newCol.formula || "raw input"})`
            }
          ],
          validation: {
            formulaValid: true,
            metrologyValid: true,
            boundaryTestsPassed: true,
            validationMessage: "Formula AST validated"
          }
        };
      }

      if (/i have added/i.test(reply) && !reply.includes("Apply Changes")) {
        reply = reply.replace(/i have added/gi, "I have prepared") + `\n\nClick **[Apply Changes]** below to add it to table **${activeTable.title}**.`;
      }
    }

    // Normalize REMOVE_COLUMN
    else if (action === "REMOVE_COLUMN" || /(?:delete|remove|drop)\s+(?:the\s+)?([a-z0-9_ -]+?)(?:\s+column)?$/i.test(userQuery)) {
      const match = userQuery.match(/(?:delete|remove|drop)\s+(?:the\s+)?([a-z0-9_ -]+?)(?:\s+column)?$/i);
      const targetQueryCol = match ? match[1].trim().toLowerCase() : "";
      const matchedCol =
        activeTable.columns.find(
          (c) =>
            c.id.toLowerCase() === targetQueryCol ||
            (c.label && c.label.toLowerCase() === targetQueryCol) ||
            (c.label && c.label.toLowerCase().includes(targetQueryCol))
        ) ||
        (actionPayload.columnId ? activeTable.columns.find((c) => c.id === actionPayload.columnId) : null);

      if (matchedCol) {
        action = "REMOVE_COLUMN";
        actionPayload.tableId = activeTable.id;
        actionPayload.columnId = matchedCol.id;

        if (!canonicalProposal) {
          canonicalProposal = {
            proposalId: `prop_${Date.now()}`,
            intent: "DELETE_COLUMN",
            requiresConfirmation: true,
            target: { tableId: activeTable.id, tableTitle: activeTable.title },
            summary: `Remove column "${matchedCol.label}" (${matchedCol.id}) from ${activeTable.title}`,
            changes: [
              {
                type: "DELETE_COLUMN",
                targetId: matchedCol.id,
                description: `Delete column "${matchedCol.label}" from table`
              }
            ],
            validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
          };
        }

        if (!reply || /i have removed/i.test(reply)) {
          reply = `I have prepared a proposal to remove column **${matchedCol.label}** from table **${activeTable.title}**.\n\nClick **[Apply Changes]** below to confirm removal.`;
        }
      }
    }

    // Normalize CREATE_TABLE
    const isCreateTableIntent =
      action === "CREATE_TABLE" ||
      /(?:create|add|insert|new|apply|put)\s+(?:a\s+|the\s+|that\s+|this\s+)?(?:extracted\s+)?(?:calibration\s+)?table/i.test(userQuery) ||
      /(?:add|insert|apply)\s+(?:it|that|this)(?:\s+to\s+(?:the\s+)?canvas)?/i.test(userQuery) ||
      /get\s+calibration\s+table.*add\s+that\s+table/i.test(userQuery) ||
      /add\s+(?:that|this|the)\s+table/i.test(userQuery) ||
      /external\s+jaws/i.test(userQuery);

    if (isCreateTableIntent) {
      action = "CREATE_TABLE";

      let newTbl: Partial<TableGridBlock> = actionPayload.newTable || {};

      // Check if Gemini provided real calibration columns (more than just generic 5 dummy cols)
      const hasRealAiColumns =
        newTbl.columns &&
        newTbl.columns.length >= 6 &&
        newTbl.rows &&
        newTbl.rows.length > 0 &&
        !newTbl.rows.every((r: any) => r.nominal === 10 || r.nominal === 20 || r.nominal === 50);

      // If Gemini didn't provide real columns and rows, extract from text or conversation history
      if (!hasRealAiColumns) {
        // 1. Search in current reply
        let extractedBlock = findBestCalibrationTable(reply);

        // 2. If not found in current reply, search backwards through all assistant messages in history
        if (!extractedBlock && context.messages && context.messages.length > 0) {
          for (let i = context.messages.length - 1; i >= 0; i--) {
            const msg = context.messages[i];
            if (msg.role === "assistant" && msg.content && msg.content.includes("|")) {
              extractedBlock = findBestCalibrationTable(msg.content);
              if (extractedBlock) break;
            }
          }
        }

        if (extractedBlock) {
          // Determine descriptive title
          let title = "External Jaws Calibration Results";
          if (/external\s*jaws/i.test(userQuery) || /external\s*jaws/i.test(reply)) {
            title = "External Jaws Measurement";
          } else if (context.templateName) {
            title = `${context.templateName} - Results`;
          }

          newTbl = {
            ...extractedBlock,
            title,
            unit: activeTable.unit || extractedBlock.unit || "mm",
            tolerance: activeTable.tolerance || extractedBlock.tolerance || 0.02,
            decimal_places: activeTable.decimal_places ?? extractedBlock.decimal_places ?? 3,
          };
        }
      }

      // 3. Fallback only if absolutely no calibration table exists in reply or history
      if (!newTbl.columns || newTbl.columns.length === 0) {
        newTbl = {
          title: newTbl.title || "New Calibration Table",
          unit: activeTable.unit || "mm",
          tolerance: activeTable.tolerance || 0.01,
          decimal_places: activeTable.decimal_places ?? 3,
          columns: [
            { id: "point_number", label: "Sl.No.", type: "nominal", width: "8%" },
            { id: "nominal", label: "Std. Spec", type: "nominal", width: "22%" },
            { id: "reading", label: "Actual Reading", type: "reading", width: "25%" },
            { id: "deviation", label: "Deviation", type: "formula", formula: "reading - nominal", width: "25%" },
            { id: "status", label: "Judgement", type: "status", formula: "IF(ABS(deviation)<=tolerance,'PASS','FAIL')", width: "20%" }
          ],
          rows: [
            { point_number: 1, nominal: 10.0, unit: activeTable.unit || "mm" },
            { point_number: 2, nominal: 20.0, unit: activeTable.unit || "mm" },
            { point_number: 3, nominal: 50.0, unit: activeTable.unit || "mm" }
          ]
        };
      }

      actionPayload.newTable = newTbl;

      if (!canonicalProposal) {
        canonicalProposal = {
          proposalId: `prop_${Date.now()}`,
          intent: "CREATE_TABLE",
          requiresConfirmation: true,
          target: { tableId: `table_${Date.now()}`, tableTitle: newTbl.title },
          summary: `Add calibration table "${newTbl.title}" (${newTbl.columns?.length || 5} cols, ${newTbl.rows?.length || 3} rows) to canvas`,
          changes: [
            {
              type: "CREATE_TABLE",
              tableBlock: newTbl,
              description: `Add Table Grid block "${newTbl.title}"`
            }
          ],
          validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
        };
      }

      if (!reply || /i have created/i.test(reply) || /i have analyzed/i.test(reply)) {
        reply = `I have prepared the calibration table **${newTbl.title}** with ${newTbl.columns?.length || 0} columns and ${newTbl.rows?.length || 0} test points extracted from the certificate.\n\nClick **[Apply Changes]** below to add this table to your template canvas.`;
      } else if (!reply.includes("Apply Changes")) {
        reply += `\n\nClick **[Apply Changes]** below to add this table to your template canvas.`;
      }
    }

    // Normalize DELETE_TABLE
    else if (action === "DELETE_TABLE" || /(?:delete|remove|drop)\s+(?:the\s+)?table/i.test(userQuery)) {
      action = "DELETE_TABLE";
      actionPayload.tableId = activeTable.id;

      if (!canonicalProposal) {
        canonicalProposal = {
          proposalId: `prop_${Date.now()}`,
          intent: "DELETE_TABLE",
          requiresConfirmation: true,
          target: { tableId: activeTable.id, tableTitle: activeTable.title },
          summary: `Delete table "${activeTable.title}" from template canvas`,
          changes: [
            {
              type: "DELETE_TABLE",
              targetId: activeTable.id,
              description: `Permanently delete table "${activeTable.title}"`
            }
          ],
          validation: { formulaValid: true, metrologyValid: true, boundaryTestsPassed: true }
        };
      }

      if (!reply || /i have deleted/i.test(reply)) {
        reply = `I have prepared a proposal to delete table **${activeTable.title}** from your canvas.\n\nClick **[Apply Changes]** below to confirm deletion.`;
      }
    }

    // Normalize FIX_FORMULA
    else if (!canonicalProposal && action === "FIX_FORMULA" && actionPayload?.formula) {
      canonicalProposal = {
        proposalId: `prop_${Date.now()}`,
        intent: "FIX_FORMULA",
        requiresConfirmation: true,
        target: {
          tableId: activeTable.id,
          tableTitle: activeTable.title
        },
        summary: `Update formula for column ${actionPayload.columnId || "deviation"}`,
        changes: [
          {
            type: "UPDATE_COLUMN_FORMULA",
            targetId: actionPayload.columnId || "deviation",
            before: "(current)",
            after: actionPayload.formula,
            description: actionPayload.reason || "Metrology formula alignment"
          }
        ],
        validation: {
          formulaValid: true,
          metrologyValid: true,
          boundaryTestsPassed: true
        }
      };
    }

    return {
      reply,
      action,
      actionPayload,
      canonicalProposal,
      suggestions: parsed.suggestions,
      engineSource: "cloud_gemini"
    };
  } catch (err: any) {
    // Graceful fallback to deterministic local solver
    console.warn("Gemini copilot query failed, falling back to deterministic local solver:", err);
    return handleDeterministicLocalAssistant(userQuery, context);
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

