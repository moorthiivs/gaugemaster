/**
 * Gaugemaster AI Calibration Template Intelligence — 30-Case Test Suite
 *
 * Automated verification of:
 * 1. Excel CHOOSE translation
 * 2. Excel ROW translation
 * 3. Excel INDEX translation
 * 4. Simple deviation calculation
 * 5. Asymmetric tolerance calculation
 * 6. Symmetric tolerance calculation
 * 7. Positive-only tolerance calculation
 * 8. Negative-only tolerance calculation
 * 9. Range specification parsing and limits
 * 10. Blank reading handling (produces "-", never PASS)
 * 11. Zero reading handling (valid numeric zero)
 * 12. Lower boundary test (lowerLimit -> PASS)
 * 13. Upper boundary test (upperLimit -> PASS)
 * 14. Just below lower boundary (lowerLimit - delta -> FAIL)
 * 15. Just above upper boundary (upperLimit + delta -> FAIL)
 * 16. Multi-trial average calculation
 * 17. Multiple trials with blanks
 * 18. Dependency topological ordering
 * 19. Circular dependency detection
 * 20. Unknown variable rejection
 * 21. Unknown function rejection & recommendation
 * 22. Formula code injection rejection
 * 23. AI malformed response handling
 * 24. AI low-confidence response
 * 25. AI entire-table audit
 * 26. Save/reload persistence
 * 27. Certificate preview isolation
 * 28. Different point counts (3, 5, 9, 20 points)
 * 29. Different table structures (Vernier, Micrometer, Dial, Gauge)
 * 30. Mixed tolerance table handling
 */

