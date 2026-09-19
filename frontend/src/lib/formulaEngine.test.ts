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

  console.log(`\n=== FINAL FORMULA ENGINE TEST RESULT: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
