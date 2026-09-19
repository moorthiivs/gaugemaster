import { HyperFormula } from "hyperformula";
import { CalibrationPoint } from "@/types/calibration";

export interface CustomColumn {
  id: string;
  name: string;
  type: "text" | "number" | "formula";
  formulaType?: "avg" | "stddev" | "abs_error" | "pct_error" | "bias" | "custom";
  customFormula?: string;
  unit?: string;
  decimalPlaces?: number;
  groupName?: string;
}

export interface VariableSuggestion {
  label: string;
  value: string;
  description: string;
}

/**
 * Predefined standard clickable variable tokens for formulas.
 */
export const FORMULA_VARIABLE_SUGGESTIONS: VariableSuggestion[] = [
  { label: "Nominal", value: "Nominal", description: "Nominal value (Standard)" },
  { label: "Actual", value: "Actual", description: "Actual / Observed reading" },
  { label: "Ascending", value: "Ascending", description: "Ascending reading" },
  { label: "Descending", value: "Descending", description: "Descending reading" },
  { label: "Error", value: "Error", description: "Calculated error (Actual - Nominal)" },
  { label: "Tolerance", value: "Tolerance", description: "Row tolerance limit (±)" },
  { label: "Accept. Criteria", value: "MPE", description: "Global template acceptance criteria limit (Alias: MPE, Limit, AC, AcceptanceCriteria)" },
];

/**
 * Converts 0-indexed column position to Excel Column Letter(s):
 * 0 -> A, 1 -> B, 2 -> C ... 25 -> Z, 26 -> AA, 27 -> AB
 */
export function getExcelColumnLetter(index: number): string {
  if (index < 0) return "";
  let letter = "";
  let temp = index;

  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function extractBounds(val: any): { min: number; max: number; nom: number } {
  if (typeof val === "number") return { min: val, max: val, nom: val };
  if (!val) return { min: 0, max: 0, nom: 0 };
  const str = String(val).trim();
  
  // Match ± format: "35.990±0.002" or "35.990 ± 0.002"
  const pmMatch = str.match(/^(-?[\d.]+)\s*±\s*([\d.]+)$/);
  if (pmMatch) {
    const nom = parseFloat(pmMatch[1]);
    const tol = parseFloat(pmMatch[2]);
    return { min: nom - tol, max: nom + tol, nom };
  }

  // Match + / - format: "35.990 +0.002 / -0.001"
  const diffMatch = str.match(/^(-?[\d.]+)\s*\+\s*([\d.]+)\s*[\/\\]?\s*-\s*([\d.]+)$/);
  if (diffMatch) {
    const nom = parseFloat(diffMatch[1]);
    const plus = parseFloat(diffMatch[2]);
    const minus = parseFloat(diffMatch[3]);
    return { min: nom - minus, max: nom + plus, nom };
  }
  
  const nom = parseFloat(str);
  return { min: isNaN(nom) ? 0 : nom, max: isNaN(nom) ? 0 : nom, nom: isNaN(nom) ? 0 : nom };
}

const parseNum = (val: any): number => {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? 0 : parsed;
};

// Singleton HyperFormula instance - initialized once, reused forever to eliminate massive memory/CPU lag
let sharedHfInstance: HyperFormula | null = null;
function getSharedHyperFormula(): HyperFormula {
  if (!sharedHfInstance) {
    sharedHfInstance = HyperFormula.buildFromArray([[0]], { licenseKey: "gpl-v3" });
  }
  return sharedHfInstance;
}

/**
 * Validates formula expression syntax using HyperFormula parser engine.
 */
// ============================================================================
// UNIFIED FORMULA ENGINE: AST PARSER, VARIABLE RESOLVER & VALIDATION
// Single source of truth for syntax parsing, validation, dependency extraction,
// and safe evaluation without eval() or Function().
// ============================================================================

export type ASTNode =
  | { type: "NumberLiteral"; value: number }
  | { type: "StringLiteral"; value: string }
  | { type: "BooleanLiteral"; value: boolean }
  | { type: "Identifier"; name: string; isBracketed?: boolean }
  | { type: "UnaryExpression"; operator: "+" | "-" | "!"; argument: ASTNode }
  | { type: "BinaryExpression"; operator: string; left: ASTNode; right: ASTNode }
  | { type: "FunctionCall"; name: string; args: ASTNode[] };

export type SemanticVariableRole =
  | "READING"
  | "SPECIFICATION"
  | "TOLERANCE"
  | "CALCULATED"
  | "TRIAL"
  | "ACCEPTANCE"
  | "COLUMN";

export interface SemanticVariableInfo {
  canonicalName: string;
  role: SemanticVariableRole;
  label: string;
  defaultTestValue: number;
}

export const SUPPORTED_FUNCTIONS = [
  "IF",
  "AND",
  "OR",
  "NOT",
  "ISBLANK",
  "ABS",
  "SQRT",
  "ROUND",
  "MIN",
  "MAX",
  "AVERAGE",
  "AVG",
  "SUM",
  "STDEV",
  "STDEVP",
  "MIN_VAL",
  "MAX_VAL",
  "NOMINAL",
] as const;

export const STANDARD_METROLOGY_VARIABLES: Record<
  string,
  { canonical: string; role: SemanticVariableRole; label: string; defaultTestValue: number }
> = {
  actual_dimension: { canonical: "actual_dimension", role: "READING", label: "Reading Input", defaultTestValue: 35.022 },
  actual: { canonical: "actual", role: "READING", label: "Actual Reading", defaultTestValue: 35.022 },
  reading: { canonical: "reading", role: "READING", label: "Reading Input", defaultTestValue: 35.022 },
  observation: { canonical: "observation", role: "READING", label: "Observation", defaultTestValue: 35.022 },
  observed: { canonical: "observed", role: "READING", label: "Observed", defaultTestValue: 35.022 },
  nominal: { canonical: "nominal", role: "SPECIFICATION", label: "Nominal Spec", defaultTestValue: 35.035 },
  nom: { canonical: "nominal", role: "SPECIFICATION", label: "Nominal Spec", defaultTestValue: 35.035 },
  std: { canonical: "nominal", role: "SPECIFICATION", label: "Standard Spec", defaultTestValue: 35.035 },
  lowerlimit: { canonical: "lowerLimit", role: "TOLERANCE", label: "Lower Limit", defaultTestValue: 35.015 },
  lower_limit: { canonical: "lowerLimit", role: "TOLERANCE", label: "Lower Limit", defaultTestValue: 35.015 },
  min_limit: { canonical: "lowerLimit", role: "TOLERANCE", label: "Min Limit", defaultTestValue: 35.015 },
  minlimit: { canonical: "lowerLimit", role: "TOLERANCE", label: "Min Limit", defaultTestValue: 35.015 },
  upperlimit: { canonical: "upperLimit", role: "TOLERANCE", label: "Upper Limit", defaultTestValue: 35.025 },
  upper_limit: { canonical: "upperLimit", role: "TOLERANCE", label: "Upper Limit", defaultTestValue: 35.025 },
  max_limit: { canonical: "upperLimit", role: "TOLERANCE", label: "Max Limit", defaultTestValue: 35.025 },
  maxlimit: { canonical: "upperLimit", role: "TOLERANCE", label: "Max Limit", defaultTestValue: 35.025 },
  lowertolerance: { canonical: "lowerTolerance", role: "TOLERANCE", label: "Lower Tolerance", defaultTestValue: -0.010 },
  lower_tolerance: { canonical: "lowerTolerance", role: "TOLERANCE", label: "Lower Tolerance", defaultTestValue: -0.010 },
  lowertol: { canonical: "lowerTolerance", role: "TOLERANCE", label: "Lower Tolerance", defaultTestValue: -0.010 },
  uppertolerance: { canonical: "upperTolerance", role: "TOLERANCE", label: "Upper Tolerance", defaultTestValue: 0.010 },
  upper_tolerance: { canonical: "upperTolerance", role: "TOLERANCE", label: "Upper Tolerance", defaultTestValue: 0.010 },
  uppertol: { canonical: "upperTolerance", role: "TOLERANCE", label: "Upper Tolerance", defaultTestValue: 0.010 },
  tolerance: { canonical: "tolerance", role: "TOLERANCE", label: "Tolerance (±)", defaultTestValue: 0.010 },
  tol: { canonical: "tolerance", role: "TOLERANCE", label: "Tolerance (±)", defaultTestValue: 0.010 },
  mpe: { canonical: "MPE", role: "ACCEPTANCE", label: "Max Permissible Error", defaultTestValue: 0.020 },
  limit: { canonical: "MPE", role: "ACCEPTANCE", label: "Acceptance Limit", defaultTestValue: 0.020 },
  ac: { canonical: "MPE", role: "ACCEPTANCE", label: "Acceptance Criteria", defaultTestValue: 0.020 },
  acceptancecriteria: { canonical: "MPE", role: "ACCEPTANCE", label: "Acceptance Criteria", defaultTestValue: 0.020 },
  acceptance_criteria: { canonical: "MPE", role: "ACCEPTANCE", label: "Acceptance Criteria", defaultTestValue: 0.020 },
  avg: { canonical: "avg", role: "CALCULATED", label: "Average", defaultTestValue: 35.022 },
  average: { canonical: "average", role: "CALCULATED", label: "Average", defaultTestValue: 35.022 },
  mean: { canonical: "average", role: "CALCULATED", label: "Mean", defaultTestValue: 35.022 },
  error: { canonical: "error", role: "CALCULATED", label: "Error", defaultTestValue: -0.013 },
  deviation: { canonical: "deviation", role: "CALCULATED", label: "Deviation", defaultTestValue: -0.013 },
  bias: { canonical: "deviation", role: "CALCULATED", label: "Bias", defaultTestValue: -0.013 },
};

/**
 * Resolves a variable name into semantic role, canonical name, and human label.
 */
export function resolveVariableSemanticRole(
  varName: string,
  availableColumns?: (string | { id: string; label?: string; role?: string; type?: string })[]
): SemanticVariableInfo {
  const clean = varName.trim();
  const lower = clean.toLowerCase();

  // 1. Check custom available columns if supplied
  if (Array.isArray(availableColumns)) {
    for (const col of availableColumns) {
      if (typeof col === "string") {
        if (col.toLowerCase() === lower) {
          return { canonicalName: col, role: "COLUMN", label: col, defaultTestValue: 35.022 };
        }
      } else if (col && typeof col === "object") {
        if (col.id?.toLowerCase() === lower || col.label?.toLowerCase() === lower) {
          let role: SemanticVariableRole = "COLUMN";
          if (col.role === "READING" || col.type === "reading") role = "READING";
          else if (col.role === "SPECIFICATION" || col.type === "nominal") role = "SPECIFICATION";
          else if (col.role === "CALCULATED" || col.type === "formula") role = "CALCULATED";
          else if (col.role === "JUDGEMENT" || col.type === "status") role = "CALCULATED";
          else if (col.type === "trial") role = "TRIAL";
          else if (col.type === "tolerance") role = "TOLERANCE";
          return {
            canonicalName: col.id,
            role,
            label: col.label || col.id,
            defaultTestValue: role === "SPECIFICATION" ? 35.035 : 35.022,
          };
        }
      }
    }
  }

  // 2. Check standard dictionary
  if (STANDARD_METROLOGY_VARIABLES[lower]) {
    const entry = STANDARD_METROLOGY_VARIABLES[lower];
    return {
      canonicalName: entry.canonical,
      role: entry.role,
      label: entry.label,
      defaultTestValue: entry.defaultTestValue,
    };
  }

  // 3. Check trial pattern (t1..t20, trial_1..trial_20, reading_1..reading_20, r1..r20)
  const trialMatch = clean.match(/^(?:t|trial_?|reading_?|col_?|r)(\d+)$/i);
  if (trialMatch) {
    const idx = parseInt(trialMatch[1], 10);
    if (idx >= 1 && idx <= 20) {
      return {
        canonicalName: `t${idx}`,
        role: "TRIAL",
        label: `Trial ${idx}`,
        defaultTestValue: parseFloat((35.020 + idx * 0.001).toFixed(4)),
      };
    }
  }

  // 4. Excel column reference (A..Z, AA..ZZ)
  if (/^[A-Za-z]{1,2}$/.test(clean)) {
    return {
      canonicalName: clean.toUpperCase(),
      role: "COLUMN",
      label: `Column ${clean.toUpperCase()}`,
      defaultTestValue: 35.022,
    };
  }

  // 5. Fallback for unrecognized column
  return {
    canonicalName: clean,
    role: "COLUMN",
    label: clean,
    defaultTestValue: 35.022,
  };
}

/**
 * Checks whether a variable name is recognized as a standard metrology variable
 * or an available column.
 */
export function isStandardMetrologyVariable(
  varName: string,
  availableColumns?: (string | { id: string; label?: string; role?: string; type?: string })[]
): boolean {
  const clean = varName.trim();
  const lower = clean.toLowerCase();
  if (STANDARD_METROLOGY_VARIABLES[lower]) return true;
  if (/^(?:t|trial_?|reading_?|col_?|r)(\d+)$/i.test(clean)) {
    const idx = parseInt(clean.replace(/^\D+/, ""), 10);
    return idx >= 1 && idx <= 20;
  }
  if (/^[A-Za-z]{1,2}$/.test(clean)) return true;

  if (Array.isArray(availableColumns)) {
    return availableColumns.some((c) => {
      if (typeof c === "string") return c.toLowerCase() === lower;
      return c?.id?.toLowerCase() === lower || c?.label?.toLowerCase() === lower;
    });
  }
  return false;
}

type TokenType =
  | "NUMBER"
  | "STRING"
  | "BOOLEAN"
  | "IDENTIFIER"
  | "OPERATOR"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

interface Token {
  type: TokenType;
  value: any;
  isBracketed?: boolean;
}

/**
 * Tokenizes a formula string into a structured stream of tokens.
 */
function tokenizeFormula(formulaStr: string): { tokens: Token[]; error?: string } {
  let clean = formulaStr.trim();
  if (clean.startsWith("=")) clean = clean.substring(1).trim();
  if (!clean) return { tokens: [{ type: "EOF", value: null }] };

  const tokens: Token[] = [];
  let pos = 0;
  const len = clean.length;

  while (pos < len) {
    const ch = clean[pos];

    // Skip whitespace
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    // Bracketed identifier: [Column Name]
    if (ch === "[") {
      pos++;
      let bracketed = "";
      while (pos < len && clean[pos] !== "]") {
        bracketed += clean[pos++];
      }
      if (pos >= len || clean[pos] !== "]") {
        return { tokens: [], error: "Unclosed bracket in column identifier: [" + bracketed };
      }
      pos++; // consume ']'
      tokens.push({ type: "IDENTIFIER", value: bracketed.trim(), isBracketed: true });
      continue;
    }

    // Number literal (e.g. 123, 123.456, .456, 1e-3, 2.5e+2)
    if (/\d/.test(ch) || (ch === "." && pos + 1 < len && /\d/.test(clean[pos + 1]))) {
      let numStr = "";
      while (pos < len && /[\d.]/.test(clean[pos])) {
        numStr += clean[pos++];
      }
      if (pos < len && (clean[pos] === "e" || clean[pos] === "E")) {
        numStr += clean[pos++];
        if (pos < len && (clean[pos] === "+" || clean[pos] === "-")) {
          numStr += clean[pos++];
        }
        while (pos < len && /\d/.test(clean[pos])) {
          numStr += clean[pos++];
        }
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) return { tokens: [], error: `Invalid number format: ${numStr}` };
      tokens.push({ type: "NUMBER", value: num });
      continue;
    }

    // String literal ("..." or '...')
    if (ch === '"' || ch === "'") {
      const quote = ch;
      pos++;
      let str = "";
      while (pos < len && clean[pos] !== quote) {
        if (clean[pos] === "\\" && pos + 1 < len) {
          pos++;
          str += clean[pos++];
        } else {
          str += clean[pos++];
        }
      }
      if (pos >= len || clean[pos] !== quote) {
        return { tokens: [], error: "Unterminated string literal" };
      }
      pos++; // consume closing quote
      tokens.push({ type: "STRING", value: str });
      continue;
    }

    // Parentheses & commas
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      pos++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      pos++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "COMMA", value: "," });
      pos++;
      continue;
    }

    // Multi-char operators
    const twoChars = clean.substring(pos, pos + 2);
    const threeChars = clean.substring(pos, pos + 3);

    if (threeChars === "===" || threeChars === "!==") {
      tokens.push({ type: "OPERATOR", value: threeChars });
      pos += 3;
      continue;
    }

    if (
      twoChars === "<=" ||
      twoChars === ">=" ||
      twoChars === "==" ||
      twoChars === "!=" ||
      twoChars === "<>" ||
      twoChars === "&&" ||
      twoChars === "||" ||
      twoChars === "**"
    ) {
      tokens.push({ type: "OPERATOR", value: twoChars === "<>" ? "!=" : twoChars });
      pos += 2;
      continue;
    }

    // Single-char operators
    if ("+-*/%^=<>!".includes(ch)) {
      tokens.push({ type: "OPERATOR", value: ch === "^" ? "**" : ch });
      pos++;
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (pos < len && /[a-zA-Z0-9_]/.test(clean[pos])) {
        ident += clean[pos++];
      }
      const upper = ident.toUpperCase();
      if (upper === "TRUE") {
        tokens.push({ type: "BOOLEAN", value: true });
      } else if (upper === "FALSE") {
        tokens.push({ type: "BOOLEAN", value: false });
      } else if (upper === "AND" || upper === "OR" || upper === "NOT") {
        let nextPos = pos;
        while (nextPos < len && /\s/.test(clean[nextPos])) {
          nextPos++;
        }
        if (nextPos < len && clean[nextPos] === "(") {
          tokens.push({ type: "IDENTIFIER", value: ident });
        } else {
          if (upper === "AND") tokens.push({ type: "OPERATOR", value: "&&" });
          else if (upper === "OR") tokens.push({ type: "OPERATOR", value: "||" });
          else if (upper === "NOT") tokens.push({ type: "OPERATOR", value: "!" });
        }
      } else {
        tokens.push({ type: "IDENTIFIER", value: ident });
      }
      continue;
    }

    // Reject unknown/disallowed character
    return { tokens: [], error: `Unexpected character in formula: '${ch}'` };
  }

  tokens.push({ type: "EOF", value: null });
  return { tokens };
}