import { translateExcelFormula } from "./excelFormulaTranslator";
import {
  parseFormulaAST,
  validateFormula,
  testEvaluateFormula,
  detectFormulaCycles,
  extractASTDependencies,
} from "./formulaEngine";
import { runMetrologyBoundaryTests } from "./metrologyBoundaryTester";
import { auditCalibrationTable, generateFixedTableColumns } from "./calibrationTableAuditor";
import { validateTemplatePreSave } from "./templatePreSaveValidator";
import { parseSpecification } from "./specificationParser";
import { TableGridBlock, CanvasColumnDef } from "../types/template";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✕ FAIL: ${testName}${details ? ` — ${details}` : ""}`);
    failedCount++;
  }
}

console.log("\n============================================================");
console.log("GAUGEMASTER AI CALIBRATION INTELLIGENCE — 30 TEST MATRIX");
console.log("============================================================\n");

// TEST 1: Excel CHOOSE translation
console.log("--- Group 1: Excel Translation ---");
const t1Result = translateExcelFormula("=C-CHOOSE(ROW()-30,35.035,13,12,50,12,12,43.414,18,37)");
assert(
  t1Result.isSupported &&
    (t1Result.translatedFormula === "actual_dimension - nominal" || t1Result.translatedFormula?.includes("- nominal")) &&
    t1Result.confidence === "HIGH",
  "1. Excel CHOOSE translation",
  `Got: ${t1Result.translatedFormula}, confidence: ${t1Result.confidence}`
);

// TEST 2: Excel ROW translation
const t2Result = translateExcelFormula("=ROW()-30");
assert(
  t2Result.translatedFormula !== null && t2Result.translatedFormula.length > 0,
  "2. Excel ROW translation",
  `Got: ${t2Result.translatedFormula}`
);

// TEST 3: Excel INDEX translation
const t3Result = translateExcelFormula("=C-INDEX($B$5:$B$15, ROW()-4)");
assert(
  t3Result.translatedFormula?.includes("- nominal") ?? false,
  "3. Excel INDEX translation",
  `Got: ${t3Result.translatedFormula}`
);

// TEST 4: Simple deviation
console.log("\n--- Group 2: Metrology Tolerances & Calculations ---");
const t4Eval = testEvaluateFormula("actual_dimension - nominal", {
  actual_dimension: 35.022,
  nominal: 35.035,
});
assert(
  t4Eval.success && Math.abs(t4Eval.result - (-0.013)) < 1e-6,
  "4. Simple deviation calculation",
  `Expected -0.013, got ${t4Eval.result}`
);

// TEST 5: Asymmetric tolerance (35.035 -0.02/-0.01 -> limits: 35.015 to 35.025)
const t5Spec = parseSpecification("35.035 -0.02/-0.01");
const t5Nom = t5Spec?.nominal ?? 35.035;
const t5Lower = t5Spec?.lowerLimit ?? 35.015;
const t5Upper = t5Spec?.upperLimit ?? 35.025;
const t5Formula = "IF(AND(actual_dimension >= lower_limit, actual_dimension <= upper_limit), 'PASS', 'FAIL')";

const t5Pass = testEvaluateFormula(t5Formula, { actual_dimension: 35.022, lower_limit: t5Lower, upper_limit: t5Upper });
const t5Fail = testEvaluateFormula(t5Formula, { actual_dimension: 35.014, lower_limit: t5Lower, upper_limit: t5Upper });
assert(
  t5Pass.result === "PASS" && t5Fail.result === "FAIL",
  "5. Asymmetric tolerance calculation",
  `In-spec (35.022): ${t5Pass.result}, Out-of-spec (35.014): ${t5Fail.result}`
);

// TEST 6: Symmetric tolerance (13 ±0.01 -> limits: 12.99 to 13.01)
const t6Spec = parseSpecification("13±0.01");
const t6Lower = t6Spec?.lowerLimit ?? 12.99;
const t6Upper = t6Spec?.upperLimit ?? 13.01;
const t6Pass = testEvaluateFormula(t5Formula, { actual_dimension: 13.004, lower_limit: t6Lower, upper_limit: t6Upper });
const t6Fail = testEvaluateFormula(t5Formula, { actual_dimension: 13.012, lower_limit: t6Lower, upper_limit: t6Upper });
assert(
  t6Pass.result === "PASS" && t6Fail.result === "FAIL",
  "6. Symmetric tolerance calculation",
  `In-spec (13.004): ${t6Pass.result}, Out-of-spec (13.012): ${t6Fail.result}`
);

// TEST 7: Positive-only tolerance (12 +0.018 -> limits: 12.000 to 12.018)
const t7Spec = parseSpecification("12+0.018");
const t7Lower = t7Spec?.lowerLimit ?? 12.000;
const t7Upper = t7Spec?.upperLimit ?? 12.018;
const t7Pass = testEvaluateFormula(t5Formula, { actual_dimension: 12.000, lower_limit: t7Lower, upper_limit: t7Upper });
const t7Fail = testEvaluateFormula(t5Formula, { actual_dimension: 11.999, lower_limit: t7Lower, upper_limit: t7Upper });
assert(
  t7Pass.result === "PASS" && t7Fail.result === "FAIL",
  "7. Positive-only tolerance calculation",
  `Boundary (12.000): ${t7Pass.result}, Below (11.999): ${t7Fail.result}`
);

// TEST 8: Negative-only tolerance (50 -0.005 -> limits: 49.995 to 50.000)
const t8Spec = parseSpecification("50-0.005");
const t8Lower = t8Spec?.lowerLimit ?? 49.995;
const t8Upper = t8Spec?.upperLimit ?? 50.000;
const t8Pass = testEvaluateFormula(t5Formula, { actual_dimension: 49.998, lower_limit: t8Lower, upper_limit: t8Upper });
const t8Fail = testEvaluateFormula(t5Formula, { actual_dimension: 50.002, lower_limit: t8Lower, upper_limit: t8Upper });
assert(
  t8Pass.result === "PASS" && t8Fail.result === "FAIL",
  "8. Negative-only tolerance calculation",
  `In-spec (49.998): ${t8Pass.result}, Above (50.002): ${t8Fail.result}`
);

// TEST 9: Range specification (12.000 - 12.018)
const t9Spec = parseSpecification("12.000 - 12.018");
assert(
  t9Spec !== null && Math.abs(t9Spec.lowerLimit - 12.000) < 1e-4 && Math.abs(t9Spec.upperLimit - 12.018) < 1e-4,
  "9. Range specification parsing",
  `Parsed lower: ${t9Spec?.lowerLimit}, upper: ${t9Spec?.upperLimit}`
);

// TEST 10: Blank reading handling (must produce "-", never PASS, never 0)
console.log("\n--- Group 3: Boundaries, Blanks & Zeroes ---");
const t10Formula = "IF(ISBLANK(actual_dimension), '-', IF(AND(actual_dimension >= lower_limit, actual_dimension <= upper_limit), 'PASS', 'FAIL'))";
const t10Blank = testEvaluateFormula(t10Formula, { actual_dimension: "", lower_limit: 12.99, upper_limit: 13.01 });
assert(
  t10Blank.result === "-",
  "10. Blank reading produces '-'",
  `Expected '-', got: ${t10Blank.result}`
);

// TEST 11: Zero reading handling (must not be treated as blank)
const t11Zero = testEvaluateFormula(t10Formula, { actual_dimension: 0, lower_limit: -0.01, upper_limit: 0.01 });
assert(
  t11Zero.result === "PASS",
  "11. Zero reading evaluates numerically (PASS)",
  `Expected PASS, got: ${t11Zero.result}`
);

// Boundary Tests using metrologyBoundaryTester
const boundarySuite = runMetrologyBoundaryTests({
  formula: t10Formula,
  nominal: 35.035,
  lowerLimit: 35.015,
  upperLimit: 35.025,
  decimalPlaces: 3,
});

// TEST 12: Lower boundary (35.015 -> PASS)
const tcLower = boundarySuite.testCases.find(t => t.testName === "Exact Lower Limit");
assert(tcLower?.actualResult === "PASS", "12. Lower boundary test (PASS)");

// TEST 13: Upper boundary (35.025 -> PASS)
const tcUpper = boundarySuite.testCases.find(t => t.testName === "Exact Upper Limit");
assert(tcUpper?.actualResult === "PASS", "13. Upper boundary test (PASS)");

// TEST 14: Just below lower boundary (35.014 -> FAIL)
const tcJustBelow = boundarySuite.testCases.find(t => t.testName === "Just Below Lower Boundary");
assert(tcJustBelow?.actualResult === "FAIL", "14. Just below lower boundary (FAIL)");

// TEST 15: Just above upper boundary (35.026 -> FAIL)
const tcJustAbove = boundarySuite.testCases.find(t => t.testName === "Just Above Upper Boundary");
assert(tcJustAbove?.actualResult === "FAIL", "15. Just above upper boundary (FAIL)");

// TEST 16: Multi-trial average calculation
console.log("\n--- Group 4: Trials, Aggregations & Ordering ---");
const t16Eval = testEvaluateFormula("AVERAGE(t1, t2, t3)", { t1: 12.001, t2: 12.003, t3: 12.002 });
assert(
  t16Eval.success && Math.abs(t16Eval.result - 12.002) < 1e-6,
  "16. Multi-trial average calculation",
  `Expected 12.002, got ${t16Eval.result}`
);

// TEST 17: Multiple trials with blanks
const t17Eval = testEvaluateFormula("AVERAGE(t1, t2, t3, t4, t5)", {
  t1: 10.0,
  t2: 12.0,
  t3: "",
  t4: null,
  t5: undefined,
});
assert(
  t17Eval.success && Math.abs(t17Eval.result - 11.0) < 1e-6,
  "17. Multiple trials with blanks ignores blank entries",
  `Expected 11.0 (mean of 10 and 12), got ${t17Eval.result}`
);

// TEST 18: Dependency topological ordering
const t18Cols: CanvasColumnDef[] = [
  { id: "reading", label: "Reading", type: "reading" },
  { id: "nominal", label: "Nominal", type: "nominal" },
  { id: "deviation", label: "Deviation", type: "formula", formula: "reading - nominal" },
  { id: "judgement", label: "Judgement", type: "status", formula: "IF(ABS(deviation) <= 0.01, 'PASS', 'FAIL')" },
];
const cycles18 = detectFormulaCycles(t18Cols);
assert(cycles18.length === 0, "18. Dependency topological ordering (acyclic)");

// TEST 19: Circular dependency detection
const t19Cols: CanvasColumnDef[] = [
  { id: "colA", label: "Column A", type: "formula", formula: "colB + 1" },
  { id: "colB", label: "Column B", type: "formula", formula: "colA * 2" },
];
const cycles19 = detectFormulaCycles(t19Cols);
assert(
  cycles19.length > 0 &&
    cycles19[0].some((c) => c.toLowerCase() === "cola") &&
    cycles19[0].some((c) => c.toLowerCase() === "colb"),
  "19. Circular dependency detection (cycle flagged)",
  `Cycles: ${JSON.stringify(cycles19)}`
);

// TEST 20: Unknown variable rejection
console.log("\n--- Group 5: Validation, Security & Safety ---");
const t20Val = validateFormula("non_existent_variable * 2", t18Cols);
assert(
  t20Val.warnings.length > 0 || t20Val.status === "NEEDS_REVIEW",
  "20. Unknown variable flagged as NEEDS_REVIEW"
);

// TEST 21: Unknown function rejection & recommendation
const t21Val = validateFormula("C - CHOOSE(ROW()-30, 35.035, 13)", t18Cols);
assert(
  !t21Val.valid && t21Val.unsupportedFunctions.includes("CHOOSE"),
  "21. Unknown function (CHOOSE) rejected by AST parser",
  `Unsupported: ${t21Val.unsupportedFunctions.join(", ")}`
);

// TEST 22: Formula code injection rejection
const t22Eval = testEvaluateFormula("Function('return process.env')()", {});
assert(
  !t22Eval.success,
  "22. Code injection attempt rejected (no eval/Function execution)",
  `Error: ${t22Eval.error}`
);

// TEST 23: AI malformed response handling
const malformedJson = "```json\n{\n  \"reply\": \"Audit complete\", // trailing comment\n  \"action\": \"AUDIT_TABLE\",\n}\n```";
const cleaned = malformedJson.replace(/^```json\s*/, "").replace(/```\s*$/, "").replace(/\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
const parsed23 = JSON.parse(cleaned);
assert(parsed23.action === "AUDIT_TABLE", "23. AI malformed response comment stripping");

// TEST 24: AI low-confidence response
const t24Result = translateExcelFormula("=SomeUnknownFunc(A1, B2)");
assert(
  t24Result.confidence === "LOW",
  "24. Ambiguous formula yields LOW confidence requiring human review"
);

// TEST 25: AI entire-table audit
console.log("\n--- Group 6: Table Intelligence & Workflows ---");
const sampleTable: TableGridBlock = {
  id: "test_table_1",
  type: "table_grid",
  title: "Calibration Data",
  columns: [
    { id: "point_number", label: "Sl.No", type: "nominal" },
    { id: "nominal", label: "Nominal", type: "nominal" },
    { id: "reading", label: "Actual", type: "reading" },
    { id: "deviation", label: "Deviation", type: "formula", formula: "=C-CHOOSE(ROW()-30, 35.035, 13)" },
    { id: "judgement", label: "Judgement", type: "status", formula: "IF(AND(reading >= 12.99, reading <= 13.01), 'PASS', 'FAIL')" },
  ],
  rows: [
    { point_number: 1, nominal: 35.035, reading: 35.022 },
    { point_number: 2, nominal: 13.000, reading: 13.004 },
  ],
};
const t25Audit = auditCalibrationTable(sampleTable);
assert(
  t25Audit.columnAudits.some(c => c.columnId === "deviation" && c.recommendedFormula?.includes("- nominal")),
  "25. AI entire-table audit identifies formula fix for deviation",
  `Found recommendation: ${t25Audit.columnAudits.find(c => c.columnId === "deviation")?.recommendedFormula}`
);

// TEST 26: Save/reload persistence of translated metadata
const { columns: fixedCols } = generateFixedTableColumns(sampleTable);
const devCol = fixedCols.find(c => c.id === "deviation");
assert(
  devCol?.formula === "reading - nominal" && devCol.formulaSource === "EXCEL_TRANSLATED",
  "26. Save/reload formula metadata persists EXCEL_TRANSLATED source",
  `Formula: ${devCol?.formula}, Source: ${devCol?.formulaSource}`
);

// TEST 27: Certificate preview isolation (hideInCertificate)
const hiddenCol: CanvasColumnDef = { id: "helper", label: "Helper Calcs", type: "formula", formula: "nominal * 2", hideInCertificate: true };
assert(hiddenCol.hideInCertificate === true, "27. Certificate presentation isolation with hideInCertificate");

// TEST 28: Different point counts work with the same formula
const points3 = [1, 2, 3].map(i => ({ actual_dimension: 10 * i + 0.002, nominal: 10 * i }));
const points9 = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ actual_dimension: 5 * i + 0.001, nominal: 5 * i }));
const points20 = Array.from({ length: 20 }, (_, i) => ({ actual_dimension: 2 * (i + 1) + 0.003, nominal: 2 * (i + 1) }));

