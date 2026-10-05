import {
  evaluateCanvasRowFormulas,
  evaluateAllCanvasBlocks,
  buildRowContext,
  buildGlobalTablesContext,
  validateFormula,
  validateFormulaSyntax,
  evaluateFormulaExpression,
  getExcelColumnLetter,
  getExcelColumnIndex,
  parseCellCoordinate,
  expandCellRange,
  isStandardMetrologyVariable,
  resolveVariableSemanticRole,
  ensureTableKeys,
} from "./formulaEngine";
import { parseSpecification } from "./specificationParser";
import { resolveCertificateCellValue } from "./cellValueResolver";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("e:/Gaugemaster/gaugemaster/backend/node_modules/pg");

console.log("================================================================================");
console.log("GAUGEMASTER COMPREHENSIVE CALIBRATION TEMPLATE & WIZARD TEST SUITE");
console.log("================================================================================\n");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description: string, condition: boolean, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${description}`, details ? details : "");
    failedTests++;
  }
}

async function runTestSuite() {
  // ============================================================================
  // SUITE 1: SPECIFICATION, NOMINAL & TOLERANCE HIERARCHY
  // ============================================================================
  console.log("📌 SUITE 1: Specification, Nominal & Tolerance Hierarchy");

  // 1.1 Table Header Baseline
  const headerDefaultRow: any = { reading: 10.002 };
  const headerCols = [
    { id: "nominal", label: "Nominal", type: "number" as const },
    { id: "reading", label: "Reading", type: "reading" as const },
    { id: "error", label: "Error", type: "formula" as const, formula: "reading - nominal" },
    { id: "status", label: "Status", type: "status" as const, formula: "reading >= lowerLimit AND reading <= upperLimit" },
  ];
  // Table header nominal: 10.000, table header tolerance: 0.005
  const evaluatedHeaderRow = evaluateCanvasRowFormulas(headerDefaultRow, headerCols, 0.005, 3, 10.0);
  assert("1.1 Table Header Nominal inherited when row nominal is blank", evaluatedHeaderRow.nominal === 10, evaluatedHeaderRow);
  assert("1.1 Table Header Tolerance inherited (0.005)", evaluatedHeaderRow.tolerance === 0.005, evaluatedHeaderRow);
  assert("1.1 Error calculated with table header nominal: 10.002 - 10.000 = 0.002", Number(evaluatedHeaderRow.error) === 0.002 || evaluatedHeaderRow.deviation === "+0.002", evaluatedHeaderRow);
  assert("1.1 Verdict is PASS (0.002 <= 0.005)", evaluatedHeaderRow.status === "PASS", evaluatedHeaderRow);

  // 1.2 Row-level Override
  const rowOverrideRow: any = { nominal: 25.0, tolerance: 0.001, reading: 25.002 };
  const evaluatedRowOverride = evaluateCanvasRowFormulas(rowOverrideRow, headerCols, 0.005, 3, 10.0);
  assert("1.2 Row Nominal (25.0) overrides Table Header Nominal (10.0)", evaluatedRowOverride.nominal === 25, evaluatedRowOverride);
  assert("1.2 Row Tolerance (0.001) overrides Table Header Tolerance (0.005)", evaluatedRowOverride.tolerance === 0.001, evaluatedRowOverride);
  assert("1.2 Verdict is FAIL (error 0.002 > row tolerance 0.001)", evaluatedRowOverride.status === "FAIL", evaluatedRowOverride);

  // 1.3 Bilateral Specification String ("18.019±0.002")
  const specBilateral = parseSpecification("18.019±0.002");
  assert("1.3 Bilateral spec parsed nominal 18.019", specBilateral.nominal === 18.019, specBilateral);
  assert("1.3 Bilateral spec parsed upperTolerance 0.002", specBilateral.upperTolerance === 0.002, specBilateral);
  assert("1.3 Bilateral spec isMaxLimit is falsy", !specBilateral.isMaxLimit, specBilateral);

  const rowWithBilateralSpec: any = { specification: "18.019±0.002", reading: 18.020 };
  const evaluatedBilateral = evaluateCanvasRowFormulas(rowWithBilateralSpec, headerCols, 0.01, 3, 50.0);
  assert("1.3 Specification string nominal 18.019 overrides table header nominal 50.0", evaluatedBilateral.nominal === 18.019, evaluatedBilateral);
  assert("1.3 Specification string upperTolerance 0.002 overrides table header tolerance 0.01", evaluatedBilateral.upperTolerance === 0.002, evaluatedBilateral);
  assert("1.3 Bilateral reading 18.020 evaluates to PASS", evaluatedBilateral.status === "PASS", evaluatedBilateral);

  // 1.4 Unilateral Max Limit Specification ("0.003Max")
  const specMaxLimit = parseSpecification("0.003Max");
  assert("1.4 Max limit parsed nominal 0", specMaxLimit.nominal === 0, specMaxLimit);
  assert("1.4 Max limit parsed upperTolerance 0.003", specMaxLimit.upperTolerance === 0.003, specMaxLimit);
  assert("1.4 Max limit isMaxLimit is true", specMaxLimit.isMaxLimit === true, specMaxLimit);

  const rowMaxLimitPass: any = { specification: "0.003Max", reading: 0.0028, tolerance: 0.003 };
  const rowMaxLimitFail: any = { specification: "0.003Max", reading: 0.0035, tolerance: 0.003 };
  const evalMaxPass = evaluateCanvasRowFormulas(rowMaxLimitPass, headerCols, 0.01, 4, 10.0);
  const evalMaxFail = evaluateCanvasRowFormulas(rowMaxLimitFail, headerCols, 0.01, 4, 10.0);
  assert("1.4 Max limit 0.0028 <= 0.003 evaluates to PASS", evalMaxPass.status === "PASS", evalMaxPass);
  assert("1.4 Max limit 0.0035 > 0.003 evaluates to FAIL", evalMaxFail.status === "FAIL", evalMaxFail);

  // 1.5 Strict Precedence Hierarchy:
  // - If user entered explicit row.nominal (20.0), row.nominal is preserved
  // - If row.nominal is empty, specification string (30.0) is used
  // - If neither is present, table header default (10.0) is inherited
  const rowWithExplicitNominal: any = { nominal: 20.0, reading: 20.001 };
  const evalExplicit = evaluateCanvasRowFormulas(rowWithExplicitNominal, headerCols, 0.05, 3, 10.0);
  assert("1.5 Precedence: Explicit Row Nominal (20.0) is preserved over Table Nominal (10.0)", evalExplicit.nominal === 20.0, evalExplicit);

  const rowWithSpecOnly: any = { specification: "30.0±0.002", reading: 30.001 };
  const evalSpecOnly = evaluateCanvasRowFormulas(rowWithSpecOnly, headerCols, 0.05, 3, 10.0);
  assert("1.5 Precedence: Specification string nominal (30.0) is used when row nominal is unset", evalSpecOnly.nominal === 30.0, evalSpecOnly);

  const rowFallbackOnly: any = { reading: 10.001 };
  const evalFallbackOnly = evaluateCanvasRowFormulas(rowFallbackOnly, headerCols, 0.05, 3, 10.0);
  assert("1.5 Precedence: Table header default (10.0) is used when neither row nominal nor spec is set", evalFallbackOnly.nominal === 10.0, evalFallbackOnly);

  // ============================================================================
  // SUITE 2: COLUMN TYPES & METROLOGY ROLES
  // ============================================================================
  console.log("\n📌 SUITE 2: Column Types & Metrology Roles");

  // 2.1 Reading Column: Blank detection
  const blankRow: any = { nominal: 10.0 };
  const evalBlank = evaluateCanvasRowFormulas(blankRow, headerCols, 0.01, 3, 10.0);
  assert("2.1 Blank reading leaves error as '-'", evalBlank.error === "-", evalBlank);
  assert("2.1 Blank reading leaves status as '-'", evalBlank.status === "-", evalBlank);

  // 2.2 Trial Columns (t1, t2, t3) with Average & Range
  const trialCols = [
    { id: "nominal", label: "Nominal", type: "number" as const },
    { id: "actual_1", label: "Trial 1", type: "trial" as const },
    { id: "actual_2", label: "Trial 2", type: "trial" as const },
    { id: "actual_3", label: "Trial 3", type: "trial" as const },
    { id: "average", label: "Average", type: "formula" as const, formula: "AVERAGE(trials)" },
    { id: "error", label: "Error", type: "formula" as const, formula: "average - nominal" },
    { id: "status", label: "Status", type: "status" as const, formula: "reading >= lowerLimit AND reading <= upperLimit" },
  ];
  const trialRow: any = { nominal: 50.0, actual_1: 50.020, actual_2: 50.022, actual_3: 50.024, tolerance: 0.030 };
  const evalTrial = evaluateCanvasRowFormulas(trialRow, trialCols, 0.030, 3, 50.0);
  assert("2.2 AVERAGE(trials) evaluates accurately: (50.020+50.022+50.024)/3 = 50.022", evalTrial.average === "50.022", evalTrial);
  assert("2.2 Error from average evaluates: 50.022 - 50.0 = 0.022", Number(evalTrial.error) === 0.022 || evalTrial.deviation === "+0.022", evalTrial);
  assert("2.2 Verdict is PASS", evalTrial.status === "PASS", evalTrial);

  // 2.3 Manual Judgement Selection (No formula)
  const manualJudgementCols = [
    { id: "nominal", label: "Nominal", type: "number" as const },
    { id: "reading", label: "Reading", type: "reading" as const },
    { id: "status", label: "Status", type: "status" as const }, // No formula
  ];
  const manualPassRow: any = { nominal: 10, reading: 10, status: "PASS" };
  const evalManualPass = evaluateCanvasRowFormulas(manualPassRow, manualJudgementCols, 0.01, 3, 10);
  assert("2.3 Manual Judgement preserves technician selection (PASS)", evalManualPass.status === "PASS", evalManualPass);

  // 2.4 Text & Constant Number Columns
  const textCols = [
    { id: "point_name", label: "Location", type: "text" as const },
    { id: "std_temp", label: "Temperature (°C)", type: "number" as const },
    { id: "reading", label: "Reading", type: "reading" as const },
  ];
  const textRow: any = { point_name: "Top Bore Pin 1", std_temp: 20.0, reading: 12.001 };
  const evalText = evaluateCanvasRowFormulas(textRow, textCols, 0.01, 3);
  assert("2.4 Text column preserves string description", evalText.point_name === "Top Bore Pin 1", evalText);
  assert("2.4 Number constant preserves numeric value 20.0", evalText.std_temp === 20.0, evalText);

  // ============================================================================
  // SUITE 3: CELL-LEVEL VS COLUMN-LEVEL FORMULAS & EXCEL COORDINATES
  // ============================================================================
  console.log("\n📌 SUITE 3: Cell-Level vs Column-Level Formulas & Excel Coordinates");

  // 3.1 Column formula baseline
  const tableRows = [
    { nominal: 10.0, reading: 10.002, tolerance: 0.01 }, // Row 1 (A1=10, B1=10.002)
    { nominal: 20.0, reading: 20.004, tolerance: 0.01 }, // Row 2 (A2=20, B2=20.004)
    {
      nominal: 30.0,
      reading: 30.006,
      tolerance: 0.01,
      // 3.2 Cell formula on Row 3 overrides column formula: =AVERAGE(B1:B2)
      cellFormulas: { error: "=AVERAGE(B1:B2)" },
    },
  ];
  const tableCols = [
    { id: "nominal", label: "Nominal", type: "number" as const },
    { id: "reading", label: "Reading", type: "reading" as const },
    { id: "error", label: "Error", type: "formula" as const, formula: "reading - nominal" },
  ];

  // Evaluate Row 1 (uses column formula)
  const evalR1 = evaluateCanvasRowFormulas(tableRows[0], tableCols, 0.01, 3, 10.0, undefined, tableRows, 0);
  assert("3.1 Row 1 uses column formula: 10.002 - 10.000 = 0.002", Number(evalR1.error) === 0.002 || evalR1.deviation === "+0.002", evalR1);

  // Evaluate Row 3 (uses cell formula =AVERAGE(B1:B2))
  const evalR3 = evaluateCanvasRowFormulas(tableRows[2], tableCols, 0.01, 3, 30.0, undefined, tableRows, 2);
  // AVERAGE(B1, B2) = (10.002 + 20.004) / 2 = 15.003
  assert("3.2 Row 3 cell formula overrides column formula and calculates =AVERAGE(B1:B2) = 15.003", Number(evalR3.error) === 15.003 || evalR3.deviation === "15.003", evalR3);

  // 3.3 Excel Coordinate Range Expansion
  assert("3.3 expandCellRange('A1:A4')", JSON.stringify(expandCellRange("A1:A4")) === JSON.stringify(["A1", "A2", "A3", "A4"]));
  assert("3.3 expandCellRange('B1:D1')", JSON.stringify(expandCellRange("B1:D1")) === JSON.stringify(["B1", "C1", "D1"]));

  // 3.4 Excel Column Letter indexing
  assert("3.4 Column 0 is A", getExcelColumnLetter(0) === "A");
  assert("3.4 Column 1 is B", getExcelColumnLetter(1) === "B");
  assert("3.4 Column 25 is Z", getExcelColumnLetter(25) === "Z");
  assert("3.4 Column 26 is AA", getExcelColumnLetter(26) === "AA");

  // 3.5 Cross-Table Cell References
  const canvasBlocks: any[] = [
    {
      type: "table_grid",
      tableKey: "t1",
      title: "Table 1",
      columns: [
        { id: "nominal", label: "Nominal" },
        { id: "reading", label: "Reading" },
        { id: "error", label: "Error" },
      ],
      rows: [
        { nominal: 10, reading: 10.005, error: 0.005 },
        { nominal: 20, reading: 20.008, error: 0.008 },
      ],
    },
    {
      type: "table_grid",
      tableKey: "t2",
      title: "Table 2",
      columns: [
        { id: "nominal", label: "Nominal" },
        { id: "reading", label: "Reading" },
        { id: "error", label: "Error" },
      ],
      rows: [
        { nominal: 10, reading: 10.002, error: 0.002 },
        { nominal: 20, reading: 20.003, error: 0.003 },
      ],
    },
  ];
  const globalCtx = buildGlobalTablesContext(canvasBlocks);
  const rowInT3: any = { cellFormulas: { error: "=t1!C1 + t2!C1" } }; // 0.005 + 0.002 = 0.007
  const evalCross = evaluateCanvasRowFormulas(rowInT3, tableCols, 0.01, 3, 10.0, globalCtx, [rowInT3], 0);
  assert("3.5 Cross-table cell addition =t1!C1 + t2!C1 evaluates to 0.007", Number(evalCross.error) === 0.007 || evalCross.deviation === "0.007", evalCross);

  // 3.6 Cross-table Range Aggregation =AVERAGE(t1!C1:C2)
  const rowCrossAvg: any = { cellFormulas: { error: "=AVERAGE(t1!C1:C2)" } }; // (0.005 + 0.008)/2 = 0.0065
  const evalCrossAvg = evaluateCanvasRowFormulas(rowCrossAvg, tableCols, 0.01, 4, 10.0, globalCtx, [rowCrossAvg], 0);
  assert("3.6 Cross-table range =AVERAGE(t1!C1:C2) evaluates to 0.0065", Math.abs(Number(evalCrossAvg.error) - 0.0065) < 1e-4, evalCrossAvg);

  // ============================================================================
  // SUITE 4: CALIBRATION WIZARD LIVE TYPING & DRO SIMULATION
  // ============================================================================
  console.log("\n📌 SUITE 4: Calibration Wizard Live Typing & Keystroke Simulation");

  // Simulate technician typing "5" -> "50" -> "50." -> "50.005"
  const wizardCols = [
    { id: "nominal", label: "Nominal", type: "number" as const },
    { id: "reading", label: "Reading", type: "reading" as const },
    { id: "error", label: "Error", type: "formula" as const, formula: "reading - nominal" },
    { id: "status", label: "Status", type: "status" as const, formula: "reading >= lowerLimit AND reading <= upperLimit" },
  ];

  // Keystroke 1: "5"
  const k1 = evaluateCanvasRowFormulas({ nominal: 50.0, tolerance: 0.01, reading: "5" }, wizardCols, 0.01, 3, 50.0);
  assert("4.1 Keystroke '5': reading is retained", k1.reading === "5", k1);
  assert("4.1 Keystroke '5': error calculated (5 - 50 = -45.000)", Number(k1.error) === -45, k1);
  assert("4.1 Keystroke '5': status is FAIL", k1.status === "FAIL", k1);

  // Keystroke 2: "50"
  const k2 = evaluateCanvasRowFormulas({ nominal: 50.0, tolerance: 0.01, reading: "50" }, wizardCols, 0.01, 3, 50.0);
  assert("4.1 Keystroke '50': reading is retained", k2.reading === "50", k2);
  assert("4.1 Keystroke '50': error is 0.000", Number(k2.error) === 0, k2);
  assert("4.1 Keystroke '50': status is PASS", k2.status === "PASS", k2);

  // Keystroke 3: "50." (in-flight decimal typing)
  const k3 = evaluateCanvasRowFormulas({ nominal: 50.0, tolerance: 0.01, reading: "50." }, wizardCols, 0.01, 3, 50.0);
  assert("4.1 Keystroke '50.': decimal point is not stripped/locked", k3.reading === "50.", k3);

  // Keystroke 4: "50.005"
  const k4 = evaluateCanvasRowFormulas({ nominal: 50.0, tolerance: 0.01, reading: "50.005" }, wizardCols, 0.01, 3, 50.0);
  assert("4.1 Keystroke '50.005': error is 0.005", Number(k4.error) === 0.005, k4);
  assert("4.1 Keystroke '50.005': status is PASS (0.005 <= 0.01)", k4.status === "PASS", k4);

  // 4.2 Blank vs Zero: Zero reading ("0" or "0.000") is a VALID reading, not blank
  const kZero = evaluateCanvasRowFormulas({ nominal: 10.0, tolerance: 0.01, reading: "0" }, wizardCols, 0.01, 3, 10.0);
  assert("4.2 Zero reading '0' evaluates 0 - 10 = -10.000 (NOT '-')", Number(kZero.error) === -10, kZero);

  // 4.3 Backspace to empty string resets to '-'
  const kBackspace = evaluateCanvasRowFormulas({ nominal: 10.0, tolerance: 0.01, reading: "" }, wizardCols, 0.01, 3, 10.0);
  assert("4.3 Backspace to empty string resets error to '-'", kBackspace.error === "-", kBackspace);
  assert("4.3 Backspace to empty string resets status to '-'", kBackspace.status === "-", kBackspace);

  // ============================================================================
  // SUITE 5: CERTIFICATE PREVIEW & VALUE RESOLUTION
  // ============================================================================
  console.log("\n📌 SUITE 5: Certificate Preview & Value Resolution");

  // 5.1 Passing row resolution
  const passRow = { point_number: 1, nominal: 18.019, reading: 18.019, error: "+0.000", status: "PASS" };
  const resStatus = resolveCertificateCellValue(passRow, { id: "status", label: "Judgement" });
  assert("5.1 Certificate cell resolves PASS", resStatus === "PASS", resStatus);

  // 5.2 Failing row resolution
  const failRow = { point_number: 2, nominal: 18.019, reading: 18.025, error: "+0.006", status: "FAIL" };
  const resFail = resolveCertificateCellValue(failRow, { id: "status", label: "Judgement" });
  assert("5.2 Certificate cell resolves FAIL", resFail === "FAIL", resFail);

  // 5.3 Custom column precision formatting
  const precCol = { id: "error", label: "Deviation", decimal_places: 4 };
  const resPrec = resolveCertificateCellValue({ error: 0.0028 }, precCol);
  assert("5.3 Certificate cell formats to 4 decimals (0.0028)", resPrec === "0.0028", resPrec);

  // 5.4 Text column never dropped
  const textColDef = { id: "remark", label: "Visual Inspection", type: "text" };
  const resText = resolveCertificateCellValue({ remark: "Surface clean, no pitting" }, textColDef);
  assert("5.4 Descriptive text is preserved intact in certificate cell", resText === "Surface clean, no pitting", resText);

  // ============================================================================
  // SUITE 6: PRODUCTION REGRESSION INVARIANT SWEEP (ALL 67 DB TEMPLATES)
  // ============================================================================
  console.log("\n📌 SUITE 6: Production Regression Invariant Sweep (All 67 Live DB Templates)");

  const client = new Client({
    host: "127.0.0.1",
    port: 5432,
    user: "postgres",
    password: "root",
    database: "Atindia_Pro",
  });

  try {
    await client.connect();
    const res = await client.query("SELECT id, name, is_canvas_template, layout_blocks FROM calibration_templates ORDER BY name ASC;");
    const templates = res.rows;
    assert(`6.1 Connected to database: found ${templates.length} templates`, templates.length >= 60, templates.length);

    let totalBlocks = 0;
    let totalRowsEvaluated = 0;
    let evaluationErrors = 0;

    for (const t of templates) {
      if (!t.is_canvas_template || !Array.isArray(t.layout_blocks)) continue;
      try {
        const blocks = t.layout_blocks;
        ensureTableKeys(blocks);
        const globalCtx = buildGlobalTablesContext(blocks);

        for (const block of blocks) {
          if (block && block.type === "table_grid" && Array.isArray(block.rows) && Array.isArray(block.columns)) {
            totalBlocks++;
            const tol = block.tolerance ?? 0.02;
            const dec = block.decimal_places ?? 3;
            for (let rIdx = 0; rIdx < block.rows.length; rIdx++) {
              const r = block.rows[rIdx];
              if (r && !r.is_merged && !r.isMerged) {
                totalRowsEvaluated++;
                const evaluated = evaluateCanvasRowFormulas(
                  r,
                  block.columns,
                  tol,
                  dec,
                  block.nominal,
                  globalCtx,
                  block.rows,
                  rIdx
                );
                if (!evaluated) evaluationErrors++;
              }
            }
          } else if (block && block.type === "split_row" && Array.isArray(block.children)) {
            totalBlocks++;
            for (const child of block.children) {
              if (child && Array.isArray(child.rows) && Array.isArray(child.columns)) {
                const tol = child.tolerance ?? 0.02;
                const dec = child.decimal_places ?? 3;
                for (let rIdx = 0; rIdx < child.rows.length; rIdx++) {
                  const r = child.rows[rIdx];
                  if (r && !r.is_merged && !r.isMerged) {
                    totalRowsEvaluated++;
                    const evaluated = evaluateCanvasRowFormulas(
                      r,
                      child.columns,
                      tol,
                      dec,
                      child.nominal,
                      globalCtx,
                      child.rows,
                      rIdx
                    );
                    if (!evaluated) evaluationErrors++;
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        evaluationErrors++;
        console.error(`  ❌ Error evaluating template "${t.name}":`, err.message);
      }
    }

    assert(
      `6.2 Successfully evaluated ${totalRowsEvaluated} rows across ${totalBlocks} tables in ${templates.length} templates with 0 errors`,
      evaluationErrors === 0 && totalRowsEvaluated > 0,
      { evaluationErrors, totalRowsEvaluated }
    );
  } catch (err: any) {
    console.error("  ❌ Database connection error:", err.message);
  } finally {
    await client.end();
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n================================================================================");
  console.log(`TEST SUITE COMPLETE: ${totalTests} CHECKS | ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log(`SUCCESS RATE: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error("FATAL SUITE ERROR:", e);
  process.exit(1);
});