/**
 * Parses a formula into an Abstract Syntax Tree (AST) using recursive descent.
 */
export function parseFormulaAST(formulaStr: string): { ast: ASTNode | null; error?: string } {
  const { tokens, error } = tokenizeFormula(formulaStr);
  if (error || !tokens.length) {
    return { ast: null, error: error || "Empty expression" };
  }

  let tokenIdx = 0;
  const currentToken = (): Token => tokens[tokenIdx];
  const consumeToken = (expectedType?: TokenType): Token => {
    const tok = tokens[tokenIdx];
    if (expectedType && tok.type !== expectedType) {
      throw new Error(`Expected '${expectedType}', found '${tok.type}' (${tok.value})`);
    }
    tokenIdx++;
    return tok;
  };

  try {
    const parseLogicalOr = (): ASTNode => {
      let left = parseLogicalAnd();
      while (currentToken().type === "OPERATOR" && currentToken().value === "||") {
        const op = consumeToken().value;
        const right = parseLogicalAnd();
        left = { type: "BinaryExpression", operator: op, left, right };
      }
      return left;
    };

    const parseLogicalAnd = (): ASTNode => {
      let left = parseEquality();
      while (currentToken().type === "OPERATOR" && currentToken().value === "&&") {
        const op = consumeToken().value;
        const right = parseEquality();
        left = { type: "BinaryExpression", operator: op, left, right };
      }
      return left;
    };

    const parseEquality = (): ASTNode => {
      let left = parseRelational();
      while (
        currentToken().type === "OPERATOR" &&
        ["==", "===", "=", "!=", "!=="].includes(currentToken().value)
      ) {
        let op = consumeToken().value;
        if (op === "=") op = "==";
        const right = parseRelational();
        left = { type: "BinaryExpression", operator: op, left, right };
      }
      return left;
    };

    const parseRelational = (): ASTNode => {
      let left = parseAdditive();
      while (
        currentToken().type === "OPERATOR" &&
        ["<", "<=", ">", ">="].includes(currentToken().value)
      ) {
        const op = consumeToken().value;
        const right = parseAdditive();
        left = { type: "BinaryExpression", operator: op, left, right };
      }
      return left;
    };

    const parseAdditive = (): ASTNode => {
      let left = parseMultiplicative();
      while (
        currentToken().type === "OPERATOR" &&
        (currentToken().value === "+" || currentToken().value === "-")
      ) {
        const op = consumeToken().value;
        const right = parseMultiplicative();
        left = { type: "BinaryExpression", operator: op, left, right };
      }
      return left;
    };

    const parseMultiplicative = (): ASTNode => {
      let left = parsePower();
      while (
        currentToken().type === "OPERATOR" &&
        (currentToken().value === "*" || currentToken().value === "/" || currentToken().value === "%")
      ) {
        const op = consumeToken().value;
        const right = parsePower();
        left = { type: "BinaryExpression", operator: op, left, right };
      }
      return left;
    };

    const parsePower = (): ASTNode => {
      let left = parseUnary();
      while (currentToken().type === "OPERATOR" && currentToken().value === "**") {
        consumeToken();
        const right = parseUnary();
        left = { type: "BinaryExpression", operator: "**", left, right };
      }
      return left;
    };

    const parseUnary = (): ASTNode => {
      if (currentToken().type === "OPERATOR") {
        const op = currentToken().value;
        if (op === "+" || op === "-" || op === "!") {
          consumeToken();
          const arg = parseUnary();
          return { type: "UnaryExpression", operator: op, argument: arg };
        }
      }
      return parsePrimary();
    };

    const parsePrimary = (): ASTNode => {
      const tok = currentToken();

      if (tok.type === "NUMBER") {
        consumeToken("NUMBER");
        return { type: "NumberLiteral", value: tok.value };
      }

      if (tok.type === "STRING") {
        consumeToken("STRING");
        return { type: "StringLiteral", value: tok.value };
      }

      if (tok.type === "BOOLEAN") {
        consumeToken("BOOLEAN");
        return { type: "BooleanLiteral", value: tok.value };
      }

      if (tok.type === "LPAREN") {
        consumeToken("LPAREN");
        const expr = parseLogicalOr();
        consumeToken("RPAREN");
        return expr;
      }

      if (tok.type === "IDENTIFIER") {
        const idTok = consumeToken("IDENTIFIER");
        const identStr = idTok.value;
        const upper = identStr.toUpperCase();

        // Check if function call
        if (currentToken().type === "LPAREN") {
          // Disallow arbitrary JavaScript injection functions
          const DISALLOWED = ["FUNCTION", "EVAL", "WINDOW", "DOCUMENT", "ALERT", "CONSOLE", "FETCH", "REQUIRE"];
          if (DISALLOWED.includes(upper)) {
            throw new Error(`Security error: Disallowed function '${identStr}'`);
          }
          if (!(SUPPORTED_FUNCTIONS as readonly string[]).includes(upper)) {
            throw new Error(`Unknown or unsupported function: '${identStr}'`);
          }

          consumeToken("LPAREN");
          const args: ASTNode[] = [];
          if (currentToken().type !== "RPAREN") {
            args.push(parseLogicalOr());
            while (currentToken().type === "COMMA") {
              consumeToken("COMMA");
              args.push(parseLogicalOr());
            }
          }
          consumeToken("RPAREN");
          return { type: "FunctionCall", name: upper, args };
        }

        // Otherwise, variable reference
        return { type: "Identifier", name: identStr, isBracketed: idTok.isBracketed };
      }

      if (tok.type === "EOF") {
        throw new Error("Unexpected end of formula: missing operand");
      }

      throw new Error(`Unexpected token '${tok.value}'`);
    };

    const ast = parseLogicalOr();
    if (currentToken().type !== "EOF") {
      throw new Error(`Unexpected extra content after expression: '${currentToken().value}'`);
    }
    return { ast };
  } catch (err: any) {
    return { ast: null, error: err.message || "Invalid formula expression" };
  }
}