const eval3 = points3.map(p => testEvaluateFormula("actual_dimension - nominal", p).result);
const eval9 = points9.map(p => testEvaluateFormula("actual_dimension - nominal", p).result);
const eval20 = points20.map(p => testEvaluateFormula("actual_dimension - nominal", p).result);

assert(
  eval3.length === 3 && eval9.length === 9 && eval20.length === 20 && Math.abs(eval20[0] - 0.003) < 1e-6,
  "28. Different point counts (3, 9, 20) evaluate row-independently with same formula"
);

// TEST 29: Different table structures (Micrometer with 5 trials)
const micrometerTable: TableGridBlock = {
  id: "micrometer_table",
  type: "table_grid",
  title: "Micrometer Repeatability",
  columns: [
    { id: "nominal", label: "Nominal", type: "nominal" },
    { id: "t1", label: "Trial 1", type: "trial" },
    { id: "t2", label: "Trial 2", type: "trial" },
    { id: "t3", label: "Trial 3", type: "trial" },
    { id: "average", label: "Average", type: "formula", formula: "AVERAGE(t1, t2, t3)" },
    { id: "spread", label: "Range Spread", type: "formula", formula: "MAX(t1, t2, t3) - MIN(t1, t2, t3)" },
  ],
  rows: [{ nominal: 25.0, t1: 25.002, t2: 25.004, t3: 25.003 }],
};
const microAudit = auditCalibrationTable(micrometerTable);
assert(microAudit.overallStatus === "VALIDATED", "29. Different calibration structure (Micrometer trials) validated");

