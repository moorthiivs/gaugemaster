/**
 * Maps any metrology status or judgement cell value to a normalized verdict.
 * Supports standard industrial terms:
 * - PASS / OK / NORMAL / ACCEPT -> 'pass'
 * - FAIL / NOT OK / REJECT / NG -> 'fail'
 * Returns null for blank, neutral, or non-verdict numeric values.
 */
export const getStatusVerdict = (val: any): "pass" | "fail" | null => {
  if (val === undefined || val === null || val === "" || val === "-") return null;
  const str = String(val).trim().toUpperCase();
  if (str === "PASS" || str === "OK" || str === "NORMAL" || str === "ACCEPT") {
    return "pass";
  }
  if (str === "FAIL" || str === "NOT OK" || str === "REJECT" || str === "NG") {
    return "fail";
  }
  return null;
};