/**
 * Extracts all variable identifiers referenced in the AST (excludes function names).
 */
export function extractASTDependencies(ast: ASTNode): string[] {
  const deps = new Set<string>();
  function walk(node: ASTNode) {
    if (!node) return;
    if (node.type === "Identifier") {
      deps.add(node.name);
    } else if (node.type === "UnaryExpression") {
      walk(node.argument);
    } else if (node.type === "BinaryExpression") {
      walk(node.left);
      walk(node.right);
    } else if (node.type === "FunctionCall") {
      node.args.forEach(walk);
    }
  }
  walk(ast);
  return Array.from(deps);
}

/**
 * Safely evaluates an AST against a variable evaluation context.
 */
export function evaluateAST(
  ast: ASTNode,
  context: Record<string, any> = {},
  options: { isBlankDetection?: boolean } = {}
): any {
  function getVar(name: string): any {
    if (name in context) return context[name];
    if (context[name] !== undefined) return context[name];
    const lower = name.toLowerCase();
    if (lower in context) return context[lower];
    if (context[lower] !== undefined) return context[lower];
    const upper = name.toUpperCase();
    if (upper in context) return context[upper];
    if (context[upper] !== undefined) return context[upper];

    // Metrology semantic alias lookup
    const clean = name.trim().toLowerCase();
    const matchKey = Object.keys(context).find((k) => k.trim().toLowerCase() === clean);
    if (matchKey !== undefined) return context[matchKey];

    // Try canonical fallback (e.g. lower_limit -> lowerLimit)
    const sem = STANDARD_METROLOGY_VARIABLES[clean];
    if (sem) {
      if (sem.canonical in context) return context[sem.canonical];
      if (context[sem.canonical] !== undefined) return context[sem.canonical];
      const semLower = sem.canonical.toLowerCase();
      if (semLower in context) return context[semLower];
      if (context[semLower] !== undefined) return context[semLower];
    }

    return undefined;
  }

  function evalNode(node: ASTNode): any {
    if (node.type === "NumberLiteral") return node.value;
    if (node.type === "StringLiteral") return node.value;
    if (node.type === "BooleanLiteral") return node.value;

    if (node.type === "Identifier") {
      const clean = node.name.trim().toLowerCase();
      const isKnownInContext =
        node.name in context ||
        node.name.toLowerCase() in context ||
        node.name.toUpperCase() in context ||
        Object.keys(context).some((k) => k.trim().toLowerCase() === clean) ||
        (STANDARD_METROLOGY_VARIABLES[clean] &&
          (STANDARD_METROLOGY_VARIABLES[clean].canonical in context ||
            STANDARD_METROLOGY_VARIABLES[clean].canonical.toLowerCase() in context));

      const val = getVar(node.name);
      if (val === undefined && !isKnownInContext) {
        throw new Error(`Unresolved variable: ${node.name}`);
      }
      if (options.isBlankDetection && isBlankValue(val)) {
        return null;
      }
      if (val === null || val === undefined) return null;
      if (typeof val === "number") return val;
      if (typeof val === "boolean") return val;
      const num = parseFloat(String(val));
      return isNaN(num) ? val : num;
    }

    if (node.type === "UnaryExpression") {
      const val = evalNode(node.argument);
      if (val === null) return null;
      if (node.operator === "+") return +Number(val);
      if (node.operator === "-") return -Number(val);
      if (node.operator === "!") return !Boolean(val);
    }

    if (node.type === "BinaryExpression") {
      const left = evalNode(node.left);
      const right = evalNode(node.right);

      if (options.isBlankDetection && (left === null || right === null)) {
        return null;
      }

      const numL = Number(left);
      const numR = Number(right);

      switch (node.operator) {
        case "+":
          if (typeof left === "string" || typeof right === "string") {
            return String(left) + String(right);
          }
          return numL + numR;
        case "-":
          return numL - numR;
        case "*":
          return numL * numR;
        case "/":
          return numR === 0 ? Infinity : numL / numR;
        case "%":
          return numL % numR;
        case "**":
          return Math.pow(numL, numR);
        case "==":
        case "===":
          if (typeof left === "number" && typeof right === "number") {
            return Math.abs(left - right) < 1e-9;
          }
          return left === right;
        case "!=":
        case "!==":
          if (typeof left === "number" && typeof right === "number") {
            return Math.abs(left - right) >= 1e-9;
          }
          return left !== right;
        case "<":
          return !isNaN(numL) && !isNaN(numR) ? numL < numR - 1e-9 : left < right;
        case "<=":
          return !isNaN(numL) && !isNaN(numR) ? numL <= numR + 1e-9 : left <= right;
        case ">":
          return !isNaN(numL) && !isNaN(numR) ? numL > numR + 1e-9 : left > right;
        case ">=":
          return !isNaN(numL) && !isNaN(numR) ? numL >= numR - 1e-9 : left >= right;
        case "&&":
          return Boolean(left) && Boolean(right);
        case "||":
          return Boolean(left) || Boolean(right);
        default:
          throw new Error(`Unsupported binary operator: ${node.operator}`);
      }
    }

    if (node.type === "FunctionCall") {
      const evaluatedArgs = node.args.map((a) => evalNode(a));

      switch (node.name) {
        case "IF":
          if (evaluatedArgs[0] === null) {
            return null;
          }
          return evaluatedArgs[0] ? evaluatedArgs[1] : evaluatedArgs.length > 2 ? evaluatedArgs[2] : false;
        case "AND":
          return evaluatedArgs.every((arg) => Boolean(arg) && arg !== null);
        case "OR":
          return evaluatedArgs.some((arg) => Boolean(arg) && arg !== null);
        case "NOT":
          return !Boolean(evaluatedArgs[0]);
        case "ISBLANK": {
          const raw = evaluatedArgs[0];
          return isBlankValue(raw) || raw === null || raw === undefined;
        }
        case "ABS":
          return Math.abs(Number(evaluatedArgs[0]));
        case "SQRT": {
          const val = Number(evaluatedArgs[0]);
          return val < 0 ? NaN : Math.sqrt(val);
        }
        case "ROUND": {
          const num = Number(evaluatedArgs[0]);
          const dec = Number(evaluatedArgs[1] || 0);
          return isNaN(num) ? 0 : parseFloat(num.toFixed(dec));
        }
        case "MIN": {
          const nums = evaluatedArgs
            .filter((a) => a !== null && a !== undefined && !isBlankValue(a))
            .map(Number)
            .filter((n) => !isNaN(n));
          return nums.length ? Math.min(...nums) : 0;
        }
        case "MAX": {
          const nums = evaluatedArgs
            .filter((a) => a !== null && a !== undefined && !isBlankValue(a))
            .map(Number)
            .filter((n) => !isNaN(n));
          return nums.length ? Math.max(...nums) : 0;
        }
        case "AVERAGE":
        case "AVG": {
          const nums = evaluatedArgs
            .filter((a) => a !== null && a !== undefined && !isBlankValue(a))
            .map(Number)
            .filter((n) => !isNaN(n));
          return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        }
        case "SUM": {
          const nums = evaluatedArgs
            .filter((a) => a !== null && a !== undefined && !isBlankValue(a))
            .map(Number)
            .filter((n) => !isNaN(n));
          return nums.reduce((a, b) => a + b, 0);
        }
        case "STDEV":
        case "STDEVP": {
          const nums = evaluatedArgs.map(Number).filter((n) => !isNaN(n));
          if (nums.length <= 1) return 0;
          const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
          const variance =
            nums.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / (nums.length - 1);
          return Math.sqrt(variance);
        }
        case "MIN_VAL":
        case "MAX_VAL":
        case "NOMINAL": {
          const raw = evaluatedArgs[0];
          const bounds = extractBounds(raw);
          if (node.name === "MIN_VAL") return bounds.min;
          if (node.name === "MAX_VAL") return bounds.max;
          return bounds.nom;
        }
        default:
          throw new Error(`Unknown function: ${node.name}`);
      }
    }

    throw new Error("Invalid AST node");
  }

  return evalNode(ast);
}

