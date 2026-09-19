/**
 * Gaugemaster Metrology & Calibration Intelligence
 * Metrology Boundary Tester
 *
 * Automated 4-point & boundary test runner for calibration judgement and acceptance formulas.
 * Evaluates:
 * 1. lowerLimit -> Expected PASS
 * 2. upperLimit -> Expected PASS
 * 3. lowerLimit - delta -> Expected FAIL
 * 4. upperLimit + delta -> Expected FAIL
 * 5. nominal -> Expected PASS
 * 6. blank reading -> Expected "-"
 * 7. zero reading -> Valid numeric comparison
 */

import { testEvaluateFormula } from "./formulaEngine";
import { CanvasColumnDef } from "../types/template";

export interface BoundaryTestCase {
  testName: string;
  description: string;
  testValue: number | string | null;
  expectedResult: string;
  actualResult?: any;
  passed: boolean;
  notes?: string;
}

export interface BoundaryTestReport {
  formula: string;
  nominal: number;
  lowerLimit: number;
  upperLimit: number;
  precision: number;
  toleranceType: "symmetric" | "asymmetric" | "positive_only" | "negative_only" | "range" | "unknown";
  testCases: BoundaryTestCase[];
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  summary: string;
}

/**
 * Determine precision delta for boundary tests (e.g. 0.001 if precision is 3 decimals).
 */
export function getPrecisionDelta(decimalPlaces?: number): number {
  const places = typeof decimalPlaces === "number" && decimalPlaces >= 0 && decimalPlaces <= 6 ? decimalPlaces : 3;
  return Math.pow(10, -places);
}

/**
 * Run automated boundary testing for a judgement formula against point specifications.
 */
export function runMetrologyBoundaryTests(params: {
  formula: string;
  nominal: number;
  lowerLimit: number;
  upperLimit: number;
  decimalPlaces?: number;
  readingVarName?: string;
  customScope?: Record<string, any>;
}): BoundaryTestReport {
  const {
    formula,
    nominal,
    lowerLimit,
    upperLimit,
    decimalPlaces = 3,
    readingVarName = "actual_dimension",
    customScope = {}
  } = params;

  const delta = getPrecisionDelta(decimalPlaces);
  const round = (val: number) => Number(val.toFixed(Math.min(decimalPlaces + 2, 6)));

  // Classify tolerance type
  const lowerTol = lowerLimit - nominal;
  const upperTol = upperLimit - nominal;
  let toleranceType: BoundaryTestReport["toleranceType"] = "unknown";

  if (Math.abs(Math.abs(lowerTol) - Math.abs(upperTol)) < 1e-6 && lowerTol < 0 && upperTol > 0) {
    toleranceType = "symmetric";
  } else if (lowerTol >= 0 && upperTol > 0) {
    toleranceType = "positive_only";
  } else if (lowerTol < 0 && upperTol <= 0) {
    toleranceType = "negative_only";
  } else {
    toleranceType = "asymmetric";
  }

  const baseScope: Record<string, any> = {
    nominal,
    target: nominal,
    dimension: nominal,
    lower_limit: lowerLimit,
    lowerlimit: lowerLimit,
    min_limit: lowerLimit,
    upper_limit: upperLimit,
    upperlimit: upperLimit,
    max_limit: upperLimit,
    tolerance: upperLimit - nominal,
    tol: upperLimit - nominal,
    ...customScope
  };

  const testSpecs: Array<{
    name: string;
    description: string;
    reading: any;
    expected: string;
  }> = [
    {
      name: "Nominal Dimension",
      description: `Testing exact nominal value (${nominal})`,
      reading: nominal,
      expected: "PASS"
    },
    {
      name: "Exact Lower Limit",
      description: `Testing lower tolerance boundary (${lowerLimit})`,
      reading: lowerLimit,
      expected: "PASS"
    },
    {
      name: "Exact Upper Limit",
      description: `Testing upper tolerance boundary (${upperLimit})`,
      reading: upperLimit,
      expected: "PASS"
    },
    {
      name: "Just Below Lower Boundary",
      description: `Testing out-of-spec lower value (${round(lowerLimit - delta)})`,
      reading: round(lowerLimit - delta),
      expected: "FAIL"
    },
    {
      name: "Just Above Upper Boundary",
      description: `Testing out-of-spec upper value (${round(upperLimit + delta)})`,
      reading: round(upperLimit + delta),
      expected: "FAIL"
    },
    {
      name: "Blank Reading",
      description: "Testing blank/unentered reading handling",
      reading: "",
      expected: "-"
    },
    {
      name: "Zero Reading",
      description: "Testing numeric zero measurement (must not be treated as blank)",
      reading: 0,
      expected: (0 >= lowerLimit && 0 <= upperLimit) ? "PASS" : "FAIL"
    }
  ];

  const testCases: BoundaryTestCase[] = [];

  for (const spec of testSpecs) {
    const scope: Record<string, any> = {
      ...baseScope,
      [readingVarName]: spec.reading,
      actual: spec.reading,
      reading: spec.reading,
      actual_dimension: spec.reading,
      measured: spec.reading,
      value: spec.reading,
      average: spec.reading,
      avg: spec.reading,
      mean: spec.reading,
      actual_1: spec.reading,
      actual_2: spec.reading,
      actual_3: spec.reading,
      reading_1: spec.reading,
      reading_2: spec.reading,
      reading_3: spec.reading,
      trial_1: spec.reading,
      trial_2: spec.reading,
      trial_3: spec.reading,
      t1: spec.reading,
      t2: spec.reading,
      t3: spec.reading,
    };

    // If reading is numeric, calculate deviation in scope
    if (typeof spec.reading === "number") {
      const dev = spec.reading - nominal;
      scope["deviation"] = dev;
      scope["error"] = dev;
      scope["diff"] = dev;
    }

    const evalResult = testEvaluateFormula(formula, scope);
    let actualValue: any = evalResult.result;

    // Normalize PASS / FAIL string results
    if (typeof actualValue === "string") {
      actualValue = actualValue.trim().toUpperCase();
    }

    const passed = evalResult.success && actualValue === spec.expected;

    testCases.push({
      testName: spec.name,
      description: spec.description,
      testValue: spec.reading,
      expectedResult: spec.expected,
      actualResult: evalResult.success ? actualValue : `Error: ${evalResult.error}`,
      passed,
      notes: evalResult.error ? `Evaluation Error: ${evalResult.error}` : undefined
    });
  }

  const passedCount = testCases.filter(t => t.passed).length;
  const totalCount = testCases.length;
  const allPassed = passedCount === totalCount;

  return {
    formula,
    nominal,
    lowerLimit,
    upperLimit,
    precision: delta,
    toleranceType,
    testCases,
    allPassed,
    passedCount,
    totalCount,
    summary: allPassed
      ? `All ${totalCount} boundary tests passed (${toleranceType} tolerance). Boundary and blank behaviors validated.`
      : `${passedCount}/${totalCount} boundary tests passed. Review boundary condition handling.`
  };
}