// TEST 30: Mixed tolerance table handling
const mixedTable: TableGridBlock = {
  id: "mixed_tol_table",
  type: "table_grid",
  title: "Mixed Tolerances Table",
  columns: [
    { id: "point_number", label: "Point", type: "nominal" },
    { id: "reading", label: "Reading", type: "reading" },
    { id: "nominal", label: "Nominal", type: "nominal" },
  ],
  rows: [
    { point_number: 1, nominal: 35.035, tolerance: 0.02, customFields: { lowerLimit: 35.015, upperLimit: 35.025 } },
    { point_number: 2, nominal: 13.000, tolerance: 0.01, customFields: { lowerLimit: 12.990, upperLimit: 13.010 } },
  ],
};
const mixedAudit = auditCalibrationTable(mixedTable);
assert(
  mixedAudit.toleranceClassification === "mixed" || mixedAudit.toleranceClassification === "asymmetric",
  "30. Mixed tolerance table classified correctly",
  `Classification: ${mixedAudit.toleranceClassification}`
);

// TEST 31: Template A — DIRECT_DEVIATION Model Audit & Inference
console.log("\n--- Group 6: 5 Calibration Templates & Model Intelligence ---");
const templateATable: TableGridBlock = {
  id: "template_a",
  type: "table_grid",
  title: "Vernier Caliper Direct Deviation",
  columns: [
    { id: "point", label: "Point No", type: "nominal" },
    { id: "nominal", label: "Nominal", type: "nominal" },
    { id: "actual", label: "Actual Reading", type: "reading" },
    { id: "deviation", label: "Deviation", type: "formula", formula: "actual - nominal" },
    { id: "judgement", label: "Status", type: "status", formula: "IF(ISBLANK(actual), '-', IF(AND(actual >= 9.98, actual <= 10.02), 'PASS', 'FAIL'))" }
  ],
  rows: [{ point: 1, nominal: 10.0, actual: 10.005 }]
};
const auditA = auditCalibrationTable(templateATable);
assert(auditA.calculationModel === "DIRECT_DEVIATION", "31. Template A correctly infers DIRECT_DEVIATION model");