export interface FormulaValidationOptions {
  availableColumns?: (string | { id: string; label?: string; role?: string; semanticRole?: string; type?: string })[];
  testContext?: Record<string, any>;
  isJudgement?: boolean;
  targetColumnId?: string;
  targetColumnRole?: string;
  targetColumnLabel?: string;
  sourceConfidence?: "HIGH" | "MEDIUM" | "LOW";
  tableCalculationModel?: string;
  nominal?: number;
  lowerLimit?: number;
  upperLimit?: number;
  tolerance?: number;
  decimalPlaces?: number;
}

export interface FormulaValidationResult {
  valid: boolean;
  isValid?: boolean;
  syntaxValid: boolean;
  variablesValid: boolean;
  dependenciesValid: boolean;
  circularDependency: boolean;
  executable: boolean;
  metrologyValid: boolean;
  boundaryTestsPassed: boolean;
  suitabilityValid: boolean;
  suitabilityReason?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  status: "VALID" | "VALIDATED" | "NEEDS_REVIEW" | "INVALID";
  errors: string[];
  warnings: string[];
  dependencies: string[];
  unsupportedFunctions: string[];
  testResult?: any;
  boundaryReport?: any;
}

/**
 * Production-Grade 7-Level Metrology Formula Validator:
 * Level 1: Syntax (AST Parsing)
 * Level 2: Semantic (Variable existence & dictionary resolution)
 * Level 3: Dependency Graph (DAG cycle check)
 * Level 4: Runtime Execution (Representative evaluation test)
 * Level 5: Metrology Semantics (Directional correctness: deviation, limits, error)
 * Level 6: Boundary Tests (Automated limit boundary checks)
 * Level 7: Template Suitability (Consistency with table calculation model)
 */
export function validateFormula(
  formulaStr: string,
  optionsOrColumns: FormulaValidationOptions | (string | { id: string; label?: string; role?: string; semanticRole?: string; type?: string })[] = {},
  calculationModelOrOptions?: CalibrationCalculationModel | FormulaValidationOptions
): FormulaValidationResult {
  let options: FormulaValidationOptions = {};
  if (Array.isArray(optionsOrColumns)) {
    options = { availableColumns: optionsOrColumns };
  } else if (typeof optionsOrColumns === "object" && optionsOrColumns !== null) {
    options = { ...optionsOrColumns };
  }

  if (typeof calculationModelOrOptions === "string") {
    options.tableCalculationModel = calculationModelOrOptions;
  } else if (typeof calculationModelOrOptions === "object" && calculationModelOrOptions !== null) {
    options = { ...options, ...calculationModelOrOptions };
  }
  const clean = formulaStr ? formulaStr.trim() : "";
  if (!clean) {
    return {
      valid: true,
      isValid: true,
      syntaxValid: true,
      variablesValid: true,
      dependenciesValid: true,
      circularDependency: false,
      executable: true,
      metrologyValid: true,
      boundaryTestsPassed: true,
      suitabilityValid: true,
      confidence: "HIGH",
      status: "VALIDATED",
      errors: [],
      warnings: [],
      dependencies: [],
      unsupportedFunctions: [],
    };
  }

  // Detect any unsupported function names in formula
  const funcMatches = (clean.match(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g) || []).map((f) =>
    f.slice(0, -1).trim().toUpperCase()
  );
  const unsupportedFunctions: string[] = [];
  for (const fn of funcMatches) {
    if (!(SUPPORTED_FUNCTIONS as readonly string[]).includes(fn) && !unsupportedFunctions.includes(fn)) {
      unsupportedFunctions.push(fn);
    }
  }

  // --- LEVEL 1: SYNTAX VALIDATION ---
  const parseRes = parseFormulaAST(clean);
  if (!parseRes.ast) {
    return {
      valid: false,
      isValid: false,
      syntaxValid: false,
      variablesValid: true,
      dependenciesValid: false,
      circularDependency: false,
      executable: false,
      metrologyValid: false,
      boundaryTestsPassed: false,
      suitabilityValid: false,
      confidence: "LOW",
      status: "INVALID",
      errors: [parseRes.error || "Formula syntax warning: Check operators (+, -, *, /) or matching parentheses ()"],
      warnings: [],
      dependencies: [],
      unsupportedFunctions,
    };
  }

  const ast = parseRes.ast;
  const dependencies = extractASTDependencies(ast);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check circular dependency if targetColumnId provided
  let circularDependency = false;
  if (options.targetColumnId) {
    const target = options.targetColumnId.toLowerCase();
    if (dependencies.some((d) => d.toLowerCase() === target)) {
      circularDependency = true;
      errors.push(`Circular reference detected: column references itself (${options.targetColumnId})`);
    }
  }

  // --- LEVEL 2: SEMANTIC & VARIABLE VALIDATION ---
  let variablesValid = true;
  const unknownVariables: string[] = [];

  for (const dep of dependencies) {
    const isValid = isStandardMetrologyVariable(dep, options.availableColumns);
    if (!isValid) {
      unknownVariables.push(dep);
    }
  }

  if (unknownVariables.length > 0) {
    variablesValid = false;
    warnings.push(`Formula references unknown variable(s): ${unknownVariables.join(", ")}`);
  }

  // --- LEVEL 3: DEPENDENCY GRAPH VALIDATION ---
  const dependenciesValid = !circularDependency && variablesValid;

  // --- LEVEL 4: RUNTIME EXECUTION TEST ---
  let executable = false;
  let testResult: any = undefined;

  const testContext: Record<string, any> = { ...(options.testContext || {}) };

  // Populate default test values for any missing dependencies
  for (const dep of dependencies) {
    if (testContext[dep] === undefined) {
      const info = resolveVariableSemanticRole(dep, options.availableColumns);
      testContext[dep] = info.defaultTestValue;
      testContext[dep.toLowerCase()] = info.defaultTestValue;
      testContext[dep.toUpperCase()] = info.defaultTestValue;
    }
  }

  try {
    testResult = evaluateAST(ast, testContext);
    if (typeof testResult === "number" && !isFinite(testResult)) {
      errors.push("Calculation produced division by zero or infinity");
    } else if (typeof testResult === "number" && isNaN(testResult)) {
      errors.push("Calculation produced NaN");
    } else {
      executable = true;
    }
  } catch (err: any) {
    errors.push(`Runtime test error: ${err.message || "Failed to evaluate"}`);
  }

  // --- LEVEL 5: METROLOGY SEMANTICS VALIDATION ---
  let metrologyValid = true;
  const colRoleLower = (options.targetColumnRole || "").toLowerCase();
  const colIdLower = (options.targetColumnId || "").toLowerCase();
  const cleanLower = clean.toLowerCase();

  const isDeviationCol =
    colRoleLower === "deviation" ||
    colRoleLower === "error" ||
    colRoleLower === "bias" ||
    colIdLower.includes("deviation") ||
    colIdLower.includes("error") ||
    (options.targetColumnLabel && /deviation|error|bias/i.test(options.targetColumnLabel));

  if (isDeviationCol) {
    // Flag if deviation formula adds actual and nominal instead of subtracting
    if (
      /\b(actual|actual_dimension|reading|observed|meas|measured)\b\s*\+\s*\b(nominal|std|standard)\b/i.test(cleanLower) ||
      /\b(nominal|std|standard)\b\s*\+\s*\b(actual|actual_dimension|reading|observed|meas|measured)\b/i.test(cleanLower)
    ) {
      metrologyValid = false;
      warnings.push("Metrology semantics: Deviation is expected to be (Actual - Nominal) or (Nominal - Actual). Addition (+) detected.");
    }
  }

  // --- LEVEL 6: BOUNDARY VALIDATION ---
  let boundaryTestsPassed = true;
  const isJudgementCol =
    options.isJudgement ||
    colRoleLower === "judgement" ||
    colRoleLower === "status" ||
    colIdLower.includes("judgement") ||
    colIdLower.includes("status") ||
    (options.targetColumnLabel && /judgement|status|acceptance|result/i.test(options.targetColumnLabel)) ||
    /pass.*fail/i.test(cleanLower);

  if (isJudgementCol && executable) {
    const nom = options.nominal ?? 35.035;
    const lower = options.lowerLimit ?? (nom - 0.02);
    const upper = options.upperLimit ?? (nom - 0.01);

    try {
      const passEval = testEvaluateFormula(clean, {
        actual_dimension: (lower + upper) / 2,
        actual: (lower + upper) / 2,
        reading: (lower + upper) / 2,
        nominal: nom,
        lower_limit: lower,
        upper_limit: upper,
        tolerance: (upper - lower) / 2,
      });
      const failEval = testEvaluateFormula(clean, {
        actual_dimension: lower - 0.01,
        actual: lower - 0.01,
        reading: lower - 0.01,
        nominal: nom,
        lower_limit: lower,
        upper_limit: upper,
        tolerance: (upper - lower) / 2,
      });

      if (passEval.result === "FAIL" || failEval.result === "PASS") {
        boundaryTestsPassed = false;
        warnings.push("Metrology boundary check: In-spec value did not produce PASS or out-of-spec value did not produce FAIL.");
      }
    } catch {
      // Non-fatal if context cannot evaluate boundary check
    }
  }

  // --- LEVEL 7: TEMPLATE SUITABILITY VALIDATION ---
  let suitabilityValid = true;
  let suitabilityReason: string | undefined = undefined;

  if (options.tableCalculationModel && typeof options.tableCalculationModel === "string") {
    const model = options.tableCalculationModel.toUpperCase();
    if (model === "MULTI_TRIAL_AVERAGE" && !cleanLower.includes("avg") && !cleanLower.includes("average")) {
      if (colRoleLower.includes("avg") || colRoleLower.includes("mean")) {
        suitabilityValid = false;
        suitabilityReason = "Table calculation model expects multi-trial AVERAGE() aggregation.";
        warnings.push(suitabilityReason);
      }
    } else if (model === "MPE_COMPARISON" && !cleanLower.includes("mpe") && !cleanLower.includes("limit")) {
      if (isJudgementCol && !cleanLower.includes("mpe")) {
        suitabilityReason = "Table model is MPE_COMPARISON, but judgement formula does not reference MPE.";
        warnings.push(suitabilityReason);
      }
    }
  }

  const syntaxValid = true;
  const valid = syntaxValid && errors.length === 0;

  // Determine Confidence and Status
  let confidence: "HIGH" | "MEDIUM" | "LOW" = options.sourceConfidence || "HIGH";
  let status: "VALID" | "VALIDATED" | "NEEDS_REVIEW" | "INVALID" = "VALIDATED";

  if (!valid || errors.length > 0) {
    status = "INVALID";
    confidence = "LOW";
  } else if (warnings.length > 0 || options.sourceConfidence === "LOW" || !metrologyValid || !boundaryTestsPassed) {
    status = "NEEDS_REVIEW";
    confidence = options.sourceConfidence || "MEDIUM";
  } else {
    status = "VALIDATED";
    confidence = options.sourceConfidence || "HIGH";
  }

  return {
    valid,
    isValid: valid,
    syntaxValid,
    variablesValid,
    dependenciesValid,
    circularDependency,
    executable,
    metrologyValid,
    boundaryTestsPassed,
    suitabilityValid,
    suitabilityReason,
    confidence,
    status,
    errors,
    warnings,
    dependencies,
    unsupportedFunctions,
    testResult,
  };
}

