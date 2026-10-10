import { describe, it } from "node:test";
import assert from "node:assert";
import { getStatusVerdict } from "./statusVerdict";

describe("Formula-Driven Judgement Verdict & Badge Mapping", () => {
  it("maps all standard metrological PASS verdicts correctly", () => {
    assert.strictEqual(getStatusVerdict("PASS"), "pass");
    assert.strictEqual(getStatusVerdict("pass"), "pass");
    assert.strictEqual(getStatusVerdict("  Pass  "), "pass");
    assert.strictEqual(getStatusVerdict("OK"), "pass");
    assert.strictEqual(getStatusVerdict("ok"), "pass");
    assert.strictEqual(getStatusVerdict("NORMAL"), "pass");
    assert.strictEqual(getStatusVerdict("ACCEPT"), "pass");
  });

  it("maps all standard metrological FAIL verdicts correctly", () => {
    assert.strictEqual(getStatusVerdict("FAIL"), "fail");
    assert.strictEqual(getStatusVerdict("fail"), "fail");
    assert.strictEqual(getStatusVerdict("  Fail  "), "fail");
    assert.strictEqual(getStatusVerdict("NOT OK"), "fail");
    assert.strictEqual(getStatusVerdict("not ok"), "fail");
    assert.strictEqual(getStatusVerdict("REJECT"), "fail");
    assert.strictEqual(getStatusVerdict("NG"), "fail");
  });

  it("returns null for non-status numeric or empty formula outputs", () => {
    assert.strictEqual(getStatusVerdict(null), null);
    assert.strictEqual(getStatusVerdict(undefined), null);
    assert.strictEqual(getStatusVerdict(""), null);
    assert.strictEqual(getStatusVerdict("-"), null);
    assert.strictEqual(getStatusVerdict("0.026"), null);
    assert.strictEqual(getStatusVerdict(50.0), null);
    assert.strictEqual(getStatusVerdict("+0.005"), null);
  });
});