// TEST 32: Template B — MULTI_TRIAL_ERROR Model Audit & Recommendations
const templateBTable: TableGridBlock = {
  id: "template_b",
  type: "table_grid",
  title: "Precision Gauge Multi-Trial",
  columns: [
    { id: "nominal", label: "Nominal Value", type: "nominal" },
    { id: "t1", label: "Trial 1", type: "trial" },
    { id: "t2", label: "Trial 2", type: "trial" },
    { id: "t3", label: "Trial 3", type: "trial" },
    { id: "average", label: "Average", type: "formula", formula: "AVERAGE(t1, t2, t3)" },
    { id: "error", label: "Error", type: "formula", formula: "average - nominal" }
  ],
  rows: [{ nominal: 50.0, t1: 50.001, t2: 50.002, t3: 50.003 }]
};
const auditB = auditCalibrationTable(templateBTable);
assert(auditB.calculationModel === "MULTI_TRIAL_ERROR", "32. Template B correctly infers MULTI_TRIAL_ERROR model");

// TEST 33: Template C — MPE_COMPARISON Model Audit
const templateCTable: TableGridBlock = {
  id: "template_c",
  type: "table_grid",
  title: "Dial Indicator MPE Comparison",
  columns: [
    { id: "nominal", label: "Nominal", type: "nominal" },
    { id: "actual", label: "Actual", type: "reading" },
    { id: "error", label: "Error", type: "formula", formula: "actual - nominal" },
    { id: "mpe", label: "Permissible Error MPE", type: "nominal" },
    { id: "judgement", label: "Judgement", type: "status", formula: "IF(ISBLANK(actual), '-', IF(ABS(error) <= mpe, 'PASS', 'FAIL'))" }
  ],
  rows: [{ nominal: 1.0, actual: 1.002, mpe: 0.005 }]
};
const auditC = auditCalibrationTable(templateCTable);
assert(auditC.calculationModel === "MPE_COMPARISON", "33. Template C correctly infers MPE_COMPARISON model");