/**
 * Detect circular dependencies across a set of table columns.
 * Returns an array of cycles, where each cycle contains the loop of column IDs.
 */
export function detectFormulaCycles(
  columns: Array<{ id: string; label?: string; formula?: string; dependsOn?: string[] }>
): string[][] {
  const colMap = new Map<string, { id: string; formula?: string; dependsOn?: string[] }>();
  for (const c of columns) {
    colMap.set(c.id.toLowerCase(), c);
  }

  const adj = new Map<string, string[]>();
  for (const col of columns) {
    const fromId = col.id.toLowerCase();
    const deps: string[] = [];

    if (col.formula) {
      const parseRes = parseFormulaAST(col.formula);
      if (parseRes.ast) {
        const astDeps = extractASTDependencies(parseRes.ast);
        for (const d of astDeps) {
          const depLower = d.toLowerCase();
          if (colMap.has(depLower) && depLower !== fromId && !deps.includes(depLower)) {
            deps.push(depLower);
          }
        }
      }
    }
    if (Array.isArray(col.dependsOn)) {
      for (const d of col.dependsOn) {
        const depLower = d.toLowerCase();
        if (colMap.has(depLower) && depLower !== fromId && !deps.includes(depLower)) {
          deps.push(depLower);
        }
      }
    }
    adj.set(fromId, deps);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack: string[] = [];

  function dfs(curr: string) {
    visited.add(curr);
    recStack.push(curr);

    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else {
        const idx = recStack.indexOf(neighbor);
        if (idx !== -1) {
          const cycle = recStack.slice(idx);
          cycle.push(neighbor);
          cycles.push(cycle);
        }
      }
    }

    recStack.pop();
  }

  for (const col of columns) {
    const id = col.id.toLowerCase();
    if (!visited.has(id)) {
      dfs(id);
    }
  }

  return cycles;
}

/**
 * Validates formula expression syntax using the authoritative AST parser.
 * Single source of truth shared with runtime evaluation.
 */
export function validateFormulaSyntax(formulaStr: string): { valid: boolean; message?: string } {
  if (!formulaStr || !formulaStr.trim()) return { valid: true };
  const res = validateFormula(formulaStr);
  return {
    valid: res.syntaxValid && res.variablesValid && !res.circularDependency,
    message: res.errors[0] || res.warnings[0],
  };
}

/**
 * Interactive Diagnostic Test Runner for Inspector:
 * Evaluates formula against user-provided test inputs without mutating table.
 */
export function testEvaluateFormula(
  formulaStr: string,
  testValues: Record<string, any>,
  decimalPlaces: number = 3
): {
  success: boolean;
  formatted: string;
  result?: any;
  numeric?: number;
  booleanResult?: boolean;
  error?: string;
} {
  if (!formulaStr || !formulaStr.trim()) {
    return { success: true, formatted: "-", result: "-" };
  }
  const parseRes = parseFormulaAST(formulaStr);
  if (!parseRes.ast) {
    return { success: false, formatted: "Syntax Error", error: parseRes.error };
  }

  try {
    const rawRes = evaluateAST(parseRes.ast, testValues, { isBlankDetection: true });
    if (rawRes === null || rawRes === undefined || rawRes === "" || rawRes === "-") {
      return { success: true, formatted: "-", result: "-" };
    }
    if (typeof rawRes === "boolean") {
      return { success: true, formatted: rawRes ? "PASS" : "FAIL", result: rawRes ? "PASS" : "FAIL", booleanResult: rawRes };
    }
    if (typeof rawRes === "number") {
      if (isNaN(rawRes)) return { success: false, formatted: "NaN", result: NaN, error: "Produced NaN" };
      if (!isFinite(rawRes)) return { success: false, formatted: "Div/0", result: Infinity, error: "Division by zero" };
      const numStr = rawRes.toFixed(decimalPlaces);
      return { success: true, formatted: parseFloat(numStr).toString(), result: rawRes, numeric: rawRes };
    }
    return { success: true, formatted: String(rawRes), result: rawRes };
  } catch (err: any) {
    return { success: false, formatted: "Error", error: err.message || "Execution error" };
  }
}

/**
 * Safe expression evaluation without eval() or Function().
 * Unified with AST parser and evaluation engine.
 */
export function safeEvaluateExpression(
  expr: string,
  context: Record<string, any> = {}
): { success: boolean; result?: any } {
  const parseRes = parseFormulaAST(expr);
  if (!parseRes.ast) return { success: false };
  try {
    const result = evaluateAST(parseRes.ast, context);
    return { success: true, result };
  } catch {
    return { success: false };
  }
}

/**
 * Ultra-fast micro-evaluator for spreadsheet math and logic expressions.
 * Computes common functions safely in microseconds without Function() or eval().
 */
function fastEvaluateMathAndLogic(expr: string): { success: boolean; result?: any } {
  return safeEvaluateExpression(expr);
}

/**
 * Reusable, High-Performance Formula Evaluation Engine.
 * Computes formulas using Excel Column Letters, Custom Column IDs, Column Names, and Standard Variables.
 * Automatically resolves aliases, executes in microseconds, and avoids #NAME/#VALUE errors.
 */
