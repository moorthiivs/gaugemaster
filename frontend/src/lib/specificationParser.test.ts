import { parseSpecification, evaluateJudgement } from "./specificationParser.js";

function runTests() {
  console.log("=== RUNNING SPECIFICATION PARSER & METROLOGY TESTS ===");

  const testCases = [
    {
      name: "Point 1: Shaft Ø35.035-0.02/-0.01",
      spec: "Shaft Ø35.035-0.02/-0.01",
      expNom: 35.035,
      expLowerTol: -0.02,
      expUpperTol: -0.01,
      readings: [
        { actual: 35.022, expDev: "-0.013", expStatus: "PASS" },
        { actual: 35.014, expDev: "-0.021", expStatus: "FAIL" },
        { actual: 35.015, expDev: "-0.020", expStatus: "PASS" },
        { actual: 35.025, expDev: "-0.010", expStatus: "PASS" },
        { actual: 35.026, expDev: "-0.009", expStatus: "FAIL" },
      ],
    },
    {
      name: "Point 2: Shaft Dist 13±0.01",
      spec: "Shaft Dist 13±0.01",
      expNom: 13,
      expLowerTol: -0.01,
      expUpperTol: 0.01,
      readings: [
        { actual: 13.004, expDev: "+0.004", expStatus: "PASS" },
        { actual: 12.989, expDev: "-0.011", expStatus: "FAIL" },
        { actual: 12.990, expDev: "-0.010", expStatus: "PASS" },
        { actual: 13.010, expDev: "+0.010", expStatus: "PASS" },
        { actual: 13.011, expDev: "+0.011", expStatus: "FAIL" },
      ],
    },
    {
      name: "Point 3: Shaft ID Ø12+0.018",
      spec: "Shaft ID Ø12+0.018",
      expNom: 12,
      expLowerTol: 0,
      expUpperTol: 0.018,
      readings: [
        { actual: 12.011, expDev: "+0.011", expStatus: "PASS" },
        { actual: 11.999, expDev: "-0.001", expStatus: "FAIL" },
        { actual: 12.000, expDev: "+0.000", expStatus: "PASS" },
        { actual: 12.018, expDev: "+0.018", expStatus: "PASS" },
        { actual: 12.019, expDev: "+0.019", expStatus: "FAIL" },
      ],
    },
    {
      name: "Point 4: Master Height 50.0±0.005",
      spec: "Master Height 50.0±0.005",
      expNom: 50.0,
      expLowerTol: -0.005,
      expUpperTol: 0.005,
      readings: [
        { actual: 50.002, expDev: "+0.002", expStatus: "PASS" },
      ],
    },
    {
      name: "Point 5: Master ID Ø12±0.005",
      spec: "Master ID Ø12±0.005",
      expNom: 12.0,
      expLowerTol: -0.005,
      expUpperTol: 0.005,
      readings: [
        { actual: 11.998, expDev: "-0.002", expStatus: "PASS" },
      ],
    },
    {
      name: "Point 6: Dial Holder OD Ø12-0.006/-0.017",
      spec: "Dial Holder OD Ø12-0.006/-0.017",
      expNom: 12.0,
      expLowerTol: -0.017,
      expUpperTol: -0.006,
      readings: [
        { actual: 11.988, expDev: "-0.012", expStatus: "PASS" },
        { actual: 11.982, expDev: "-0.018", expStatus: "FAIL" },
        { actual: 11.983, expDev: "-0.017", expStatus: "PASS" },
        { actual: 11.994, expDev: "-0.006", expStatus: "PASS" },
        { actual: 11.995, expDev: "-0.005", expStatus: "FAIL" },
      ],
    },
    {
      name: "Point 7: Taper Plug SR43.414±0.005",
      spec: "Taper Plug SR43.414±0.005",
      expNom: 43.414,
      expLowerTol: -0.005,
      expUpperTol: 0.005,
      readings: [
        { actual: 43.412, expDev: "-0.002", expStatus: "PASS" },
      ],
    },
    {
      name: "Point 8: Diameter Ø18-0.01/-0.02",
      spec: "Diameter Ø18-0.01/-0.02",
      expNom: 18.0,
      expLowerTol: -0.02,
      expUpperTol: -0.01,
      readings: [
        { actual: 17.985, expDev: "-0.015", expStatus: "PASS" },
      ],
    },
    {
      name: "Point 9: Taper top Distance 37±0.01",
      spec: "Taper top Distance 37±0.01",
      expNom: 37.0,
      expLowerTol: -0.01,
      expUpperTol: 0.01,
      readings: [
        { actual: 37.006, expDev: "+0.006", expStatus: "PASS" },
      ],
    },
    {
      name: "Blank Reading Test",
      spec: "Shaft Ø35.035-0.02/-0.01",
      expNom: 35.035,
      expLowerTol: -0.02,
      expUpperTol: -0.01,
      readings: [
        { actual: "", expDev: "-", expStatus: "-" },
        { actual: null, expDev: "-", expStatus: "-" },
        { actual: undefined, expDev: "-", expStatus: "-" },
      ],
    },
    {
      name: "Point 10: Range 12.000 - 12.018",
      spec: "12.000 - 12.018",
      expNom: 12.009,
      expLowerTol: -0.009,
      expUpperTol: 0.009,
      readings: [
        { actual: 12.009, expDev: "+0.000", expStatus: "PASS" },
        { actual: 12.000, expDev: "-0.009", expStatus: "PASS" },
        { actual: 12.018, expDev: "+0.009", expStatus: "PASS" },
        { actual: 11.999, expDev: "-0.010", expStatus: "FAIL" },
        { actual: 12.019, expDev: "+0.010", expStatus: "FAIL" },
      ],
    },
    {
      name: "Point 11: Range with description Shaft Ø12.000 to 12.018",
      spec: "Shaft Ø12.000 to 12.018",
      expNom: 12.009,
      expLowerTol: -0.009,
      expUpperTol: 0.009,
      readings: [
        { actual: 12.010, expDev: "+0.001", expStatus: "PASS" },
        { actual: 12.020, expDev: "+0.011", expStatus: "FAIL" },
      ],
    }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((tc) => {
    const parsed = parseSpecification(tc.spec);
    const nomDiff = Math.abs(parsed.nominal - tc.expNom);
    const lowTolDiff = Math.abs(parsed.lowerTolerance - tc.expLowerTol);
    const upTolDiff = Math.abs(parsed.upperTolerance - tc.expUpperTol);

    if (nomDiff < 1e-6 && lowTolDiff < 1e-6 && upTolDiff < 1e-6) {
      console.log(`[PASS] Specification Parsing: ${tc.name}`);
      passed++;
    } else {
      console.error(`[FAIL] Specification Parsing: ${tc.name}`, parsed);
      failed++;
    }

    tc.readings.forEach((r) => {
      const evalRes = evaluateJudgement(r.actual as any, parsed.nominal, parsed.lowerTolerance, parsed.upperTolerance);
      if (evalRes.deviationFormatted === r.expDev && evalRes.status === r.expStatus) {
        console.log(`  └─ [PASS] Reading ${r.actual} => Dev: ${evalRes.deviationFormatted}, Status: ${evalRes.status}`);
        passed++;
      } else {
        console.error(`  └─ [FAIL] Reading ${r.actual} => Got Dev: ${evalRes.deviationFormatted}, Status: ${evalRes.status}, Expected Dev: ${r.expDev}, Status: ${r.expStatus}`);
        failed++;
      }
    });
  });

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