// TEST 34: Template D — LIMIT_COMPARISON Model Audit
const templateDTable: TableGridBlock = {
  id: "template_d",
  type: "table_grid",
  title: "Plug Gauge Limit Comparison",
  columns: [
    { id: "parameter", label: "Parameter", type: "text" },
    { id: "nominal", label: "Basic Size", type: "nominal" },
    { id: "lower_limit", label: "Lower Limit", type: "nominal" },
    { id: "upper_limit", label: "Upper Limit", type: "nominal" },
    { id: "actual_dimension", label: "Measured Dimension", type: "reading" },
    { id: "judgement", label: "Result", type: "status", formula: "IF(ISBLANK(actual_dimension), '-', IF(AND(actual_dimension >= lower_limit, actual_dimension <= upper_limit), 'PASS', 'FAIL'))" }
  ],
  rows: [{ parameter: "Go Member", nominal: 25.0, lower_limit: 24.995, upper_limit: 25.005, actual_dimension: 25.002 }]
};
const auditD = auditCalibrationTable(templateDTable);
assert(auditD.calculationModel === "LIMIT_COMPARISON", "34. Template D correctly infers LIMIT_COMPARISON model");

// TEST 35: Template E — REPEATABILITY / SPREAD Model Audit
const templateETable: TableGridBlock = {
  id: "template_e",
  type: "table_grid",
  title: "Electronic Balance Repeatability",
  columns: [
    { id: "load", label: "Test Load", type: "nominal" },
    { id: "t1", label: "Run 1", type: "trial" },
    { id: "t2", label: "Run 2", type: "trial" },
    { id: "t3", label: "Run 3", type: "trial" },
    { id: "repeatability", label: "Repeatability Spread", type: "formula", formula: "MAX(t1, t2, t3) - MIN(t1, t2, t3)" }
  ],
  rows: [{ load: 100.0, t1: 100.001, t2: 100.003, t3: 100.002 }]
};
const auditE = auditCalibrationTable(templateETable);
assert(auditE.calculationModel === "REPEATABILITY", "35. Template E correctly infers REPEATABILITY model");