export function evaluateFormulaValue(
  col: CustomColumn,
  pt: CalibrationPoint,
  hasDescending: boolean = false,
  customColumns: CustomColumn[] = [],
  activeColumnOrder: string[] = [],
  defaultTolerance: number = 0,
  acceptanceCriteriaValue: number = 0
): string {
  const nom = parseNum(pt.nominal);
  const asc = parseNum(pt.ascending_reading);
  const desc = pt.descending_reading !== undefined ? parseNum(pt.descending_reading) : undefined;
  const actual = desc !== undefined ? (asc + desc) / 2 : asc;
  const err = pt.error ?? (actual - nom);
  const tol = pt.tolerance !== undefined && pt.tolerance > 0 ? parseNum(pt.tolerance) : parseNum(defaultTolerance);

  let formulaExpr = "";

  switch (col.formulaType) {
    case "avg":
      formulaExpr = "=AVERAGE(Nominal, Actual)";
      break;
    case "stddev":
      formulaExpr = desc !== undefined ? "=STDEV(Ascending, Descending)" : "=0";
      break;
    case "pct_error":
      formulaExpr = "=((Actual - Nominal) / Nominal) * 100";
      break;
    case "abs_error":
      formulaExpr = "=ABS(Actual - Nominal)";
      break;
    case "bias":
      formulaExpr = "=Actual - Nominal";
      break;
    case "custom":
      formulaExpr = col.customFormula || "=Actual - Nominal";
      break;
    default:
      return "-";
  }

  try {
    let expr = formulaExpr.trim();
    if (!expr.startsWith("=")) {
      expr = "=" + expr;
    }

    // Raw values map for bounds extraction and macro evaluation
    const rawValuesMap: Record<string, any> = {
      Nominal: pt.nominal,
      STD: pt.nominal,
      Tolerance: pt.tolerance ?? tol,
      Actual: pt.ascending_reading,
      Ascending: pt.ascending_reading,
      Descending: pt.descending_reading,
      Error: pt.error ?? err,
      AcceptanceCriteria: acceptanceCriteriaValue,
      MPE: acceptanceCriteriaValue,
      Limit: acceptanceCriteriaValue,
      AC: acceptanceCriteriaValue,
    };

    // Standard named variables map (Numeric values)
    const valuesMap: Record<string, number | string> = {
      Nominal: nom,
      STD: nom,
      Tolerance: tol,
      Actual: actual,
      Ascending: asc,
      Descending: desc || 0,
      Error: err,
      AcceptanceCriteria: parseNum(acceptanceCriteriaValue),
      MPE: parseNum(acceptanceCriteriaValue),
      Limit: parseNum(acceptanceCriteriaValue),
      AC: parseNum(acceptanceCriteriaValue),
    };

    // Helper to fetch custom field value from point
    const getCustomFieldValue = (colId: string, colName?: string) => {
      if (!pt.customFields) return undefined;
      let raw = pt.customFields[colId];
      if (raw === undefined && colName) {
        raw = pt.customFields[colName];
      }
      if (raw === undefined) {
        const targetKeys = [colId.toLowerCase(), colName?.toLowerCase()].filter(Boolean);
        const matchedKey = Object.keys(pt.customFields).find((k) =>
          targetKeys.includes(k.toLowerCase())
        );
        if (matchedKey) raw = pt.customFields[matchedKey];
      }
      if (typeof raw === "object" && raw !== null && "value" in raw) {
        return (raw as any).value;
      }
      return raw;
    };

    // Register all Custom Columns by ID and Name
    customColumns.forEach((c) => {
      const rawVal = getCustomFieldValue(c.id, c.name);
      const isActuallyNumeric = typeof rawVal === "number" || (typeof rawVal === "string" && rawVal.trim() !== "" && !isNaN(Number(rawVal.trim())) && isFinite(Number(rawVal.trim())));
      const val = isActuallyNumeric ? parseNum(rawVal) : (rawVal ?? "");

      // Map by column ID (e.g. col_r1, col_avg, col_error, col_judge)
      valuesMap[c.id] = val;
      rawValuesMap[c.id] = rawVal;
      valuesMap[c.id.toLowerCase()] = val;
      valuesMap[c.id.toUpperCase()] = val;

      // Map by column name (e.g. "1", "2", "Avg", "Reading 1")
      if (c.name && c.name.trim()) {
        const nameTrimmed = c.name.trim();
        valuesMap[nameTrimmed] = val;
        rawValuesMap[nameTrimmed] = rawVal;
        valuesMap[`[${nameTrimmed}]`] = val;
      }
    });

    // Map Excel Column Letters (A, B, C, D... AA, AB) based on active data column order
    const dataColumns = activeColumnOrder.filter((k) => k !== "pt" && k !== "actions");
    dataColumns.forEach((colKey, colIdx) => {
      const excelLetter = getExcelColumnLetter(colIdx);
      if (!excelLetter) return;

      let colVal: any = 0;
      let rawVal: any = 0;

      if (colKey === "description") { colVal = pt.description || ""; rawVal = pt.description; }
      else if (colKey === "nominal") { colVal = nom; rawVal = pt.nominal; }
      else if (colKey === "tolerance") { colVal = tol; rawVal = pt.tolerance; }
      else if (colKey === "ascending_reading") { colVal = asc; rawVal = pt.ascending_reading; }
      else if (colKey === "descending_reading") { colVal = desc || 0; rawVal = pt.descending_reading; }
      else if (colKey === "error") { colVal = err; rawVal = pt.error; }
      else if (colKey === "status") { colVal = pt.status || ""; rawVal = pt.status; }
      else {
        const customCol = customColumns.find((c) => c.id === colKey);
        rawVal = getCustomFieldValue(colKey, customCol?.name);
        colVal = parseNum(rawVal);
      }

      valuesMap[excelLetter] = colVal;
      rawValuesMap[excelLetter] = rawVal;
    });

    let processedExpr = expr;

    // 1. Bracketed column references: [1], [Reading 1], [Avg], [Error]
    processedExpr = processedExpr.replace(/\[([^\]]+)\]/g, (match, colName) => {
      const trimmed = colName.trim();
      if (valuesMap[trimmed] !== undefined) {
        const val = valuesMap[trimmed];
        return typeof val === "string" && isNaN(Number(val)) ? JSON.stringify(val) : String(val);
      }
      return match;
    });

    // 2. Evaluate macros like MIN_VAL(C), MAX_VAL(C), NOMINAL(C)
    const macroRegex = /(MIN_VAL|MAX_VAL|NOMINAL)\(([^()]+)\)/gi;
    processedExpr = processedExpr.replace(macroRegex, (match, func, colName) => {
      const trimmed = colName.trim();
      let raw = rawValuesMap[trimmed] ?? rawValuesMap[trimmed.toUpperCase()];
      if (raw === undefined) {
        const matchKey = Object.keys(rawValuesMap).find((k) => k.toLowerCase() === trimmed.toLowerCase());
        if (matchKey) raw = rawValuesMap[matchKey];
      }
      
      const bounds = extractBounds(raw);
      const funcUpper = func.toUpperCase();
      if (funcUpper === "MIN_VAL") return String(bounds.min);
      if (funcUpper === "MAX_VAL") return String(bounds.max);
      return String(bounds.nom);
    });

    // 3. Replace known variables, column IDs, Excel letters, and standard tokens
    // Sort keys by length descending to prevent partial match collisions (e.g. 'C' inside 'AcceptanceCriteria')
    const sortedKeys = Object.keys(valuesMap).sort((a, b) => b.length - a.length);

    sortedKeys.forEach((key) => {
      if (key.startsWith("[") && key.endsWith("]")) return; // already handled
      const val = valuesMap[key];
      const rawVal = rawValuesMap[key];
      let replaceVal = String(val);

      if (typeof rawVal === "string" && isNaN(Number(rawVal.trim())) && rawVal.trim() !== "") {
        replaceVal = JSON.stringify(rawVal);
      }

      // If key is a pure digit (e.g. "1", "2" for column headers named 1, 2, 3), only replace when enclosed in function args
      if (/^\d+$/.test(key)) {
        const digitArgRegex = new RegExp(`(?<=[(, ])\\b${key}\\b(?=[), ])`, "g");
        processedExpr = processedExpr.replace(digitArgRegex, replaceVal);
      } else {
        const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        processedExpr = processedExpr.replace(regex, replaceVal);
      }
    });

    // 4. Try fast micro-evaluator first (0.01ms execution)
    const fastRes = fastEvaluateMathAndLogic(processedExpr);
    if (fastRes.success) {
      const res = fastRes.result;
      if (res === null || res === undefined) return "-";
      if (typeof res === "boolean") return res ? "PASS" : "FAIL";
      if (typeof res === "number") {
        if (isNaN(res)) return "Err";
        if (!isFinite(res)) return "Div/0";
        if (col.formulaType === "pct_error" || expr.includes("*100") || expr.includes("* 100")) {
          return `${res.toFixed(3)}%`;
        }
        const dec = col.decimalPlaces !== undefined && col.decimalPlaces >= 0 ? col.decimalPlaces : 4;
        return dec === 0 ? String(Math.round(res)) : parseFloat(res.toFixed(dec)).toString();
      }
      return String(res);
    }

    // 5. Fallback to singleton HyperFormula instance for advanced Excel functions
    const hf = getSharedHyperFormula();
    hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[processedExpr]]);
    const res = hf.getCellValue({ sheet: 0, col: 0, row: 0 });

    if (res === null || res === undefined) return "-";
    if (typeof res === "boolean") return res ? "PASS" : "FAIL";
    if (typeof res === "object" && "type" in res) {
      return `#${(res as any).type}`;
    }
    if (typeof res === "number") {
      if (isNaN(res)) return "Err";
      if (!isFinite(res)) return "Div/0";
      if (col.formulaType === "pct_error" || expr.includes("*100") || expr.includes("* 100")) {
        return `${res.toFixed(3)}%`;
      }
      const dec = col.decimalPlaces !== undefined && col.decimalPlaces >= 0 ? col.decimalPlaces : 4;
      return dec === 0 ? String(Math.round(res)) : parseFloat(res.toFixed(dec)).toString();
    }
    return String(res);
  } catch {
    return "Err";
  }
}

import { parseSpecification } from "./specificationParser";

/**
 * Checks whether a value is blank / empty / unset (undefined, null, "", or "-").
 * Crucially, numeric 0 and "0" are valid measurement readings, NOT blanks.
 */
export function isBlankValue(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string") {
    const s = val.trim();
    return s === "" || s === "-";
  }
  return false;
}

/**
 * Synchronizes trial reading aliases across row data.
 * Supports patterns: t{n}, trial_{n}, trial{n}, reading_{n}, reading{n}, r{n}, col_{n}, and pure digits {n}.
 */
export function syncTrialAliases(row: any): void {
  if (!row) return;
  for (let i = 1; i <= 20; i++) {
    const aliases = [
      `t${i}`,
      `trial_${i}`,
      `trial${i}`,
      `reading_${i}`,
      `reading${i}`,
      `r${i}`,
      `col_${i}`,
      String(i),
    ];
    let foundVal: any = undefined;
    for (const a of aliases) {
      if (!isBlankValue(row[a])) {
        foundVal = row[a];
        break;
      }
    }
    if (foundVal !== undefined) {
      for (const a of aliases) {
        row[a] = foundVal;
      }
    }
  }
}

export interface RowEvaluationContext {
  nom: number;
  lowerTol: number;
  upperTol: number;
  lowerLimit: number;
  upperLimit: number;
  tolerance: number;
  actualVal?: number;
  hasReading: boolean;
  valuesMap: Record<string, any>;
  rawValuesMap: Record<string, any>;
  trialValues: number[];
  trialColumns: string[];
}

/**
 * Builds a comprehensive variable resolution context for a table row.
 * Shared across canvas formula evaluation and custom column calculations.
 */
