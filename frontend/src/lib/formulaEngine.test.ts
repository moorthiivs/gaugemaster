import {
  safeEvaluateExpression,
  isBlankValue,
  syncTrialAliases,
  buildRowContext,
  getTopologicallySortedColumns,
  evaluateCanvasRowFormulas,
  parseFormulaAST,
  extractASTDependencies,
  evaluateAST,
  validateFormula,
  validateFormulaSyntax,
  testEvaluateFormula,
  resolveVariableSemanticRole,
  slugifyTableKey,
  ensureTableKeys,
  buildGlobalTablesContext,
  evaluateAllCanvasBlocks,
  resolveCrossTableReference,
} from "./formulaEngine.js";

function runTests() {
  console.log("=== RUNNING FORMULA ENGINE PRODUCTION AUDIT TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, details || "");
      failed++;
    }
  }

  // --- SECTION 1: Safe Expression Evaluator (Zero eval / Zero Function) ---
  console.log("\n--- SECTION 1: Safe Expression Parser & Security ---");

  // Arithmetic
  assert(safeEvaluateExpression("10 + 5").result === 15, "Arithmetic addition: 10 + 5 = 15");
  assert(safeEvaluateExpression("10.5 - 0.2").result === 10.3, "Arithmetic subtraction: 10.5 - 0.2 = 10.3");
  assert(safeEvaluateExpression("3 * 4").result === 12, "Arithmetic multiplication: 3 * 4 = 12");
  assert(safeEvaluateExpression("12 / 4").result === 3, "Arithmetic division: 12 / 4 = 3");
  assert(safeEvaluateExpression("2 ^ 3").result === 8, "Arithmetic power: 2 ^ 3 = 8");
  assert(safeEvaluateExpression("2 ** 3").result === 8, "Arithmetic power: 2 ** 3 = 8");
  assert(safeEvaluateExpression("10 % 3").result === 1, "Arithmetic modulo: 10 % 3 = 1");
  assert(safeEvaluateExpression("-0.015 - 0.005").result === -0.02, "Unary minus: -0.015 - 0.005 = -0.02");
  assert(Math.abs(safeEvaluateExpression("1e-3 + 2").result - 2.001) < 1e-9, "Scientific notation: 1e-3 + 2 = 2.001");
  assert(safeEvaluateExpression("(2 + 3) * 4").result === 20, "Parentheses: (2 + 3) * 4 = 20");

  // Comparisons & Excel operators
  assert(safeEvaluateExpression("10.005 >= 9.980").result === true, "Relational >= true: 10.005 >= 9.980");
  assert(safeEvaluateExpression("10.005 <= 9.980").result === false, "Relational <= false: 10.005 <= 9.980");
  assert(safeEvaluateExpression("10 = 10").result === true, "Excel equality: 10 = 10");
  assert(safeEvaluateExpression("10 <> 20").result === true, "Excel inequality: 10 <> 20");
  assert(safeEvaluateExpression("10 == 10").result === true, "Double equals: 10 == 10");
  assert(safeEvaluateExpression("10 !== 20").result === true, "Strict not equal: 10 !== 20");

  // Logical operators
  assert(
    safeEvaluateExpression("10.005 >= 9.980 AND 10.005 <= 10.020").result === true,
    "Logical AND: 10.005 >= 9.980 AND 10.005 <= 10.020"
  );
  assert(
    safeEvaluateExpression("10.005 < 9.980 OR 10.005 > 10.020").result === false,
    "Logical OR: false OR false = false"
  );

  // Functions
  assert(safeEvaluateExpression("ABS(-5.5)").result === 5.5, "ABS(-5.5) = 5.5");
  assert(safeEvaluateExpression("SQRT(16)").result === 4, "SQRT(16) = 4");
  assert(safeEvaluateExpression("ROUND(3.14159, 2)").result === 3.14, "ROUND(3.14159, 2) = 3.14");
  assert(safeEvaluateExpression("MIN(10, 5, 20)").result === 5, "MIN(10, 5, 20) = 5");
  assert(safeEvaluateExpression("MAX(10, 5, 20)").result === 20, "MAX(10, 5, 20) = 20");
  assert(safeEvaluateExpression("AVERAGE(10, 20, 30)").result === 20, "AVERAGE(10, 20, 30) = 20");
  assert(safeEvaluateExpression("AVG(10, 20, 30)").result === 20, "AVG(10, 20, 30) = 20");
  assert(safeEvaluateExpression("SUM(10, 20, 30)").result === 60, "SUM(10, 20, 30) = 60");
  assert(safeEvaluateExpression('IF(10 > 5, "PASS", "FAIL")').result === "PASS", 'IF(10 > 5, "PASS", "FAIL") = PASS');
  assert(safeEvaluateExpression('IF(10 < 5, "PASS", "FAIL")').result === "FAIL", 'IF(10 < 5, "PASS", "FAIL") = FAIL');
  assert(
    safeEvaluateExpression('IF(ABS(10.005 - 10.000) <= 0.02, "PASS", "FAIL")').result === "PASS",
    'Nested IF(ABS(...)) = PASS'
  );

  // Security: rejection of arbitrary code execution
  assert(safeEvaluateExpression("Function('return 1')()").success === false, "Reject Function() code injection");
  assert(safeEvaluateExpression("alert(1)").success === false, "Reject alert(1) injection");
  assert(safeEvaluateExpression("window.location = 'evil.com'").success === false, "Reject window.location injection");
  assert(safeEvaluateExpression("console.log(1)").success === false, "Reject console.log injection");

  // --- SECTION 2: Blank Value Detection (0 vs Blank) ---
  console.log("\n--- SECTION 2: Blank Value Detection ---");
  assert(isBlankValue(0) === false, "0 is NOT blank (valid zero reading)");
  assert(isBlankValue("0") === false, '"0" is NOT blank');
  assert(isBlankValue("0.000") === false, '"0.000" is NOT blank');
  assert(isBlankValue("") === true, '"" is blank');
  assert(isBlankValue("   ") === true, '"   " is blank');
  assert(isBlankValue("-") === true, '"-" is blank');
  assert(isBlankValue(undefined) === true, "undefined is blank");
  assert(isBlankValue(null) === true, "null is blank");
  assert(isBlankValue(10.025) === false, "10.025 is NOT blank");

  // --- SECTION 3: Trial Alias Synchronization & Detection ---
  console.log("\n--- SECTION 3: Trial Alias Sync ---");
  const rowWithTrial1 = { trial_1: "12.005", reading_2: "12.008" };
  syncTrialAliases(rowWithTrial1 as any);
  assert((rowWithTrial1 as any).t1 === "12.005", "Sync trial_1 -> t1");
  assert((rowWithTrial1 as any)["1"] === "12.005", "Sync trial_1 -> '1'");
  assert((rowWithTrial1 as any).col_1 === "12.005", "Sync trial_1 -> col_1");
  assert((rowWithTrial1 as any).t2 === "12.008", "Sync reading_2 -> t2");

  // --- SECTION 4: Topological Dependency Ordering ---
  console.log("\n--- SECTION 4: Topological Ordering ---");
  const testCols = [
    { id: "judgement", role: "JUDGEMENT", dependsOn: ["deviation"] },
    { id: "deviation", role: "CALCULATED", dependsOn: ["avg", "nominal"] },
    { id: "avg", role: "CALCULATED", dependsOn: ["t1", "t2"] },
  ];
  const sorted = getTopologicallySortedColumns(testCols);
  assert(sorted[0].id === "avg", "Topological order: avg evaluates 1st");
  assert(sorted[1].id === "deviation", "Topological order: deviation evaluates 2nd");
  assert(sorted[2].id === "judgement", "Topological order: judgement evaluates 3rd");

  // --- SECTION 5: evaluateCanvasRowFormulas with Blank Readings ---
  console.log("\n--- SECTION 5: Blank Reading Propagation ---");
  const tableCols = [
    { id: "nominal", label: "Nominal", type: "nominal" },
    { id: "t1", label: "Trial 1", type: "trial" },
    { id: "t2", label: "Trial 2", type: "trial" },
    { id: "avg", label: "Average", type: "formula", formula: "AVERAGE(t1, t2)", dependsOn: ["t1", "t2"] },
    { id: "deviation", label: "Deviation", type: "formula", formula: "avg - nominal", dependsOn: ["avg", "nominal"] },
    { id: "status", label: "Judgement", type: "status", formula: "reading >= lowerLimit AND reading <= upperLimit" },
  ];

  const blankRow = { nominal: 10.0, tolerance: 0.02 };
  const evaluatedBlank = evaluateCanvasRowFormulas(blankRow, tableCols, 0.02, 3);
  assert(evaluatedBlank.avg === "-", "Blank row: avg is '-'");
  assert(evaluatedBlank.deviation === "-", "Blank row: deviation is '-'");
  assert(evaluatedBlank.status === "-", "Blank row: status is '-'");
  assert(evaluatedBlank.lowerLimit === 9.98, "Blank row: lowerLimit calculated correctly (9.98)");
  assert(evaluatedBlank.upperLimit === 10.02, "Blank row: upperLimit calculated correctly (10.02)");

  // --- SECTION 6: evaluateCanvasRowFormulas with Real Readings ---
  console.log("\n--- SECTION 6: Real Reading Evaluation & Formulas ---");
  const passingRow = {
    nominal: 10.0,
    tolerance: 0.02,
    t1: "10.005",
    t2: "10.007",
  };
  const evaluatedPassing = evaluateCanvasRowFormulas(passingRow, tableCols, 0.02, 3);
  assert(evaluatedPassing.avg === "10.006", `Passing row: avg is 10.006 (got ${evaluatedPassing.avg})`);
  assert(evaluatedPassing.deviation === "+0.006", `Passing row: deviation is +0.006 (got ${evaluatedPassing.deviation})`);
  assert(evaluatedPassing.status === "PASS", `Passing row: status is PASS (got ${evaluatedPassing.status})`);

  const failingRow = {
    nominal: 10.0,
    tolerance: 0.02,
    t1: "10.025",
    t2: "10.035",
  };
  const evaluatedFailing = evaluateCanvasRowFormulas(failingRow, tableCols, 0.02, 3);
  assert(evaluatedFailing.avg === "10.030", `Failing row: avg is 10.030 (got ${evaluatedFailing.avg})`);
  assert(evaluatedFailing.deviation === "+0.030", `Failing row: deviation is +0.030 (got ${evaluatedFailing.deviation})`);
  assert(evaluatedFailing.status === "FAIL", `Failing row: status is FAIL (got ${evaluatedFailing.status})`);

  // --- SECTION 7: Custom AI Formulas Evaluation ---
  console.log("\n--- SECTION 7: Custom AI Formula Strings ---");
  const aiCustomCols = [
    { id: "nominal", label: "Nominal", type: "nominal" },
    { id: "t1", label: "T1", type: "trial" },
    { id: "t2", label: "T2", type: "trial" },
    { id: "t3", label: "T3", type: "trial" },
    { id: "range", label: "Range", type: "formula", formula: "MAX(t1, t2, t3) - MIN(t1, t2, t3)" },
    { id: "pct_err", label: "Pct Error", type: "formula", formula: "ROUND((t1 - nominal) / nominal * 100, 2)" },
    { id: "status", label: "Verdict", type: "status", formula: 'IF(ABS(t1 - nominal) <= tolerance, "PASS", "FAIL")' },
  ];

  const aiRow = {
    nominal: 100.0,
    tolerance: 1.0,
    t1: "100.5",
    t2: "100.8",
    t3: "100.2",
  };
  const evaluatedAi = evaluateCanvasRowFormulas(aiRow, aiCustomCols, 1.0, 2);
  assert(evaluatedAi.range === "0.6", `AI range formula MAX - MIN: 100.8 - 100.2 = 0.6 (got ${evaluatedAi.range})`);
  assert(evaluatedAi.pct_err === "0.5", `AI pct error formula: 0.5% (got ${evaluatedAi.pct_err})`);
  assert(evaluatedAi.status === "PASS", `AI IF formula verdict: PASS (got ${evaluatedAi.status})`);

  // --- SECTION 8: Immutability and Return Value ---
  console.log("\n--- SECTION 8: Immutability & Return Value ---");
  const inputRow = { nominal: 25.0, reading: "25.002", tolerance: 0.01 };
  const singleReadingCols = [
    { id: "nominal", label: "Nominal", type: "nominal" },
    { id: "reading", label: "Actual", type: "reading" },
    { id: "error", label: "Error", type: "formula", formula: "reading - nominal" },
    { id: "judgement", label: "Judgement", type: "status" },
  ];
  const resRow = evaluateCanvasRowFormulas(inputRow, singleReadingCols, 0.01, 3);
  assert(resRow !== null && typeof resRow === "object", "evaluateCanvasRowFormulas returns object");
  assert(resRow.error === 0.002, "Error numeric value 0.002");
  assert(resRow.deviation === "+0.002", "Deviation formatted value +0.002");
  assert(resRow.judgement === "PASS", "Judgement PASS");

  // --- SECTION 9: Authoritative Formula Validation & AST Parsing (Phases 1-6, 16) ---
  console.log("\n--- SECTION 9: Authoritative Formula Validation (actual_dimension - nominal) ---");
  const val1 = validateFormula("actual_dimension - nominal");
  assert(val1.valid === true, "actual_dimension - nominal is valid");
  assert(val1.syntaxValid === true, "actual_dimension - nominal syntax is valid");
  assert(val1.variablesValid === true, "actual_dimension - nominal variables are valid");
  assert(val1.status === "VALIDATED", "actual_dimension - nominal status is VALIDATED");
  assert(val1.errors.length === 0, "actual_dimension - nominal has 0 errors");
  assert(val1.warnings.length === 0, "actual_dimension - nominal has 0 warnings");
  assert(
    val1.dependencies.length === 2 &&
      val1.dependencies.includes("actual_dimension") &&
      val1.dependencies.includes("nominal"),
    "Dependencies extracted accurately: [actual_dimension, nominal]"
  );

  const testRes1 = testEvaluateFormula(
    "actual_dimension - nominal",
    { actual_dimension: 35.022, nominal: 35.035 },
    3
  );
  assert(testRes1.success === true, "testEvaluateFormula executes successfully");
  assert(testRes1.formatted === "-0.013", `Formula execution: 35.022 - 35.035 = -0.013 (got ${testRes1.formatted})`);

  const syntaxCheck = validateFormulaSyntax("actual_dimension - nominal");
  assert(syntaxCheck.valid === true, "validateFormulaSyntax passes for actual_dimension - nominal without warning");

  // --- SECTION 10: Standard Calibration Formulas (Phase 16) ---
  console.log("\n--- SECTION 10: Calibration Engineering Formulas ---");

  // Formula 2: Judgement comparison
  const judgeFormula = "actual_dimension >= lower_limit && actual_dimension <= upper_limit";
  const judgeVal = validateFormula(judgeFormula);
  assert(judgeVal.valid === true, "Judgement formula is valid");
  assert(judgeVal.status === "VALIDATED", "Judgement formula status is VALIDATED");

  const judgePass = testEvaluateFormula(
    judgeFormula,
    { actual_dimension: 35.022, lower_limit: 35.015, upper_limit: 35.025 }
  );
  assert(judgePass.formatted === "PASS", `Judgement in tolerance (35.022 in [35.015, 35.025]): PASS (got ${judgePass.formatted})`);

  const judgeFailLow = testEvaluateFormula(
    judgeFormula,
    { actual_dimension: 35.014, lower_limit: 35.015, upper_limit: 35.025 }
  );
  assert(judgeFailLow.formatted === "FAIL", `Judgement below lower limit (35.014): FAIL (got ${judgeFailLow.formatted})`);

  const judgeFailHigh = testEvaluateFormula(
    judgeFormula,
    { actual_dimension: 35.026, lower_limit: 35.015, upper_limit: 35.025 }
  );
  assert(judgeFailHigh.formatted === "FAIL", `Judgement above upper limit (35.026): FAIL (got ${judgeFailHigh.formatted})`);

  // Formula 3: Tolerance band width
  const tolBand = testEvaluateFormula("(upper_limit - lower_limit)", { upper_limit: 35.025, lower_limit: 35.015 }, 3);
  assert(tolBand.formatted === "0.01", `Tolerance width (35.025 - 35.015 = 0.01): got ${tolBand.formatted}`);

  // Formula 4: Repeated measurements average
  const avgFormula = "(t1 + t2 + t3) / 3";
  const avgRes = testEvaluateFormula(avgFormula, { t1: 10.01, t2: 10.02, t3: 10.03 }, 3);
  assert(avgRes.formatted === "10.02", `Average (10.01 + 10.02 + 10.03) / 3 = 10.02 (got ${avgRes.formatted})`);

  // Formula 5: Reading - nominal deviation
  const devRes = testEvaluateFormula("reading - nominal", { reading: 35.022, nominal: 35.035 }, 3);
  assert(devRes.formatted === "-0.013", `reading - nominal = -0.013 (got ${devRes.formatted})`);

  // Formula 6: Average - nominal deviation
  const avgDevRes = testEvaluateFormula("average - nominal", { average: 35.022, nominal: 35.035 }, 3);
  assert(avgDevRes.formatted === "-0.013", `average - nominal = -0.013 (got ${avgDevRes.formatted})`);

  // --- SECTION 11: Negative Tests (Phase 17) ---
  console.log("\n--- SECTION 11: Negative Tests & Syntax Rejection ---");
  assert(validateFormula("actual_dimension -").valid === false, "Reject dangling operator: actual_dimension -");
  assert(validateFormula("actual_dimension + )").valid === false, "Reject mismatched parentheses: actual_dimension + )");
  
  const unknownVarRes = validateFormula("unknown_variable - nominal");
  assert(unknownVarRes.variablesValid === false, "Flag unknown variable: unknown_variable");
  assert(unknownVarRes.status === "NEEDS_REVIEW", "Unknown variable marked NEEDS_REVIEW");

  const divZeroRes = testEvaluateFormula("actual_dimension / 0", { actual_dimension: 35.022 });
  assert(divZeroRes.success === false, "Reject division by zero in runtime preview");

  assert(validateFormula("Function('alert(1)')").valid === false, "Reject Function() call");
  assert(validateFormula("eval('alert(1)')").valid === false, "Reject eval() call");
  assert(validateFormula("window.location").valid === false, "Reject window.location");
  assert(validateFormula("foo.bar").valid === false, "Reject foo.bar dot notation");
  assert(validateFormula("unknown_function(actual_dimension)").valid === false, "Reject unknown_function()");

  // --- SECTION 12: Blank & Zero Tests (Phases 18, 19) ---
  console.log("\n--- SECTION 12: Blank Reading & Zero Handling ---");
  const blankEmpty = testEvaluateFormula("actual_dimension - nominal", { actual_dimension: "", nominal: 35.035 });
  assert(blankEmpty.formatted === "-", `Blank string reading produces '-' (got ${blankEmpty.formatted})`);

  const blankNull = testEvaluateFormula("actual_dimension - nominal", { actual_dimension: null, nominal: 35.035 });
  assert(blankNull.formatted === "-", `null reading produces '-' (got ${blankNull.formatted})`);

  const blankDash = testEvaluateFormula("actual_dimension - nominal", { actual_dimension: "-", nominal: 35.035 });
  assert(blankDash.formatted === "-", `'-' reading produces '-' (got ${blankDash.formatted})`);

  const zeroReading = testEvaluateFormula("actual_dimension - nominal", { actual_dimension: 0, nominal: 10.0 }, 2);
  assert(zeroReading.formatted === "-10", `Zero reading (0 - 10) produces -10, NOT '-' (got ${zeroReading.formatted})`);

  // --- SECTION 13: Long Multiline & Bracketed Formulas (Phases 20, 21) ---
  console.log("\n--- SECTION 13: Long Multiline & Bracketed Formulas ---");
  const longFormula = `IF(
    actual_dimension >= lower_limit &&
    actual_dimension <= upper_limit &&
    average >= nominal,
    "PASS",
    "FAIL"
  )`;

  const longVal = validateFormula(longFormula);
  assert(longVal.valid === true, "Long multiline formula parses and validates successfully");
  assert(
    longVal.dependencies.length === 5,
    `Extracts all 5 dependencies from multiline formula (got ${longVal.dependencies.join(", ")})`
  );

  const longExec = testEvaluateFormula(
    longFormula,
    {
      actual_dimension: 35.022,
      lower_limit: 35.015,
      upper_limit: 35.025,
      average: 35.036,
      nominal: 35.035,
    }
  );
  assert(longExec.formatted === "PASS", `Long formula evaluates to PASS (got ${longExec.formatted})`);

  const bracketedFormula = "[Reading 1] - [Nominal]";
  const bracketedVal = validateFormula(bracketedFormula, { availableColumns: ["Reading 1", "Nominal"] });
  assert(bracketedVal.valid === true, "Bracketed column formula [Reading 1] - [Nominal] is valid");
  assert(bracketedVal.dependencies.includes("Reading 1") && bracketedVal.dependencies.includes("Nominal"), "Bracketed dependencies extracted");

  // --- SECTION 14: Circular Dependency Detection ---
  console.log("\n--- SECTION 14: Circular Dependency Detection ---");
  const circVal = validateFormula("deviation + 1", { targetColumnId: "deviation" });
  assert(circVal.circularDependency === true, "Circular reference detected (deviation references deviation)");
  assert(circVal.valid === false, "Circular formula is marked invalid");

  // --- SECTION 15: Asymmetric Specification & Judgement with lower_limit/upper_limit ---
  console.log("\n--- SECTION 15: Asymmetric Specification & Judgement Dependencies ---");
  const asymTableCols = [
    { id: "point_number", label: "SL.NO.", type: "nominal" },
    { id: "required_dimension", label: "REQUIRED DIMENSION", type: "text" },
    { id: "actual_dimension", label: "ACTUAL DIMENSION", type: "reading" },
    { id: "deviation", label: "DEVIATION", type: "formula", formula: "actual_dimension - nominal", dependsOn: ["actual_dimension", "nominal"] },
    {
      id: "status",
      label: "JUDGEMENT",
      type: "status",
      formula: 'IF(ISBLANK(actual_dimension), "-", IF(AND(actual_dimension >= lower_limit, actual_dimension <= upper_limit), "PASS", "FAIL"))',
      dependsOn: ["actual_dimension", "lower_limit", "upper_limit"]
    }
  ];

  // Shaft Ø35.035-0.02/-0.01: lowerLimit=35.015, upperLimit=35.025
  const asymRowFail = evaluateCanvasRowFormulas({
    point_number: 1,
    required_dimension: "Shaft Ø35.035-0.02/-0.01",
    actual_dimension: "35.0353",
    tolerance: 0.01
  }, asymTableCols, 0.01, 3);
  assert(asymRowFail.status === "FAIL", `Asymmetric out-of-spec (35.0353 > 35.025) produces FAIL (got ${asymRowFail.status})`);
  assert(asymRowFail.deviation === "+0.000", `Deviation relative to nominal 35.035 (got ${asymRowFail.deviation})`);

  const asymRowPass = evaluateCanvasRowFormulas({
    point_number: 1,
    required_dimension: "Shaft Ø35.035-0.02/-0.01",
    actual_dimension: "35.020",
    tolerance: 0.01
  }, asymTableCols, 0.01, 3);
  assert(asymRowPass.status === "PASS", `Asymmetric in-spec (35.020 in [35.015, 35.025]) produces PASS (got ${asymRowPass.status})`);
  assert(asymRowPass.deviation === "-0.015", `Deviation is -0.015 (got ${asymRowPass.deviation})`);

  const asymRowBlank = evaluateCanvasRowFormulas({
    point_number: 1,
    required_dimension: "Shaft Ø35.035-0.02/-0.01",
    actual_dimension: "",
    tolerance: 0.01
  }, asymTableCols, 0.01, 3);
  assert(asymRowBlank.status === "-", `Blank reading produces '-' (got ${asymRowBlank.status})`);
  assert(asymRowBlank.deviation === "-", `Blank deviation produces '-' (got ${asymRowBlank.deviation})`);

  // --- SECTION 16: Multi-Keystroke Typing & Decimal Entry in Trial Columns ---
  console.log("\n--- SECTION 16: Multi-Keystroke Typing & Decimal Entry ---");

  const multiTrialCols = [
    { id: "sl_no", label: "SL.NO.", type: "number", role: "METADATA" },
    { id: "specification", label: "SPECIFICATION", type: "text", role: "SPECIFICATION" },
    { id: "nominal", label: "Nominal", type: "number", role: "NOMINAL" },
    { id: "lower_limit", label: "Lower Limit", type: "number", role: "LOWER_LIMIT" },
    { id: "upper_limit", label: "Upper Limit", type: "number", role: "UPPER_LIMIT" },
    { id: "actual_1", label: "ACTUAL 1st", type: "trial", role: "READING" },
    { id: "actual_2", label: "ACTUAL 2nd", type: "trial", role: "READING" },
    { id: "actual_3", label: "ACTUAL 3rd", type: "trial", role: "READING" },
    { id: "average", label: "AVARAGE", type: "formula", role: "CALCULATED" },
    { id: "deviation", label: "DEVIATION", type: "formula", role: "CALCULATED" },
    { id: "judgement", label: "JUDGEMENT", type: "status", role: "JUDGEMENT" }
  ];

  let testRow: any = {
    point_number: 1,
    specification: "50+0.047/+0.022",
    nominal: 50,
    lower_limit: 50.022,
    upper_limit: 50.047,
    actual_1: "",
    actual_2: "",
    actual_3: ""
  };

  // Keystroke 1: "5"
  testRow = { ...testRow, actual_1: "5" };
  testRow = evaluateCanvasRowFormulas(testRow, multiTrialCols, 0.025, 3);
  assert(testRow.actual_1 === "5", `Keystroke 1 retains "5" (got ${testRow.actual_1})`);
  assert(testRow.average === "5.000", `Average for 5 is 5.000 (got ${testRow.average})`);

  // Keystroke 2: "50" (must NOT be overwritten back to "5" by stale aliases)
  testRow = { ...testRow, actual_1: "50" };
  testRow = evaluateCanvasRowFormulas(testRow, multiTrialCols, 0.025, 3);
  assert(testRow.actual_1 === "50", `Keystroke 2 retains "50" without locking (got ${testRow.actual_1})`);
  assert(testRow.average === "50.000", `Average for 50 is 50.000 (got ${testRow.average})`);

  // Keystroke 3: "50." (trailing decimal point must NOT be stripped or locked)
  testRow = { ...testRow, actual_1: "50." };
  testRow = evaluateCanvasRowFormulas(testRow, multiTrialCols, 0.025, 3);
  assert(testRow.actual_1 === "50.", `Keystroke 3 retains "50." (got ${testRow.actual_1})`);

  // Keystroke 4: "50.035" (full decimal number)
  testRow = { ...testRow, actual_1: "50.035" };
  testRow = evaluateCanvasRowFormulas(testRow, multiTrialCols, 0.025, 3);
  assert(testRow.actual_1 === "50.035", `Keystroke 4 retains "50.035" (got ${testRow.actual_1})`);
  assert(testRow.average === "50.035", `Average is 50.035 (got ${testRow.average})`);
  assert(testRow.deviation === "+0.035", `Deviation is +0.035 (got ${testRow.deviation})`);
  assert(testRow.judgement === "PASS", `Judgement is PASS (got ${testRow.judgement})`);

  // Enter actual_2 = "50.030" and actual_3 = "50.031"
  testRow = { ...testRow, actual_2: "50.030" };
  testRow = evaluateCanvasRowFormulas(testRow, multiTrialCols, 0.025, 3);
  testRow = { ...testRow, actual_3: "50.031" };
  testRow = evaluateCanvasRowFormulas(testRow, multiTrialCols, 0.025, 3);
  // Average of (50.035 + 50.030 + 50.031) / 3 = 50.032
  assert(testRow.average === "50.032", `Multi-trial average is 50.032 (got ${testRow.average})`);
  assert(testRow.deviation === "+0.032", `Multi-trial deviation is +0.032 (got ${testRow.deviation})`);
  assert(testRow.judgement === "PASS", `Multi-trial judgement is PASS (got ${testRow.judgement})`);

  // Backspacing actual_1 to empty
  testRow = { ...testRow, actual_1: "" };
  testRow = evaluateCanvasRowFormulas(testRow, multiTrialCols, 0.025, 3);
  assert(testRow.actual_1 === "", `Backspacing actual_1 to empty string succeeds (got ${testRow.actual_1})`);

  // --- SECTION 17: Column-Wise Decimal Precision & Auto-Rounding ---
  console.log("\n--- SECTION 17: Column-Wise Decimal Precision & Auto-Rounding ---");

  // A. Auto-rounding helper test
  const roundToPrecision = (val: string, dec: number) => {
    const parsed = parseFloat(val.trim());
    if (isNaN(parsed)) return val;
    return dec === 0 ? String(Math.round(parsed)) : parsed.toFixed(dec);
  };

  assert(roundToPrecision("5.99999", 3) === "6.000", `5.99999 auto-rounds to 6.000 at 3 dec (got ${roundToPrecision("5.99999", 3)})`);
  assert(roundToPrecision("59.0000", 3) === "59.000", `59.0000 auto-rounds to 59.000 at 3 dec (got ${roundToPrecision("59.0000", 3)})`);
  assert(roundToPrecision("59.0000", 0) === "59", `59.0000 auto-rounds to 59 at 0 dec (got ${roundToPrecision("59.0000", 0)})`);
  assert(roundToPrecision("59.456", 1) === "59.5", `59.456 auto-rounds to 59.5 at 1 dec (got ${roundToPrecision("59.456", 1)})`);
  assert(roundToPrecision("50.00000", 2) === "50.00", `50.00000 auto-rounds to 50.00 at 2 dec (got ${roundToPrecision("50.00000", 2)})`);

  // B. Column-wise decimal precision overrides in evaluateCanvasRowFormulas
  const colWiseCols = [
    { id: "nominal", label: "NOMINAL", type: "nominal", role: "NOMINAL", decimal_places: 1 },
    { id: "actual_1", label: "ACTUAL 1", type: "trial", role: "READING", decimal_places: 3 },
    { id: "actual_2", label: "ACTUAL 2", type: "trial", role: "READING", decimal_places: 3 },
    { id: "average", label: "AVERAGE", type: "formula", role: "CALCULATED", decimal_places: 1 },
    { id: "deviation", label: "DEVIATION", type: "formula", role: "CALCULATED", decimal_places: 2 },
    { id: "custom_diff", label: "CUSTOM DIFF", type: "formula", role: "CALCULATED", formula: "actual_1 - nominal", decimal_places: 4 },
    { id: "judgement", label: "JUDGEMENT", type: "status", role: "JUDGEMENT" }
  ];

  let colWiseRow: any = {
    point_number: 1,
    nominal: 50,
    lower_limit: 49.95,
    upper_limit: 50.05,
    actual_1: "50.035",
    actual_2: "50.025"
  };

  const resColWise = evaluateCanvasRowFormulas(colWiseRow, colWiseCols, 0.05, 3);
  // Average of 50.035 and 50.025 = 50.03. With decimal_places = 1, it must be "50.0"
  assert(resColWise.average === "50.0", `Column-wise average override decimal_places: 1 produces 50.0 (got ${resColWise.average})`);
  // Deviation: 50.03 - 50 = +0.03. With decimal_places = 2, it must be "+0.03"
  assert(resColWise.deviation === "+0.03", `Column-wise deviation override decimal_places: 2 produces +0.03 (got ${resColWise.deviation})`);
  // Custom formula: 50.035 - 50 = 0.0350. With decimal_places = 4, it must be "0.0350"
  assert(resColWise.custom_diff === "0.0350", `Column-wise custom formula decimal_places: 4 produces 0.0350 (got ${resColWise.custom_diff})`);
  assert(resColWise.judgement === "PASS", `Judgement passes (got ${resColWise.judgement})`);

  // --- SECTION 18: Multi-Table Global Access, Vector Mathematics & Mixed Rows ---
  console.log("\n--- SECTION 18: Multi-Table Global Access, Vector Mathematics & Mixed Rows ---");

  // 1. Slugify & Table Key Auto-Generation
  assert(slugifyTableKey("Clock wise Direction") === "clock_wise_direction", "Slugify 'Clock wise Direction'");
  assert(slugifyTableKey("Counter clock wise direction") === "counter_clock_wise_direction", "Slugify 'Counter clock wise direction'");

  const rawBlocks = [
    { type: "table_grid", title: "Clock wise Direction", columns: [{ id: "error", label: "Error" }], rows: [] },
    { type: "table_grid", title: "Clock wise Direction", columns: [{ id: "error", label: "Error" }], rows: [] },
    { type: "split_row", children: [
      { type: "table_grid", title: "Summary", columns: [{ id: "val", label: "Value" }], rows: [] }
    ]}
  ];
  ensureTableKeys(rawBlocks);
  assert((rawBlocks[0] as any).tableKey === "clock_wise_direction", "ensureTableKeys sets tableKey for table 1");
  assert((rawBlocks[1] as any).tableKey === "clock_wise_direction_2", "ensureTableKeys de-duplicates collision with _2");
  assert((rawBlocks[2].children[0] as any).tableKey === "summary", "ensureTableKeys handles nested split_row table");

  // 2. Multi-Table Plunger Dial Gauge Metrology Setup
  const tableClockwise = {
    id: "table_cw",
    tableKey: "clockwise",
    type: "table_grid",
    title: "Clock wise Direction",
    tolerance: 0.02,
    decimal_places: 3,
    columns: [
      { id: "nominal", label: "Nominal", type: "nominal" },
      { id: "reading", label: "Reading", type: "reading" },
      { id: "error", label: "Error", type: "formula", formula: "reading - nominal" }
    ],
    rows: [
      { nominal: 1.0, reading: "1.002", error: "+0.002" },
      { nominal: 2.0, reading: "2.004", error: "+0.004" },
      { nominal: 3.0, reading: "3.006", error: "+0.006" },
    ]
  };

  const tableCounterClockwise = {
    id: "table_ccw",
    tableKey: "counter_clockwise",
    type: "table_grid",
    title: "Counter clock wise direction",
    tolerance: 0.02,
    decimal_places: 3,
    columns: [
      { id: "nominal", label: "Nominal", type: "nominal" },
      { id: "reading", label: "Reading", type: "reading" },
      { id: "error", label: "Error", type: "formula", formula: "reading - nominal" }
    ],
    rows: [
      { nominal: 1.0, reading: "1.001", error: "+0.001" },
      { nominal: 2.0, reading: "2.003", error: "+0.003" },
      { nominal: 3.0, reading: "3.005", error: "+0.005" },
    ]
  };

  const tableSummary = {
    id: "table_sum",
    tableKey: "summary",
    type: "table_grid",
    title: "Summary Parameters",
    tolerance: 0.02,
    decimal_places: 3,
    columns: [
      { id: "param", label: "Parameter", type: "text" },
      { id: "error_val", label: "Error Value", type: "reading" },
    ],
    rows: [
      { param: "Sensitivity 0.01Dial", error_val: "0.002" },
      { param: "Sensitivity 0.002Dial", error_val: "0.001" },
      { param: "Repeatability", error_val: "0.003" },
      {
        param: "Total Error",
        error_val: "-",
        cellFormulas: {
          error_val: "=SUM(clockwise.error, counter_clockwise.error)"
        }
      }
    ]
  };

  const allBlocks = [tableClockwise, tableCounterClockwise, tableSummary];

  // 3. Global Context Building & Cross-Table References
  const globalCtx = buildGlobalTablesContext(allBlocks);
  assert(Array.isArray(globalCtx["clockwise.error"]), "globalCtx has clockwise.error array");
  assert(globalCtx["clockwise.error"].length === 3, "clockwise.error has 3 items");
  assert(globalCtx["clockwise.error[0]"] === "+0.002", "clockwise.error[0] indexed reference");

  // 4. Expression Evaluation: SUM(table1.error, table2.error)
  const evalSumRes = testEvaluateFormula("SUM(clockwise.error, counter_clockwise.error)", globalCtx, 3);
  assert(evalSumRes.success === true, "SUM cross-table success");
  // Total = (0.002 + 0.004 + 0.006) + (0.001 + 0.003 + 0.005) = 0.012 + 0.009 = 0.021
  assert(evalSumRes.formatted === "0.021", `SUM(clockwise.error, counter_clockwise.error) === 0.021 (got ${evalSumRes.formatted})`);

  // 5. Vector Addition: SUM((clockwise.error) + (counter_clockwise.error))
  const evalVecRes = testEvaluateFormula("SUM((clockwise.error) + (counter_clockwise.error))", globalCtx, 3);
  assert(evalVecRes.success === true, "Vector sum cross-table success");
  assert(evalVecRes.formatted === "0.021", `SUM((clockwise.error) + (counter_clockwise.error)) === 0.021 (got ${evalVecRes.formatted})`);

  // 6. Safe Blank Propagation (Excel #VALUE! Prevention)
  const blankCW = {
    ...tableClockwise,
    rows: [
      { nominal: 1.0, reading: "", error: "-" },
      { nominal: 2.0, reading: "", error: "-" },
    ]
  };
  const blankCCW = {
    ...tableCounterClockwise,
    rows: [
      { nominal: 1.0, reading: "", error: "-" },
      { nominal: 2.0, reading: "", error: "-" },
    ]
  };
  const blankGlobalCtx = buildGlobalTablesContext([blankCW, blankCCW]);
  const blankVecRes = testEvaluateFormula("SUM((clockwise.error) + (counter_clockwise.error))", blankGlobalCtx, 3);
  assert(blankVecRes.formatted === "-", `Blank tables vector addition safely returns '-' without #VALUE! (got ${blankVecRes.formatted})`);

  // 7. evaluateAllCanvasBlocks & Mixed Rows in the same column
  evaluateAllCanvasBlocks(allBlocks);
  const evaluatedSummary = allBlocks[2];
  const summaryRows: any[] = evaluatedSummary.rows;
  assert(summaryRows[0].error_val === "0.002", "Row 1 retains manual input 0.002");
  assert(summaryRows[1].error_val === "0.001", "Row 2 retains manual input 0.001");
  assert(summaryRows[2].error_val === "0.003", "Row 3 retains manual input 0.003");
  assert(summaryRows[3].error_val === "0.021", `Row 4 calculates Total Error via formula: 0.021 (got ${summaryRows[3].error_val})`);

  // 8. Formula Validation of cross-table formula
  const valRes = validateFormula("=SUM(clockwise.error, counter_clockwise.error)");
  assert(valRes.valid === true, "validateFormula accepts cross-table SUM formula as valid");

  // 9. Reactive Re-evaluation Test: Table 1 (t1) reading change updates Table 3's =avg(t1.error)
  const t1 = {
    id: "table_1",
    tableKey: "t1",
    type: "table_grid",
    title: "Clock wise Direction",
    tolerance: 0.02,
    decimal_places: 3,
    columns: [
      { id: "nominal", label: "Nominal", type: "nominal" },
      { id: "reading", label: "Reading", type: "reading" },
      { id: "error", label: "Error", type: "formula", formula: "reading - nominal" }
    ],
    rows: [
      { nominal: 10, reading: "10.010", error: "+0.010" },
      { nominal: 20, reading: "20.030", error: "+0.030" },
    ]
  };

  const t3 = {
    id: "table_3",
    tableKey: "t3",
    type: "table_grid",
    title: "Evaluation Summary",
    tolerance: 0.02,
    decimal_places: 3,
    columns: [
      { id: "param", label: "Parameter", type: "text" },
      { id: "observed_error", label: "Observed Error", type: "reading" },
    ],
    rows: [
      { param: "Row 1", observed_error: "0.001" },
      { param: "Row 2", observed_error: "0.002" },
      { param: "Row 3", observed_error: "0.003" },
      {
        param: "Average Error",
        observed_error: "-",
        cellFormulas: {
          observed_error: "=avg(t1.error)"
        }
      }
    ]
  };

  const reactiveBlocks = [t1, t3];
  evaluateAllCanvasBlocks(reactiveBlocks);
  const t3RowsInit: any[] = t3.rows;
  assert(parseFloat(t3RowsInit[3].observed_error) === 0.02, `Initial =avg(t1.error) is 0.020 (got ${t3RowsInit[3].observed_error})`);

  // Simulate editing Table 1's reading
  t1.rows[1].reading = "20.050";
  evaluateAllCanvasBlocks(reactiveBlocks);
  const t3RowsUpdated: any[] = t3.rows;
  assert(parseFloat(t3RowsUpdated[3].observed_error) === 0.03, `Reactive re-evaluation: Table 1 reading change updates =avg(t1.error) to 0.030 (got ${t3RowsUpdated[3].observed_error})`);

  // 9b. Positional alias tests (t1, t2, t3) with vector formula =SUM((t1.error)+(t2.error))
  const posTable1 = {
    id: "clockwise_calibration",
    title: "Clock wise Direction",
    type: "table_grid",
    columns: [
      { id: "nominal", label: "Nominal", type: "nominal" },
      { id: "reading", label: "Reading", type: "reading" },
      { id: "error", label: "Error", type: "formula", formula: "reading - nominal" }
    ],
    rows: [
      { nominal: 0, reading: "0.005", error: 0.005 },
      { nominal: 1, reading: "1.002", error: 0.002 }
    ]
  };
  const posTable2 = {
    id: "counter_clockwise_calibration",
    title: "Counter Clockwise Direction",
    type: "table_grid",
    columns: [
      { id: "nominal", label: "Nominal", type: "nominal" },
      { id: "reading", label: "Reading", type: "reading" },
      { id: "error", label: "Error", type: "formula", formula: "reading - nominal" }
    ],
    rows: [
      { nominal: 0, reading: "0.003", error: 0.003 },
      { nominal: 1, reading: "1.001", error: 0.001 }
    ]
  };
  const posTable3 = {
    id: "pd_evaluation_summary",
    title: "Evaluation Summary",
    type: "table_grid",
    columns: [
      { id: "parameter", label: "Parameter", type: "text" },
      { id: "observed_error", label: "Observed Error", type: "reading" }
    ],
    rows: [
      {
        parameter: "Total Error",
        observed_error: "-",
        cellFormulas: {
          observed_error: "=SUM((t1.error)+(t2.error))"
        }
      }
    ]
  };

  const posBlocks = [posTable1, posTable2, posTable3];
  evaluateAllCanvasBlocks(posBlocks, { forceFull: true });
  assert(parseFloat(posTable3.rows[0].observed_error) === 0.011, `Positional alias vector =SUM((t1.error)+(t2.error)) evaluates correctly to 0.011 (got ${posTable3.rows[0].observed_error})`);

  // Now change reading in Table 2 (Counter Clockwise Direction) and re-evaluate
  posTable2.rows[0].reading = "0.010";
  posTable2.rows[0].error = 0.010;
  evaluateAllCanvasBlocks(posBlocks, { forceFull: true });
  assert(parseFloat(posTable3.rows[0].observed_error) === 0.018, `Updating Table 2 reading immediately recalculates =SUM((t1.error)+(t2.error)) to 0.018 (got ${posTable3.rows[0].observed_error})`);

  // 10. Performance & Keystroke Latency Benchmark
  console.log("\n--- SECTION 19: Performance & Keystroke Latency Benchmark ---");
  const benchT1 = {
    id: "table_1",
    tableKey: "t1",
    type: "table_grid",
    tolerance: 0.02,
    decimal_places: 3,
    columns: [
      { id: "nominal", label: "Nominal", type: "nominal" },
      { id: "reading", label: "Reading", type: "reading" },
      { id: "error", label: "Error", type: "formula", formula: "reading - nominal" }
    ],
    rows: Array.from({ length: 15 }, (_, i) => ({
      nominal: (i + 1) * 10,
      reading: ((i + 1) * 10.005).toFixed(3),
      error: "+0.005"
    }))
  };

  const benchT2 = {
    id: "table_2",
    tableKey: "t2",
    type: "table_grid",
    tolerance: 0.02,
    decimal_places: 3,
    columns: [
      { id: "nominal", label: "Nominal", type: "nominal" },
      { id: "reading", label: "Reading", type: "reading" },
      { id: "error", label: "Error", type: "formula", formula: "reading - nominal" }
    ],
    rows: Array.from({ length: 15 }, (_, i) => ({
      nominal: (i + 1) * 10,
      reading: ((i + 1) * 10.002).toFixed(3),
      error: "+0.002"
    }))
  };

  const benchT3 = {
    id: "table_3",
    tableKey: "t3",
    type: "table_grid",
    tolerance: 0.02,
    decimal_places: 3,
    columns: [
      { id: "param", label: "Parameter", type: "text" },
      { id: "observed_error", label: "Observed Error", type: "reading" },
    ],
    rows: [
      ...Array.from({ length: 14 }, (_, i) => ({
        param: `Point ${i + 1}`,
        observed_error: "0.001"
      })),
      {
        param: "Average Error",
        observed_error: "-",
        cellFormulas: {
          observed_error: "=avg(t1.error)"
        }
      }
    ]
  };

  const benchBlocks = [benchT1, benchT2, benchT3];
  evaluateAllCanvasBlocks(benchBlocks, { forceFull: true });

  // Simulate 100 consecutive keystrokes in Table 1, Row 0
  const startPerf = performance.now();
  for (let k = 0; k < 100; k++) {
    benchT1.rows[0].reading = (10 + (k * 0.001)).toFixed(3);
    evaluateAllCanvasBlocks(benchBlocks, { changedBlockIndex: 0, changedRowIndex: 0 });
  }
  const endPerf = performance.now();
  const totalMs = endPerf - startPerf;
  const avgMsPerKey = totalMs / 100;

  console.log(`[PERF] 100 keystrokes executed in ${totalMs.toFixed(2)}ms (Avg ${avgMsPerKey.toFixed(3)}ms per keypress)`);
  assert(avgMsPerKey < 10.0, `Average keystroke re-evaluation time (${avgMsPerKey.toFixed(3)}ms) is well under 10ms (Budget: 16.6ms for 60fps)`);
  assert(parseFloat(benchT3.rows[14].observed_error) > 0, `Table 3 avg(t1.error) reactive calculation is valid: ${benchT3.rows[14].observed_error}`);

  console.log(`\n=== FINAL FORMULA ENGINE TEST RESULT: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
