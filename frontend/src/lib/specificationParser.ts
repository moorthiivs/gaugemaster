/**
 * Specification Parser & Metrology Engine for Gaugemaster
 * Parses specification strings (e.g. "Shaft Ø35.035-0.02/-0.01", "Shaft Dist 13±0.01", "Ø12+0.018", "50.0-0.005", "Ø12-0.006/-0.017", "SR43.414±0.005", "Ø18-0.01/-0.02")
 * into structured numeric metrology metadata.
 */

export interface StructuredSpecification {
  specificationText: string;
  description?: string;
  nominal: number;
  lowerTolerance: number;
  upperTolerance: number;
  lowerLimit: number;
  upperLimit: number;
  unit: string;
  decimalPrecision: number;
  isValid: boolean;
}

/**
 * Counts decimal places in a string representation of a number.
 */
function getDecimalCount(numStr: string): number {
  if (!numStr) return 0;
  const clean = numStr.trim();
  const parts = clean.split(".");
  return parts.length > 1 ? parts[1].length : 0;
}

/**
 * Parses specification text into structured metrology metadata.
 */
export function parseSpecification(
  specText: string,
  defaultUnit: string = "mm",
  defaultTolerance: number = 0.02,
  defaultDecimalPlaces: number = 3
): StructuredSpecification {
  const emptyResult: StructuredSpecification = {
    specificationText: specText || "",
    nominal: 0,
    lowerTolerance: -defaultTolerance,
    upperTolerance: defaultTolerance,
    lowerLimit: -defaultTolerance,
    upperLimit: defaultTolerance,
    unit: defaultUnit,
    decimalPrecision: defaultDecimalPlaces,
    isValid: false,
  };

  if (!specText || typeof specText !== "string" || !specText.trim()) {
    return emptyResult;
  }

  const rawText = specText.trim();

  // Extract primary line for metrological evaluation, ignoring secondary component notes in parentheses or brackets
  const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let primaryTarget = rawLines[0] || rawText;
  for (const line of rawLines) {
    if (!line.startsWith("(") && !line.startsWith("[")) {
      primaryTarget = line;
      break;
    }
  }

  // Also remove trailing parenthetical/bracketed notes on the same line if any (e.g. "55.10-0.025 (58.9-0.025)")
  const cleanTarget = primaryTarget.replace(/\s*[\(\[].*?[\)\]]\s*$/, "").trim() || primaryTarget;

  const normalized = cleanTarget
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");

  // 1. PATTERN A: Symmetric tolerance: e.g. "Shaft Dist 13±0.01", "50.0±0.005", "SR43.414±0.005", "Ø35±0.01"
  const symRegex = /^(?:(.+?)\s+)?(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*±\s*(\d+(?:\.\d+)?)$/i;
  const symMatch = normalized.match(symRegex);
  if (symMatch) {
    const desc = symMatch[1]?.trim();
    const nomStr = symMatch[2];
    const tolStr = symMatch[3];
    const nom = parseFloat(nomStr);
    const tolVal = parseFloat(tolStr);
    const dec = Math.max(getDecimalCount(nomStr), getDecimalCount(tolStr), defaultDecimalPlaces);

    if (!isNaN(nom) && !isNaN(tolVal)) {
      return {
        specificationText: rawText,
        description: desc || undefined,
        nominal: nom,
        lowerTolerance: -tolVal,
        upperTolerance: tolVal,
        lowerLimit: parseFloat((nom - tolVal).toFixed(dec)),
        upperLimit: parseFloat((nom + tolVal).toFixed(dec)),
        unit: defaultUnit,
        decimalPrecision: dec,
        isValid: true,
      };
    }
  }

  // 2. PATTERN B: Dual asymmetric tolerances: e.g. "Shaft Ø35.035-0.02/-0.01", "Dial Holder OD Ø12-0.006/-0.017", "Diameter Ø18-0.01/-0.02", "10+0.02/+0.01"
  const dualRegex = /^(?:(.+?)\s+)?(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*([+-]\d+(?:\.\d+)?)\s*[\/\\]\s*([+-]\d+(?:\.\d+)?)$/i;
  const dualMatch = normalized.match(dualRegex);
  if (dualMatch) {
    const desc = dualMatch[1]?.trim();
    const nomStr = dualMatch[2];
    const v1Str = dualMatch[3];
    const v2Str = dualMatch[4];
    const nom = parseFloat(nomStr);
    const v1 = parseFloat(v1Str);
    const v2 = parseFloat(v2Str);
    const dec = Math.max(getDecimalCount(nomStr), getDecimalCount(v1Str), getDecimalCount(v2Str), defaultDecimalPlaces);

    if (!isNaN(nom) && !isNaN(v1) && !isNaN(v2)) {
      const lowerTol = Math.min(v1, v2);
      const upperTol = Math.max(v1, v2);
      return {
        specificationText: rawText,
        description: desc || undefined,
        nominal: nom,
        lowerTolerance: lowerTol,
        upperTolerance: upperTol,
        lowerLimit: parseFloat((nom + lowerTol).toFixed(dec)),
        upperLimit: parseFloat((nom + upperTol).toFixed(dec)),
        unit: defaultUnit,
        decimalPrecision: dec,
        isValid: true,
      };
    }
  }

  // 3. PATTERN C: Single positive-only tolerance: e.g. "Shaft ID Ø12+0.018", "12+0.018"
  const posRegex = /^(?:(.+?)\s+)?(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*\+(\d+(?:\.\d+)?)$/i;
  const posMatch = normalized.match(posRegex);
  if (posMatch) {
    const desc = posMatch[1]?.trim();
    const nomStr = posMatch[2];
    const tolStr = posMatch[3];
    const nom = parseFloat(nomStr);
    const tolVal = parseFloat(tolStr);
    const dec = Math.max(getDecimalCount(nomStr), getDecimalCount(tolStr), defaultDecimalPlaces);

    if (!isNaN(nom) && !isNaN(tolVal)) {
      return {
        specificationText: rawText,
        description: desc || undefined,
        nominal: nom,
        lowerTolerance: 0,
        upperTolerance: tolVal,
        lowerLimit: parseFloat(nom.toFixed(dec)),
        upperLimit: parseFloat((nom + tolVal).toFixed(dec)),
        unit: defaultUnit,
        decimalPrecision: dec,
        isValid: true,
      };
    }
  }

  // 4. PATTERN F: Range specification: e.g. "12.000 - 12.018", "Ø12.000 - 12.018", "12.000 to 12.018", "12.000 ~ 12.018"
  const rangeRegex = /^(?:(.+?)\s+)?(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*(?:-|–|—|\bto\b|~)\s*(-?\d+(?:\.\d+)?)$/i;
  const rangeMatch = normalized.match(rangeRegex);
  if (rangeMatch) {
    const desc = rangeMatch[1]?.trim();
    const v1Str = rangeMatch[2];
    const v2Str = rangeMatch[3];
    const v1 = parseFloat(v1Str);
    const v2 = parseFloat(v2Str);

    // Only treat as range if v2 > v1 (e.g. 12.000 - 12.018, where 12.018 > 12.000)
    // If v2 < v1, it is a single negative tolerance (e.g. 50.0 - 0.005), which Pattern D handles
    if (!isNaN(v1) && !isNaN(v2) && v2 > v1) {
      const dec = Math.max(getDecimalCount(v1Str), getDecimalCount(v2Str), defaultDecimalPlaces);
      const nom = parseFloat(((v1 + v2) / 2).toFixed(dec + 1));
      const lowerTol = parseFloat((v1 - nom).toFixed(dec + 1));
      const upperTol = parseFloat((v2 - nom).toFixed(dec + 1));

      return {
        specificationText: rawText,
        description: desc || undefined,
        nominal: nom,
        lowerTolerance: lowerTol,
        upperTolerance: upperTol,
        lowerLimit: v1,
        upperLimit: v2,
        unit: defaultUnit,
        decimalPrecision: dec,
        isValid: true,
      };
    }
  }

  // 5. PATTERN D: Single negative-only tolerance: e.g. "50.0-0.005", "Shaft 50.0-0.005"
  const negRegex = /^(?:(.+?)\s+)?(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*-(\d+(?:\.\d+)?)$/i;
  const negMatch = normalized.match(negRegex);
  if (negMatch) {
    const desc = negMatch[1]?.trim();
    const nomStr = negMatch[2];
    const tolStr = negMatch[3];
    const nom = parseFloat(nomStr);
    const tolVal = parseFloat(tolStr);
    const dec = Math.max(getDecimalCount(nomStr), getDecimalCount(tolStr), defaultDecimalPlaces);

    if (!isNaN(nom) && !isNaN(tolVal)) {
      return {
        specificationText: rawText,
        description: desc || undefined,
        nominal: nom,
        lowerTolerance: -tolVal,
        upperTolerance: 0,
        lowerLimit: parseFloat((nom - tolVal).toFixed(dec)),
        upperLimit: parseFloat(nom.toFixed(dec)),
        unit: defaultUnit,
        decimalPrecision: dec,
        isValid: true,
      };
    }
  }

  // 5. PATTERN E: Plain numeric dimension without tolerance operator: e.g. "35.035", "Shaft 35.035"
  const plainRegex = /^(?:(.+?)\s+)?(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)$/i;
  const plainMatch = normalized.match(plainRegex);
  if (plainMatch) {
    const desc = plainMatch[1]?.trim();
    const nomStr = plainMatch[2];
    const nom = parseFloat(nomStr);
    const dec = Math.max(getDecimalCount(nomStr), defaultDecimalPlaces);

    if (!isNaN(nom)) {
      return {
        specificationText: rawText,
        description: desc || undefined,
        nominal: nom,
        lowerTolerance: -defaultTolerance,
        upperTolerance: defaultTolerance,
        lowerLimit: parseFloat((nom - defaultTolerance).toFixed(dec)),
        upperLimit: parseFloat((nom + defaultTolerance).toFixed(dec)),
        unit: defaultUnit,
        decimalPrecision: dec,
        isValid: true,
      };
    }
  }

  return emptyResult;
}

/**
 * Evaluates whether an actual measurement reading passes or fails against structured limits.
 * Returns null if actual reading is blank / invalid.
 */
export function evaluateJudgement(
  actual: number | string | null | undefined,
  nominal: number,
  lowerTolerance: number,
  upperTolerance: number
): {
  hasReading: boolean;
  actual?: number;
  deviation?: number;
  deviationFormatted: string;
  isPass?: boolean;
  status: "PASS" | "FAIL" | "-";
} {
  if (actual === null || actual === undefined || String(actual).trim() === "" || String(actual).trim() === "-") {
    return {
      hasReading: false,
      deviationFormatted: "-",
      status: "-",
    };
  }

  const numActual = typeof actual === "number" ? actual : parseFloat(String(actual));
  if (isNaN(numActual)) {
    return {
      hasReading: false,
      deviationFormatted: "-",
      status: "-",
    };
  }

  const deviation = numActual - nominal;
  const lowerLimit = nominal + lowerTolerance;
  const upperLimit = nominal + upperTolerance;

  // 1e-9 precision buffer prevents floating point boundary anomalies (e.g. 0.1 + 0.2)
  const isPass = numActual >= (lowerLimit - 1e-9) && numActual <= (upperLimit + 1e-9);

  return {
    hasReading: true,
    actual: numActual,
    deviation,
    deviationFormatted: (deviation >= 0 ? "+" : "") + deviation.toFixed(3),
    isPass,
    status: isPass ? "PASS" : "FAIL",
  };
}