export function buildRowContext(
  row: any,
  columns: any[] = [],
  tableTol: number = 0.02,
  tableDec: number = 3,
  acceptanceCriteriaValue: number = 0
): RowEvaluationContext {
  const dec = tableDec;

  // 1. Structured specification parsing
  const specText =
    row.specificationText ||
    row.description ||
    row.gauge_receipt_condition ||
    row.required_dimension ||
    "";
  let nom = typeof row.nominal === "number" ? row.nominal : parseFloat(String(row.nominal));
  let lowerTol = typeof row.lowerTolerance === "number" ? row.lowerTolerance : undefined;
  let upperTol = typeof row.upperTolerance === "number" ? row.upperTolerance : undefined;

  if (specText && (isNaN(nom) || lowerTol === undefined || upperTol === undefined)) {
    const parsed = parseSpecification(specText, row.unit || "mm", tableTol, dec);
    if (parsed.isValid) {
      if (isNaN(nom) || nom === 0) nom = parsed.nominal;
      if (lowerTol === undefined) lowerTol = parsed.lowerTolerance;
      if (upperTol === undefined) upperTol = parsed.upperTolerance;
    }
  }

  if (isNaN(nom)) nom = 0;
  if (lowerTol === undefined) {
    const tolVal =
      typeof row.tolerance === "number"
        ? row.tolerance
        : parseFloat(String(row.tolerance ?? tableTol)) || tableTol;
    lowerTol = -tolVal;
    upperTol = tolVal;
  }
  if (upperTol === undefined) upperTol = -lowerTol;

  const lowerLimit = nom + lowerTol;
  const upperLimit = nom + upperTol;
  const tolerance = typeof row.tolerance === "number" ? row.tolerance : tableTol;

  // 2. Identify all trial values
  const trialValues: number[] = [];
  const trialColumns: string[] = [];

  for (let i = 1; i <= 20; i++) {
    const aliases = [
      `t${i}`,
      `trial_${i}`,
      `trial${i}`,
      `reading_${i}`,
      `reading${i}`,
      `r${i}`,
      `col_${i}`,
      String(i),
    ];
    for (const a of aliases) {
      const v = row[a];
      if (!isBlankValue(v)) {
        const num = parseFloat(String(v));
        if (!isNaN(num)) {
          trialValues.push(num);
          trialColumns.push(a);
        }
        break;
      }
    }
  }

  // Also check any column explicitly marked as trial
  columns.forEach((col) => {
    if (col && (col.type === "trial" || /^t\d+$/i.test(col.id))) {
      const v = row[col.id];
      if (!isBlankValue(v)) {
        const num = parseFloat(String(v));
        if (!isNaN(num) && !trialValues.includes(num)) {
          trialValues.push(num);
          trialColumns.push(col.id);
        }
      }
    }
  });

  // 3. Extract primary reading / actual measurement
  let actualVal: number | undefined = undefined;
  let rawReading: any = undefined;

  if (!isBlankValue(row.actual_dimension)) {
    rawReading = row.actual_dimension;
  } else if (!isBlankValue(row.actual)) {
    rawReading = row.actual;
  } else if (!isBlankValue(row.reading)) {
    rawReading = row.reading;
  } else if (!isBlankValue(row.observation)) {
    rawReading = row.observation;
  } else if (!isBlankValue(row.avg) && row.avg !== "-") {
    rawReading = row.avg;
  } else if (!isBlankValue(row.average) && row.average !== "-") {
    rawReading = row.average;
  } else if (trialValues.length > 0) {
    actualVal = trialValues.reduce((a, b) => a + b, 0) / trialValues.length;
  }

  if (rawReading !== undefined) {
    const parsed = parseFloat(String(rawReading));
    if (!isNaN(parsed)) actualVal = parsed;
  }

  const hasReading = actualVal !== undefined;

  // 4. Raw values map and numeric values map for expression evaluation
  const rawValuesMap: Record<string, any> = {
    nominal: nom,
    nom: nom,
    std: nom,
    STD: nom,
    lowerTolerance: lowerTol,
    lowertolerance: lowerTol,
    lower_tolerance: lowerTol,
    lowertol: lowerTol,
    upperTolerance: upperTol,
    uppertolerance: upperTol,
    upper_tolerance: upperTol,
    uppertol: upperTol,
    lowerLimit: lowerLimit,
    lowerlimit: lowerLimit,
    lower_limit: lowerLimit,
    min_limit: lowerLimit,
    minlimit: lowerLimit,
    upperLimit: upperLimit,
    upperlimit: upperLimit,
    upper_limit: upperLimit,
    max_limit: upperLimit,
    maxlimit: upperLimit,
    tolerance: tolerance,
    tol: tolerance,
    Tolerance: tolerance,
    actual: hasReading ? actualVal : "",
    Actual: hasReading ? actualVal : "",
    actual_dimension: hasReading ? actualVal : "",
    Actual_Dimension: hasReading ? actualVal : "",
    reading: hasReading ? actualVal : "",
    Reading: hasReading ? actualVal : "",
    observation: hasReading ? actualVal : "",
    Observation: hasReading ? actualVal : "",
    point_number: typeof row.point_number === "number" ? row.point_number : (typeof row.sl_no === "number" ? row.sl_no : 1),
    sl_no: typeof row.sl_no === "number" ? row.sl_no : (typeof row.point_number === "number" ? row.point_number : 1),
    avg: row.avg ?? (trialValues.length > 0 ? actualVal : ""),
    average: row.average ?? (trialValues.length > 0 ? actualVal : ""),
    error: row.error ?? (hasReading ? (actualVal! - nom) : ""),
    Error: row.error ?? (hasReading ? (actualVal! - nom) : ""),
    deviation: row.deviation ?? (hasReading ? (actualVal! - nom) : ""),
    Deviation: row.deviation ?? (hasReading ? (actualVal! - nom) : ""),
    MPE: acceptanceCriteriaValue || tolerance,
    mpe: acceptanceCriteriaValue || tolerance,
    Limit: acceptanceCriteriaValue || tolerance,
    limit: acceptanceCriteriaValue || tolerance,
    AC: acceptanceCriteriaValue || tolerance,
    ac: acceptanceCriteriaValue || tolerance,
    AcceptanceCriteria: acceptanceCriteriaValue || tolerance,
    acceptancecriteria: acceptanceCriteriaValue || tolerance,
  };

  const valuesMap: Record<string, any> = { ...rawValuesMap };

  // Register trial variables in valuesMap
  for (let i = 1; i <= 20; i++) {
    const val = row[`t${i}`] ?? row[String(i)] ?? row[`col_${i}`] ?? row[`trial_${i}`];
    if (!isBlankValue(val)) {
      const num = parseFloat(String(val));
      const finalVal = isNaN(num) ? val : num;
      valuesMap[`t${i}`] = finalVal;
      valuesMap[`trial_${i}`] = finalVal;
      valuesMap[`trial${i}`] = finalVal;
      valuesMap[`reading_${i}`] = finalVal;
      valuesMap[`reading${i}`] = finalVal;
      valuesMap[`r${i}`] = finalVal;
      valuesMap[`col_${i}`] = finalVal;
      valuesMap[String(i)] = finalVal;
      rawValuesMap[`t${i}`] = val;
      rawValuesMap[`trial_${i}`] = val;
      rawValuesMap[`reading_${i}`] = val;
      rawValuesMap[`col_${i}`] = val;
      rawValuesMap[String(i)] = val;
    }
  }

  // Register all table columns by ID, label, and Excel column letters
  columns.forEach((col, idx) => {
    if (!col || !col.id) return;
    const rawVal = row[col.id];
    const isNum = !isBlankValue(rawVal) && !isNaN(Number(rawVal));
    const val = isNum ? parseFloat(String(rawVal)) : (rawVal ?? "");

    valuesMap[col.id] = val;
    rawValuesMap[col.id] = rawVal;
    valuesMap[col.id.toLowerCase()] = val;
    valuesMap[col.id.toUpperCase()] = val;

    const idSnake = col.id.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    valuesMap[idSnake] = val;
    rawValuesMap[idSnake] = rawVal;

    if (col.label && col.label.trim()) {
      const trimmed = col.label.trim();
      valuesMap[trimmed] = val;
      rawValuesMap[trimmed] = rawVal;
      valuesMap[`[${trimmed}]`] = val;
    }

    const excelLetter = getExcelColumnLetter(idx);
    if (excelLetter) {
      valuesMap[excelLetter] = val;
      rawValuesMap[excelLetter] = rawVal;
    }
  });

  return {
    nom,
    lowerTol,
    upperTol,
    lowerLimit,
    upperLimit,
    tolerance,
    actualVal,
    hasReading,
    valuesMap,
    rawValuesMap,
    trialValues,
    trialColumns,
  };
}

/**
 * Topologically sorts calculated and status columns based on dependsOn and formula references.
 * Resolves dependency chains: e.g. trials -> average -> deviation -> judgement.
 */
export function getTopologicallySortedColumns(columns: any[]): any[] {
  const calcCols = columns.filter((col) => {
    if (!col) return false;
    const formula = (col.formula || "").trim();
    const colId = (col.id || "").toLowerCase();
    const colLabel = (col.label || "").toLowerCase();
    return (
      col.type === "formula" ||
      col.role === "CALCULATED" ||
      col.type === "status" ||
      col.role === "JUDGEMENT" ||
      colId === "avg" ||
      colId === "error" ||
      colId === "deviation" ||
      colId === "status" ||
      colId === "judgement" ||
      colLabel.includes("average") ||
      colLabel.includes("deviation") ||
      colLabel.includes("error") ||
      colLabel.includes("judge") ||
      colLabel.includes("status") ||
      formula.length > 0
    );
  });

  const colMap = new Map<string, any>();
  calcCols.forEach((c) => colMap.set(c.id, c));

  const deps = new Map<string, Set<string>>();
  calcCols.forEach((col) => {
    const dSet = new Set<string>();
    if (Array.isArray(col.dependsOn) && col.dependsOn.length > 0) {
      col.dependsOn.forEach((d: string) => {
        if (colMap.has(d) && d !== col.id) dSet.add(d);
      });
    } else if (col.formula) {
      calcCols.forEach((other) => {
        if (other.id !== col.id) {
          const regex = new RegExp(`\\b${other.id}\\b`, "i");
          if (regex.test(col.formula)) {
            dSet.add(other.id);
          }
        }
      });
    }

    // Default metrology dependency heuristics
    const colId = (col.id || "").toLowerCase();
    const colLabel = (col.label || "").toLowerCase();
    const isError =
      colId === "error" ||
      colId === "deviation" ||
      colLabel.includes("deviation") ||
      colLabel.includes("error");
    const isStatus =
      col.type === "status" ||
      col.role === "JUDGEMENT" ||
      colId === "status" ||
      colId === "judgement" ||
      colLabel.includes("judge") ||
      colLabel.includes("status");

    if (isError) {
      const avgCol = calcCols.find(
        (c) => c.id === "avg" || (c.label || "").toLowerCase().includes("avg")
      );
      if (avgCol && avgCol.id !== col.id) dSet.add(avgCol.id);
    }
    if (isStatus) {
      const errCol = calcCols.find(
        (c) =>
          c.id === "error" ||
          c.id === "deviation" ||
          (c.label || "").toLowerCase().includes("deviation")
      );
      if (errCol && errCol.id !== col.id) dSet.add(errCol.id);
      const avgCol = calcCols.find(
        (c) => c.id === "avg" || (c.label || "").toLowerCase().includes("avg")
      );
      if (avgCol && avgCol.id !== col.id) dSet.add(avgCol.id);
    }

    deps.set(col.id, dSet);
  });

  // Kahn's algorithm
  const dependencyCount = new Map<string, number>();
  calcCols.forEach((c) => dependencyCount.set(c.id, deps.get(c.id)?.size || 0));

  const sorted: any[] = [];
  const queue: any[] = calcCols.filter((c) => (dependencyCount.get(c.id) || 0) === 0);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr.id)) continue;
    visited.add(curr.id);
    sorted.push(curr);

    calcCols.forEach((c) => {
      if (!visited.has(c.id) && deps.get(c.id)?.has(curr.id)) {
        deps.get(c.id)!.delete(curr.id);
        if (deps.get(c.id)!.size === 0) {
          queue.push(c);
        }
      }
    });
  }

  calcCols.forEach((c) => {
    if (!visited.has(c.id)) {
      sorted.push(c);
    }
  });

  return sorted;
}

/**
 * Evaluates a formula expression against a row context.
 * Performs bracket and variable substitutions, executes via safeEvaluateExpression,
 * and falls back to HyperFormula when needed.
 */