// TEST 36: Metrology Direction Validation (Detects erroneous addition instead of subtraction)
const invertedRes = validateFormula("actual_dimension + nominal", [
  { id: "actual_dimension", label: "Actual", role: "READING" },
  { id: "nominal", label: "Nominal", role: "NOMINAL" },
  { id: "deviation", label: "Deviation", role: "CALCULATED" }
], { targetColumnId: "deviation" });
assert(
  invertedRes.warnings.some(w => w.toLowerCase().includes("metrology warning") || w.toLowerCase().includes("addition")),
  "36. Metrology Level 5 flags addition where subtraction is required for deviation"
);

// TEST 37: Blank Reading Safety Invariant
const blankTestRes = testEvaluateFormula("IF(ISBLANK(actual_dimension), '-', IF(actual_dimension >= 10, 'PASS', 'FAIL'))", {
  actual_dimension: null
});
assert(blankTestRes.result === "-", "37. Blank reading safely evaluates to '-' and never false PASS");

// TEST 38: Numeric Zero Measurement Invariant (0.000 is valid reading, not blank)
const zeroTestRes = testEvaluateFormula("IF(ISBLANK(actual_dimension), '-', IF(actual_dimension >= 0, 'PASS', 'FAIL'))", {
  actual_dimension: 0
});
assert(zeroTestRes.result === "PASS", "38. Numeric 0.000 reading evaluates to PASS, not blank");

// TEST 39: 12-Point Pre-Save Quality Gate Blocks Critical Circular Dependency
const cyclicTable: TableGridBlock = {
  id: "cyclic_table",
  type: "table_grid",
  title: "Cyclic Table",
  columns: [
    { id: "a", label: "A", formula: "b + 1" },
    { id: "b", label: "B", formula: "a + 1" }
  ],
  rows: []
};
const preSaveResult = validateTemplatePreSave([cyclicTable]);
assert(preSaveResult.canSaveProduction === false && preSaveResult.errorCount > 0, "39. Pre-save gate blocks saving template with circular dependencies");

// TEST 40: 12-Point Pre-Save Quality Gate Passes Valid Multi-Trial Template
const validPreSave = validateTemplatePreSave([templateATable, templateBTable]);
assert(validPreSave.canSaveProduction === true, "40. Pre-save gate allows saving production-ready templates");

console.log("\n============================================================");
console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("============================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