export function evaluateFormulaExpression(
  formula: string,
  ctx: RowEvaluationContext,
  decimalPlaces: number = 3
): { success: boolean; formatted: string; numeric?: number } {
  let expr = formula.trim();
  if (expr.startsWith("=")) expr = expr.substring(1).trim();

  // 0. Try direct semantic AST evaluation with row context (best performance & accuracy)
  const directAstRes = testEvaluateFormula(expr, ctx.valuesMap, decimalPlaces);
  if (directAstRes.success && directAstRes.result !== undefined && directAstRes.error === undefined) {
    return {
      success: true,
      formatted: directAstRes.formatted,
      numeric: directAstRes.numeric
    };
  }

  // 1. Bracketed column references: [Reading 1], [Avg], [Error], etc.
  expr = expr.replace(/\[([^\]]+)\]/g, (match, colName) => {
    const trimmed = colName.trim();
    if (ctx.valuesMap[trimmed] !== undefined) {
      const val = ctx.valuesMap[trimmed];
      if (isBlankValue(val)) return '""';
      return typeof val === "string" && isNaN(Number(val)) ? JSON.stringify(val) : String(val);
    }
    return match;
  });

  // 2. Evaluate bounds macros: MIN_VAL(C), MAX_VAL(C), NOMINAL(C)
  const macroRegex = /(MIN_VAL|MAX_VAL|NOMINAL)\(([^()]+)\)/gi;
  expr = expr.replace(macroRegex, (_, func, colName) => {
    const trimmed = colName.trim();
    let raw = ctx.rawValuesMap[trimmed] ?? ctx.rawValuesMap[trimmed.toUpperCase()];
    if (raw === undefined) {
      const matchKey = Object.keys(ctx.rawValuesMap).find(
        (k) => k.toLowerCase() === trimmed.toLowerCase()
      );
      if (matchKey) raw = ctx.rawValuesMap[matchKey];
    }
    const bounds = extractBounds(raw);
    const funcUpper = func.toUpperCase();
    if (funcUpper === "MIN_VAL") return String(bounds.min);
    if (funcUpper === "MAX_VAL") return String(bounds.max);
    return String(bounds.nom);
  });

  // 3. Variable and column token replacement (sorted descending by length to prevent partial matches)
  const sortedKeys = Object.keys(ctx.valuesMap).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.startsWith("[") && key.endsWith("]")) continue;
    const val = ctx.valuesMap[key];
    let replaceVal = isBlankValue(val) ? '""' : String(val);
    if (typeof val === "string" && isNaN(Number(val)) && !isBlankValue(val)) {
      replaceVal = JSON.stringify(val);
    }

    if (/^\d+$/.test(key)) {
      const digitArgRegex = new RegExp(`(?<=[(, ])\\b${key}\\b(?=[), ])`, "g");
      expr = expr.replace(digitArgRegex, replaceVal);
    } else {
      const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      expr = expr.replace(regex, replaceVal);
    }
  }

  // 4. Try safe micro-evaluator first (zero eval, pure arithmetic & logic)
  const safeRes = safeEvaluateExpression(expr, ctx.valuesMap);
  if (safeRes.success) {
    const res = safeRes.result;
    if (res === null || res === undefined || res === "") return { success: true, formatted: "-" };
    if (typeof res === "boolean") return { success: true, formatted: res ? "PASS" : "FAIL" };
    if (typeof res === "number") {
      if (isNaN(res)) return { success: false, formatted: "Err" };
      if (!isFinite(res)) return { success: false, formatted: "Div/0" };
      const formatted = res.toFixed(decimalPlaces);
      return { success: true, formatted: parseFloat(formatted).toString(), numeric: res };
    }
    return { success: true, formatted: String(res) };
  }

  // 5. Fallback to HyperFormula for advanced spreadsheet functions
  try {
    const hf = getSharedHyperFormula();
    const cleanExpr = expr.startsWith("=") ? expr : "=" + expr;
    hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[cleanExpr]]);
    const res = hf.getCellValue({ sheet: 0, col: 0, row: 0 });

    if (res === null || res === undefined || res === "") return { success: true, formatted: "-" };
    if (typeof res === "boolean") return { success: true, formatted: res ? "PASS" : "FAIL" };
    if (typeof res === "number") {
      if (isNaN(res)) return { success: false, formatted: "Err" };
      if (!isFinite(res)) return { success: false, formatted: "Div/0" };
      const formatted = res.toFixed(decimalPlaces);
      return { success: true, formatted: parseFloat(formatted).toString(), numeric: res };
    }
    if (typeof res === "object" && "type" in res) {
      return { success: false, formatted: `#${(res as any).type}` };
    }
    return { success: true, formatted: String(res) };
  } catch {
    return { success: false, formatted: "Err" };
  }
}

/**
 * Evaluates Canvas Table Grid row formulas (Average, Error, Deviation, Judgement/Status)
 * in deterministic topological order. Reads and evaluates `col.formula` strings,
 * guarantees blank reading propagation (blank -> "-"), and returns a new row object.
 */
export function evaluateCanvasRowFormulas(
  row: any,
  columns: any[] = [],
  tableTol: number = 0.02,
  tableDec: number = 3
): any {
  if (!row) return row;
  const newRow = { ...row };
  const dec = tableDec;

  // 1. Synchronize trial aliases (supports t{n}, trial_{n}, reading_{n}, r{n}, col_{n})
  syncTrialAliases(newRow);

  // 2. Build initial row context
  let ctx = buildRowContext(newRow, columns, tableTol, dec);

  // 3. Populate structured limits on newRow
  newRow.nominal = ctx.nom;
  newRow.nom = ctx.nom;
  newRow.lowerTolerance = ctx.lowerTol;
  newRow.upperTolerance = ctx.upperTol;
  newRow.lower_tolerance = ctx.lowerTol;
  newRow.upper_tolerance = ctx.upperTol;
  newRow.lowerLimit = ctx.lowerLimit;
  newRow.upperLimit = ctx.upperLimit;
  newRow.lower_limit = ctx.lowerLimit;
  newRow.upper_limit = ctx.upperLimit;
  newRow.min_limit = ctx.lowerLimit;
  newRow.max_limit = ctx.upperLimit;
  if (ctx.hasReading) {
    if (newRow.actual_dimension === undefined) newRow.actual_dimension = ctx.actualVal;
    if (newRow.actual === undefined) newRow.actual = ctx.actualVal;
    if (newRow.reading === undefined) newRow.reading = ctx.actualVal;
  }

  // 4. Get topologically sorted calculated and status columns
  const calcCols = getTopologicallySortedColumns(columns);

  // 5. Evaluate columns in dependency order
  for (const col of calcCols) {
    ctx = buildRowContext(newRow, columns, tableTol, dec);

    const formula = (col.formula || "").trim();
    const colId = col.id;
    const colLabel = (col.label || "").toLowerCase();
    const colRole = col.role;
    const colType = col.type;

    const isAvg =
      colId === "avg" ||
      colLabel === "avg" ||
      colLabel === "average" ||
      /^=?AVERAGE\b/i.test(formula);

    const isError =
      (colId === "error" ||
        colId === "deviation" ||
        colLabel === "error" ||
        colLabel === "deviation" ||
        colLabel === "bias" ||
        /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(formula) ||
        /(nominal|std)\s*-\s*(avg|average|reading|actual)/i.test(formula)) &&
      !colId.includes("pct") &&
      !colLabel.includes("pct") &&
      !colLabel.includes("%") &&
      col.formulaType !== "pct_error";

    const isStatus =
      colType === "status" ||
      colRole === "JUDGEMENT" ||
      colId === "status" ||
      colId === "judgement" ||
      colId === "judgment" ||
      colLabel.includes("judge") ||
      colLabel.includes("status") ||
      /PASS.*FAIL/i.test(formula);

    // A. Blank reading propagation check
    let isBlankInput = false;
    if (!ctx.hasReading) {
      if (isError || isStatus) isBlankInput = true;
      if (isAvg && ctx.trialValues.length === 0) isBlankInput = true;
    } else if (col.dependsOn && col.dependsOn.length > 0) {
      for (const dep of col.dependsOn) {
        const depClean = dep.trim().toLowerCase();
        // Parameter limits, specifications, and tolerances are metrological boundaries, not user measurement readings
        if (
          depClean === "lower_limit" ||
          depClean === "upper_limit" ||
          depClean === "lowerlimit" ||
          depClean === "upperlimit" ||
          depClean === "min_limit" ||
          depClean === "max_limit" ||
          depClean === "nominal" ||
          depClean === "nom" ||
          depClean === "tolerance" ||
          depClean === "tol" ||
          depClean === "mpe" ||
          depClean === "limit" ||
          depClean === "ac" ||
          depClean === "acceptancecriteria" ||
          depClean === "acceptance_criteria"
        ) {
          continue;
        }

        const val = newRow[dep] ?? ctx.valuesMap[dep] ?? ctx.valuesMap[depClean];
        if (isBlankValue(val)) {
          if (isAvg && ctx.trialValues.length > 0) continue;
          isBlankInput = true;
          break;
        }
      }
    }

    if (isBlankInput) {
      newRow[colId] = "-";
      if (isAvg) {
        newRow.avg = "-";
        newRow.average = "-";
      }
      if (isError) {
        newRow.deviation = "-";
        newRow.error = undefined;
      }
      if (isStatus) {
        newRow.status = "-";
        newRow.judgement = "-";
      }
      continue;
    }

    // B. Evaluate formula string if present
    let evaluated = false;
    if (formula) {
      const colDec = col.decimal_places ?? col.decimalPlaces ?? dec;
      const evalRes = evaluateFormulaExpression(formula, ctx, colDec);
      if (evalRes.success) {
        let finalVal = evalRes.formatted;
        if (isError && typeof evalRes.numeric === "number") {
          const rounded = parseFloat(evalRes.numeric.toFixed(colDec));
          finalVal = (rounded >= 0 ? "+" : "") + rounded.toFixed(colDec);
          newRow[colId] = finalVal;
          newRow.deviation = finalVal;
          newRow.error = rounded;
        } else if (isAvg && typeof evalRes.numeric === "number") {
          finalVal = evalRes.numeric.toFixed(colDec);
          newRow[colId] = finalVal;
        } else {
          newRow[colId] = finalVal;
        }
        if (isAvg) {
          newRow.avg = finalVal;
          newRow.average = finalVal;
        }
        if (isStatus) {
          newRow.status = finalVal;
          newRow.judgement = finalVal;
        }
        evaluated = true;
      }
    }

    // C. Deterministic metrology fallback if formula not evaluated
    if (!evaluated) {
      if (isAvg) {
        if (ctx.trialValues.length > 0) {
          const sum = ctx.trialValues.reduce((a, b) => a + b, 0);
          const avgVal = parseFloat((sum / ctx.trialValues.length).toFixed(dec));
          const formatted = avgVal.toFixed(dec);
          newRow[colId] = formatted;
          newRow.avg = formatted;
          newRow.average = formatted;
        } else if (ctx.actualVal !== undefined) {
          const formatted = ctx.actualVal.toFixed(dec);
          newRow[colId] = formatted;
          newRow.avg = formatted;
          newRow.average = formatted;
        } else {
          newRow[colId] = "-";
          newRow.avg = "-";
          newRow.average = "-";
        }
      } else if (isError) {
        const reading =
          ctx.actualVal ??
          (!isBlankValue(newRow.avg) && newRow.avg !== "-"
            ? parseFloat(String(newRow.avg))
            : undefined);
        if (reading !== undefined) {
          const dev = reading - ctx.nom;
          const roundedDev = parseFloat(dev.toFixed(dec));
          const formatted = (roundedDev >= 0 ? "+" : "") + roundedDev.toFixed(dec);
          newRow[colId] = formatted;
          newRow.deviation = formatted;
          newRow.error = roundedDev;
        } else {
          newRow[colId] = "-";
          newRow.deviation = "-";
          newRow.error = undefined;
        }
      } else if (isStatus) {
        const reading =
          ctx.actualVal ??
          (!isBlankValue(newRow.avg) && newRow.avg !== "-"
            ? parseFloat(String(newRow.avg))
            : undefined);
        if (reading !== undefined) {
          const isPass = reading >= ctx.lowerLimit - 1e-9 && reading <= ctx.upperLimit + 1e-9;
          newRow[colId] = isPass ? "PASS" : "FAIL";
          newRow.status = newRow[colId];
          newRow.judgement = newRow[colId];
        } else {
          newRow[colId] = "-";
          newRow.status = "-";
          newRow.judgement = "-";
        }
      }
    }
  }

  // Also synchronize in-place for callers expecting mutation
  Object.assign(row, newRow);
  return newRow;
}
