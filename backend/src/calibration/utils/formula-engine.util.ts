/**
 * Gaugemaster Authoritative Metrology & Formula Engine (Backend)
 *
 * Implements safe, zero-eval Abstract Syntax Tree (AST) formula evaluation,
 * specification parsing, asymmetric tolerance handling, and strict blank propagation.
 *
 * Architecture Invariants:
 * 1. Zero eval() or new Function() — 100% deterministic recursive-descent AST evaluator.
 * 2. Blanks never become zero: blank/null/undefined readings return "-" without false passes.
 * 3. Full asymmetric tolerance support: reading must be within [lowerLimit, upperLimit].
 * 4. 100% backward compatibility: seamlessly evaluates legacy string formulas and AST formulas.
 */

// ============================================================================
// 1. SPECIFICATION PARSER & METROLOGICAL TYPES
// ============================================================================

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
  isMaxLimit?: boolean;
  isMinLimit?: boolean;
}

function getDecimalCount(numStr: string): number {
  if (!numStr) return 0;
  const clean = numStr.trim();
  const parts = clean.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

export function parseSpecification(
  specText: string,
  defaultUnit: string = 'mm',
  defaultTolerance: number = 0.02,
  defaultDecimalPlaces: number = 3,
): StructuredSpecification {
  const emptyResult: StructuredSpecification = {
    specificationText: specText || '',
    nominal: 0,
    lowerTolerance: -defaultTolerance,
    upperTolerance: defaultTolerance,
    lowerLimit: -defaultTolerance,
    upperLimit: defaultTolerance,
    unit: defaultUnit,
    decimalPrecision: defaultDecimalPlaces,
    isValid: false,
  };

  if (!specText || typeof specText !== 'string' || !specText.trim()) {
    return emptyResult;
  }

  const rawText = specText.trim();
  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let primaryTarget = rawLines[0] || rawText;
  for (const line of rawLines) {
    if (!line.startsWith('(') && !line.startsWith('[')) {
      primaryTarget = line;
      break;
    }
  }

  const cleanTarget = primaryTarget.replace(/\s*[\(\[].*?[\)\]]\s*$/, '').trim() || primaryTarget;
  const cleanTargetWithoutUnit =
    cleanTarget.replace(/\s*(?:mm|µm|um|micron|inch|in|deg|°)\s*$/i, '').trim() || cleanTarget;
  const normalized = cleanTargetWithoutUnit.replace(/[–—]/g, '-').replace(/\s+/g, ' ');

  // 1. Symmetric tolerance: e.g. "Shaft Dist 13±0.01", "50.0±0.005", "SR43.414±0.005", "Ø35±0.01"
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

  // 2. Dual asymmetric tolerances: e.g. "Shaft Ø35.035-0.02/-0.01", "Ø12-0.006/-0.017", "10+0.02/+0.01"
  const dualRegex =
    /^(?:(.+?)\s+)?(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*([+-]\d+(?:\.\d+)?)\s*[\/\\]\s*([+-]\d+(?:\.\d+)?)$/i;
  const dualMatch = normalized.match(dualRegex);
  if (dualMatch) {
    const desc = dualMatch[1]?.trim();
    const nomStr = dualMatch[2];
    const v1Str = dualMatch[3];
    const v2Str = dualMatch[4];
    const nom = parseFloat(nomStr);
    const v1 = parseFloat(v1Str);
    const v2 = parseFloat(v2Str);
    const dec = Math.max(
      getDecimalCount(nomStr),
      getDecimalCount(v1Str),
      getDecimalCount(v2Str),
      defaultDecimalPlaces,
    );

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

  // 3. Single positive-only tolerance: e.g. "Shaft ID Ø12+0.018", "12+0.018"
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

  // 4. Range specification: e.g. "12.000 - 12.018", "12.000 to 12.018"
  const rangeRegex =
    /^(?:(.+?)\s+)?(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*(?:-|–|—|\bto\b|~)\s*(-?\d+(?:\.\d+)?)$/i;
  const rangeMatch = normalized.match(rangeRegex);
  if (rangeMatch) {
    const desc = rangeMatch[1]?.trim();
    const v1Str = rangeMatch[2];
    const v2Str = rangeMatch[3];
    const v1 = parseFloat(v1Str);
    const v2 = parseFloat(v2Str);

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

  // 5. Single negative-only tolerance: e.g. "50.0-0.005"
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

  // 6. Maximum limit specification: e.g. "0.003Max", "<=0.003"
  const maxRegex =
    /^(?:(.+?)\s+)?(?:(?:max\.?|maximum|<=?)\s*([ØRSR\s]*-?\d+(?:\.\d+)?)|(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*(?:max\.?|maximum))$/i;
  const maxMatch = normalized.match(maxRegex);
  if (maxMatch) {
    const desc = maxMatch[1]?.trim();
    const valStr = maxMatch[2] || maxMatch[3];
    const val = parseFloat(valStr);
    const dec = Math.max(getDecimalCount(valStr), defaultDecimalPlaces);

    if (!isNaN(val)) {
      return {
        specificationText: rawText,
        description: desc || undefined,
        nominal: 0,
        lowerTolerance: 0,
        upperTolerance: val,
        lowerLimit: 0,
        upperLimit: val,
        unit: defaultUnit,
        decimalPrecision: dec,
        isValid: true,
        isMaxLimit: true,
      };
    }
  }

  // 7. Minimum limit specification: e.g. "0.003Min", ">=0.003"
  const minRegex =
    /^(?:(.+?)\s+)?(?:(?:min\.?|minimum|>=?)\s*([ØRSR\s]*-?\d+(?:\.\d+)?)|(?:[ØRSR\s]*)(-?\d+(?:\.\d+)?)\s*(?:min\.?|minimum))$/i;
  const minMatch = normalized.match(minRegex);
  if (minMatch) {
    const desc = minMatch[1]?.trim();
    const valStr = minMatch[2] || minMatch[3];
    const val = parseFloat(valStr);
    const dec = Math.max(getDecimalCount(valStr), defaultDecimalPlaces);

    if (!isNaN(val)) {
      return {
        specificationText: rawText,
        description: desc || undefined,
        nominal: val,
        lowerTolerance: 0,
        upperTolerance: 999999,
        lowerLimit: val,
        upperLimit: 999999,
        unit: defaultUnit,
        decimalPrecision: dec,
        isValid: true,
        isMinLimit: true,
      };
    }
  }

  // 8. Plain numeric dimension without tolerance operator: e.g. "35.035"
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

export function extractBounds(val: any): { min: number; max: number; nom: number } {
  if (typeof val === 'number') return { min: val, max: val, nom: val };
  if (!val) return { min: 0, max: 0, nom: 0 };
  const str = String(val).trim();

  const parsed = parseSpecification(str);
  if (parsed.isValid) {
    return { min: parsed.lowerLimit, max: parsed.upperLimit, nom: parsed.nominal };
  }

  const pmMatch = str.match(/^(-?[\d.]+)\s*±\s*([\d.]+)$/);
  if (pmMatch) {
    const nom = parseFloat(pmMatch[1]);
    const tol = parseFloat(pmMatch[2]);
    return { min: nom - tol, max: nom + tol, nom };
  }

  const diffMatch = str.match(/^(-?[\d.]+)\s*\+\s*([\d.]+)\s*[\/\\]?\s*-\s*([\d.]+)$/);
  if (diffMatch) {
    const nom = parseFloat(diffMatch[1]);
    const plus = parseFloat(diffMatch[2]);
    const minus = parseFloat(diffMatch[3]);
    return { min: nom - minus, max: nom + plus, nom };
  }

  const num = parseFloat(str);
  return { min: num || 0, max: num || 0, nom: num || 0 };
}

// ============================================================================
// 2. TOKENIZER & AST TYPES
// ============================================================================

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: any;
  isBracketed?: boolean;
}

export type ASTNode =
  | { type: 'NumberLiteral'; value: number }
  | { type: 'StringLiteral'; value: string }
  | { type: 'BooleanLiteral'; value: boolean }
  | { type: 'Identifier'; name: string; isBracketed?: boolean }
  | { type: 'UnaryExpression'; operator: string; argument: ASTNode }
  | { type: 'BinaryExpression'; operator: string; left: ASTNode; right: ASTNode }
  | { type: 'FunctionCall'; name: string; args: ASTNode[] };

export const SUPPORTED_FUNCTIONS = [
  'IF',
  'AND',
  'OR',
  'NOT',
  'ISBLANK',
  'ABS',
  'SQRT',
  'ROUND',
  'MIN',
  'MAX',
  'AVERAGE',
  'AVG',
  'SUM',
  'COUNT',
  'STDEV',
  'STDEVP',
  'MIN_VAL',
  'MAX_VAL',
  'NOMINAL',
] as const;

export function isBlankValue(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') {
    const s = val.trim();
    return s === '' || s === '-';
  }
  return false;
}

export function parseToleranceValue(val: any): number | undefined {
  if (val === undefined || val === null || isBlankValue(val)) return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : Math.abs(val);
  const str = String(val).trim().replace(/^[±+-]/, '').trim();
  if (!str) return undefined;
  const match = str.match(/^\d+(?:\.\d+)?/);
  if (match) {
    const p = parseFloat(match[0]);
    return isNaN(p) ? undefined : p;
  }
  const direct = parseFloat(str);
  return isNaN(direct) ? undefined : Math.abs(direct);
}

// ============================================================================
// 3. AST TOKENIZER & PARSER
// ============================================================================

export function tokenizeFormula(formulaStr: string): { tokens: Token[]; error?: string } {
  let clean = formulaStr.trim();
  if (clean.startsWith('=')) clean = clean.substring(1).trim();
  if (!clean) return { tokens: [{ type: 'EOF', value: null }] };

  const tokens: Token[] = [];
  let pos = 0;
  const len = clean.length;

  while (pos < len) {
    const ch = clean[pos];

    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    // Bracketed identifier: [Column Name]
    if (ch === '[') {
      pos++;
      let bracketed = '';
      while (pos < len && clean[pos] !== ']') {
        bracketed += clean[pos++];
      }
      if (pos >= len || clean[pos] !== ']') {
        return { tokens: [], error: 'Unclosed bracket in column identifier: [' + bracketed };
      }
      pos++; // consume ']'
      let fullIdent = bracketed.trim();

      if (pos < len && clean[pos] === '.') {
        pos++;
        if (pos < len && clean[pos] === '[') {
          pos++;
          let subBracket = '';
          while (pos < len && clean[pos] !== ']') {
            subBracket += clean[pos++];
          }
          if (pos < len && clean[pos] === ']') pos++;
          fullIdent += '.' + subBracket.trim();
        } else {
          let subIdent = '';
          while (pos < len && /[a-zA-Z0-9_]/.test(clean[pos])) {
            subIdent += clean[pos++];
          }
          if (subIdent) fullIdent += '.' + subIdent;
        }
      }

      tokens.push({ type: 'IDENTIFIER', value: fullIdent, isBracketed: true });
      continue;
    }

    // Number literal
    if (/\d/.test(ch) || (ch === '.' && pos + 1 < len && /\d/.test(clean[pos + 1]))) {
      let numStr = '';
      while (pos < len && /[\d.]/.test(clean[pos])) {
        numStr += clean[pos++];
      }
      if (pos < len && (clean[pos] === 'e' || clean[pos] === 'E')) {
        numStr += clean[pos++];
        if (pos < len && (clean[pos] === '+' || clean[pos] === '-')) {
          numStr += clean[pos++];
        }
        while (pos < len && /\d/.test(clean[pos])) {
          numStr += clean[pos++];
        }
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) return { tokens: [], error: `Invalid number format: ${numStr}` };
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    // String literal
    if (ch === '"' || ch === "'") {
      const quote = ch;
      pos++;
      let str = '';
      while (pos < len && clean[pos] !== quote) {
        if (clean[pos] === '\\' && pos + 1 < len) {
          pos++;
          str += clean[pos++];
        } else {
          str += clean[pos++];
        }
      }
      if (pos >= len || clean[pos] !== quote) {
        return { tokens: [], error: 'Unterminated string literal' };
      }
      pos++;
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      pos++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      pos++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      pos++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'OPERATOR', value: ':' });
      pos++;
      continue;
    }

    const twoChars = clean.substring(pos, pos + 2);
    const threeChars = clean.substring(pos, pos + 3);

    if (threeChars === '===' || threeChars === '!==') {
      tokens.push({ type: 'OPERATOR', value: threeChars });
      pos += 3;
      continue;
    }

    if (
      twoChars === '<=' ||
      twoChars === '>=' ||
      twoChars === '==' ||
      twoChars === '!=' ||
      twoChars === '<>' ||
      twoChars === '&&' ||
      twoChars === '||' ||
      twoChars === '**'
    ) {
      tokens.push({ type: 'OPERATOR', value: twoChars === '<>' ? '!=' : twoChars });
      pos += 2;
      continue;
    }

    if ('+-*/%^=<>!'.includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch === '^' ? '**' : ch });
      pos++;
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (
        pos < len &&
        (/[a-zA-Z0-9_]/.test(clean[pos]) ||
          ((clean[pos] === '.' || clean[pos] === '!') && pos + 1 < len && /[a-zA-Z0-9_]/.test(clean[pos + 1])))
      ) {
        ident += clean[pos++];
      }

      const upper = ident.toUpperCase();
      if (upper === 'TRUE') {
        tokens.push({ type: 'BOOLEAN', value: true });
      } else if (upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: false });
      } else if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
        let nextPos = pos;
        while (nextPos < len && /\s/.test(clean[nextPos])) {
          nextPos++;
        }
        if (nextPos < len && clean[nextPos] === '(') {
          tokens.push({ type: 'IDENTIFIER', value: ident });
        } else {
          if (upper === 'AND') tokens.push({ type: 'OPERATOR', value: '&&' });
          else if (upper === 'OR') tokens.push({ type: 'OPERATOR', value: '||' });
          else if (upper === 'NOT') tokens.push({ type: 'OPERATOR', value: '!' });
        }
      } else {
        tokens.push({ type: 'IDENTIFIER', value: ident });
      }
      continue;
    }

    return { tokens: [], error: `Unexpected character in formula: '${ch}'` };
  }

  tokens.push({ type: 'EOF', value: null });
  return { tokens };
}

export function parseFormulaAST(formulaStr: string): { ast: ASTNode | null; error?: string } {
  const { tokens, error } = tokenizeFormula(formulaStr);
  if (error || !tokens.length) {
    return { ast: null, error: error || 'Empty expression' };
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
      while (currentToken().type === 'OPERATOR' && currentToken().value === '||') {
        const op = consumeToken().value;
        const right = parseLogicalAnd();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    };

    const parseLogicalAnd = (): ASTNode => {
      let left = parseEquality();
      while (currentToken().type === 'OPERATOR' && currentToken().value === '&&') {
        const op = consumeToken().value;
        const right = parseEquality();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    };

    const parseEquality = (): ASTNode => {
      let left = parseRelational();
      while (
        currentToken().type === 'OPERATOR' &&
        ['==', '===', '=', '!=', '!=='].includes(currentToken().value)
      ) {
        let op = consumeToken().value;
        if (op === '=') op = '==';
        const right = parseRelational();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    };

    const parseRelational = (): ASTNode => {
      let left = parseAdditive();
      while (
        currentToken().type === 'OPERATOR' &&
        ['<', '<=', '>', '>='].includes(currentToken().value)
      ) {
        const op = consumeToken().value;
        const right = parseAdditive();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    };

    const parseAdditive = (): ASTNode => {
      let left = parseMultiplicative();
      while (
        currentToken().type === 'OPERATOR' &&
        (currentToken().value === '+' || currentToken().value === '-')
      ) {
        const op = consumeToken().value;
        const right = parseMultiplicative();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    };

    const parseMultiplicative = (): ASTNode => {
      let left = parsePower();
      while (
        currentToken().type === 'OPERATOR' &&
        (currentToken().value === '*' || currentToken().value === '/' || currentToken().value === '%')
      ) {
        const op = consumeToken().value;
        const right = parsePower();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    };

    const parsePower = (): ASTNode => {
      let left = parseUnary();
      while (currentToken().type === 'OPERATOR' && currentToken().value === '**') {
        consumeToken();
        const right = parseUnary();
        left = { type: 'BinaryExpression', operator: '**', left, right };
      }
      return left;
    };

    const parseUnary = (): ASTNode => {
      if (currentToken().type === 'OPERATOR') {
        const op = currentToken().value;
        if (op === '+' || op === '-' || op === '!') {
          consumeToken();
          const arg = parseUnary();
          return { type: 'UnaryExpression', operator: op, argument: arg };
        }
      }
      return parsePrimary();
    };

    const parsePrimary = (): ASTNode => {
      const tok = currentToken();

      if (tok.type === 'NUMBER') {
        consumeToken('NUMBER');
        return { type: 'NumberLiteral', value: tok.value };
      }

      if (tok.type === 'STRING') {
        consumeToken('STRING');
        return { type: 'StringLiteral', value: tok.value };
      }

      if (tok.type === 'BOOLEAN') {
        consumeToken('BOOLEAN');
        return { type: 'BooleanLiteral', value: tok.value };
      }

      if (tok.type === 'LPAREN') {
        consumeToken('LPAREN');
        const expr = parseLogicalOr();
        consumeToken('RPAREN');
        return expr;
      }

      if (tok.type === 'IDENTIFIER') {
        const idTok = consumeToken('IDENTIFIER');
        const identStr = idTok.value;
        const upper = identStr.toUpperCase();
        const rootIdent = identStr.split('.')[0].toUpperCase();

        const DISALLOWED = ['FUNCTION', 'EVAL', 'WINDOW', 'DOCUMENT', 'PROCESS', 'GLOBAL', 'REQUIRE'];
        if (DISALLOWED.includes(rootIdent)) {
          throw new Error(`Security error: Disallowed identifier '${identStr}'`);
        }

        if (currentToken().type === 'LPAREN') {
          if (!(SUPPORTED_FUNCTIONS as readonly string[]).includes(upper)) {
            throw new Error(`Unknown or unsupported function: '${identStr}'`);
          }

          consumeToken('LPAREN');
          const args: ASTNode[] = [];
          if (currentToken().type !== 'RPAREN') {
            args.push(parseLogicalOr());
            while (currentToken().type === 'COMMA') {
              consumeToken('COMMA');
              args.push(parseLogicalOr());
            }
          }
          consumeToken('RPAREN');
          return { type: 'FunctionCall', name: upper, args };
        }

        return { type: 'Identifier', name: identStr, isBracketed: idTok.isBracketed };
      }

      if (tok.type === 'EOF') {
        throw new Error('Unexpected end of formula: missing operand');
      }

      throw new Error(`Unexpected token '${tok.value}'`);
    };

    const ast = parseLogicalOr();
    if (currentToken().type !== 'EOF') {
      throw new Error(`Unexpected extra content after expression: '${currentToken().value}'`);
    }
    return { ast };
  } catch (err: any) {
    return { ast: null, error: err.message || 'Invalid formula expression' };
  }
}

function flattenNumericArgs(args: any[]): number[] {
  const result: number[] = [];
  for (const item of args) {
    if (item === null || item === undefined || isBlankValue(item)) continue;
    if (Array.isArray(item)) {
      result.push(...flattenNumericArgs(item));
    } else {
      const num = Number(item);
      if (!isNaN(num)) result.push(num);
    }
  }
  return result;
}

// ============================================================================
// 4. AST EVALUATOR
// ============================================================================

export function evaluateAST(
  ast: ASTNode,
  context: Record<string, any> = {},
  options: { isBlankDetection?: boolean } = {},
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

    const clean = name.trim().toLowerCase();
    const matchKey = Object.keys(context).find((k) => k.trim().toLowerCase() === clean);
    if (matchKey !== undefined) return context[matchKey];

    return undefined;
  }

  function evalNode(node: ASTNode): any {
    if (node.type === 'NumberLiteral') return node.value;
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'BooleanLiteral') return node.value;

    if (node.type === 'Identifier') {
      const upper = node.name.toUpperCase();
      if (['PASS', 'FAIL', 'OK', 'NG', 'REJECT', 'ACCEPT', 'NORMAL'].includes(upper) && !(node.name in context)) {
        return upper;
      }
      const val = getVar(node.name);
      if (options.isBlankDetection && isBlankValue(val)) {
        return null;
      }
      if (val === null || val === undefined) return null;
      if (Array.isArray(val)) return val;
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val;
      const num = parseFloat(String(val));
      return isNaN(num) ? val : num;
    }

    if (node.type === 'UnaryExpression') {
      const val = evalNode(node.argument);
      if (val === null) return null;
      if (node.operator === '+') return +Number(val);
      if (node.operator === '-') return -Number(val);
      if (node.operator === '!') return !Boolean(val);
    }

    if (node.type === 'BinaryExpression') {
      const left = evalNode(node.left);
      const right = evalNode(node.right);

      if (options.isBlankDetection && (left === null || right === null)) {
        return null;
      }

      const numL = Number(left);
      const numR = Number(right);

      switch (node.operator) {
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            return String(left) + String(right);
          }
          return numL + numR;
        case '-':
          return numL - numR;
        case '*':
          return numL * numR;
        case '/':
          return numR === 0 ? Infinity : numL / numR;
        case '%':
          return numL % numR;
        case '**':
          return Math.pow(numL, numR);
        case '==':
        case '===':
          if (typeof left === 'number' && typeof right === 'number') {
            return Math.abs(left - right) < 1e-9;
          }
          return left === right;
        case '!=':
        case '!==':
          if (typeof left === 'number' && typeof right === 'number') {
            return Math.abs(left - right) >= 1e-9;
          }
          return left !== right;
        case '<':
          return !isNaN(numL) && !isNaN(numR) ? numL < numR - 1e-9 : left < right;
        case '<=':
          return !isNaN(numL) && !isNaN(numR) ? numL <= numR + 1e-9 : left <= right;
        case '>':
          return !isNaN(numL) && !isNaN(numR) ? numL > numR + 1e-9 : left > right;
        case '>=':
          return !isNaN(numL) && !isNaN(numR) ? numL >= numR - 1e-9 : left >= right;
        case '&&':
          return Boolean(left) && Boolean(right);
        case '||':
          return Boolean(left) || Boolean(right);
        default:
          throw new Error(`Unsupported binary operator: ${node.operator}`);
      }
    }

    if (node.type === 'FunctionCall') {
      if (node.name === 'IF') {
        if (!node.args.length) throw new Error('IF requires at least 1 argument');
        const cond = evalNode(node.args[0]);
        if (options.isBlankDetection && cond === null) return null;
        if (cond) {
          return node.args[1] ? evalNode(node.args[1]) : true;
        } else {
          return node.args[2] ? evalNode(node.args[2]) : false;
        }
      }

      const evaluatedArgs = node.args.map((a) => evalNode(a));

      switch (node.name) {
        case 'AND': {
          if (options.isBlankDetection && evaluatedArgs.some((arg) => arg === null)) return null;
          return evaluatedArgs.every((arg) => Boolean(arg) && arg !== null);
        }
        case 'OR': {
          if (options.isBlankDetection && evaluatedArgs.some((arg) => arg === null)) {
            if (evaluatedArgs.some((arg) => arg === true)) return true;
            return null;
          }
          return evaluatedArgs.some((arg) => Boolean(arg) && arg !== null);
        }
        case 'NOT':
          if (options.isBlankDetection && evaluatedArgs[0] === null) return null;
          return !Boolean(evaluatedArgs[0]);
        case 'ISBLANK': {
          const raw = evaluatedArgs[0];
          return isBlankValue(raw) || raw === null || raw === undefined;
        }
        case 'ABS':
          if (options.isBlankDetection && (evaluatedArgs[0] === null || isBlankValue(evaluatedArgs[0]))) {
            return null;
          }
          return Math.abs(Number(evaluatedArgs[0]));
        case 'SQRT': {
          if (options.isBlankDetection && (evaluatedArgs[0] === null || isBlankValue(evaluatedArgs[0]))) {
            return null;
          }
          const val = Number(evaluatedArgs[0]);
          return val < 0 ? NaN : Math.sqrt(val);
        }
        case 'ROUND': {
          if (options.isBlankDetection && (evaluatedArgs[0] === null || isBlankValue(evaluatedArgs[0]))) {
            return null;
          }
          const num = Number(evaluatedArgs[0]);
          const dec = Number(evaluatedArgs[1] || 0);
          return isNaN(num) ? 0 : parseFloat(num.toFixed(dec));
        }
        case 'MIN': {
          const nums = flattenNumericArgs(evaluatedArgs);
          if (options.isBlankDetection && nums.length === 0) return null;
          return nums.length ? Math.min(...nums) : 0;
        }
        case 'MAX': {
          const nums = flattenNumericArgs(evaluatedArgs);
          if (options.isBlankDetection && nums.length === 0) return null;
          return nums.length ? Math.max(...nums) : 0;
        }
        case 'AVERAGE':
        case 'AVG': {
          const nums = flattenNumericArgs(evaluatedArgs);
          if (options.isBlankDetection && nums.length === 0) return null;
          return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        }
        case 'SUM': {
          const nums = flattenNumericArgs(evaluatedArgs);
          if (options.isBlankDetection && nums.length === 0) return null;
          return nums.reduce((a, b) => a + b, 0);
        }
        case 'COUNT': {
          const nums = flattenNumericArgs(evaluatedArgs);
          return nums.length;
        }
        case 'STDEV':
        case 'STDEVP': {
          const nums = flattenNumericArgs(evaluatedArgs);
          if (nums.length <= 1) return 0;
          const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
          const variance =
            nums.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / (nums.length - 1);
          return Math.sqrt(variance);
        }
        case 'MIN_VAL':
        case 'MAX_VAL':
        case 'NOMINAL': {
          const raw = evaluatedArgs[0];
          const bounds = extractBounds(raw);
          if (node.name === 'MIN_VAL') return bounds.min;
          if (node.name === 'MAX_VAL') return bounds.max;
          return bounds.nom;
        }
        default:
          throw new Error(`Unknown function: ${node.name}`);
      }
    }

    throw new Error('Invalid AST node');
  }

  return evalNode(ast);
}

// ============================================================================
// 5. ROW METROLOGY CONTEXT BUILDER
// ============================================================================

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
  trialValues: number[];
  isMaxLimit: boolean;
  isMinLimit: boolean;
}

export function buildRowEvaluationContext(
  row: any,
  columns: any[] = [],
  tableTol: number = 0.02,
  tableDec: number = 3,
): RowEvaluationContext {
  const dec = tableDec;

  const specText =
    row.specificationText ||
    row.specification ||
    row.specification_text ||
    row.description ||
    row.gauge_receipt_condition ||
    row.required_dimension ||
    '';

  const rawNomCandidate =
    row.nominal_value !== undefined && row.nominal_value !== null && String(row.nominal_value).trim() !== ''
      ? row.nominal_value
      : row.nominal !== undefined && row.nominal !== null && String(row.nominal).trim() !== '' && row.nominal !== 0 && row.nominal !== '0'
      ? row.nominal
      : row.nom ?? row.std_spec ?? row.std_value ?? row.nominal;

  let nom = typeof rawNomCandidate === 'number' ? rawNomCandidate : parseFloat(String(rawNomCandidate)) || 0;
  let lowerTol: number | undefined =
    typeof row.lowerTolerance === 'number'
      ? row.lowerTolerance
      : typeof row.lower_tolerance === 'number'
      ? row.lower_tolerance
      : undefined;
  let upperTol: number | undefined =
    typeof row.upperTolerance === 'number'
      ? row.upperTolerance
      : typeof row.upper_tolerance === 'number'
      ? row.upper_tolerance
      : undefined;

  let isMaxLimit = false;
  let isMinLimit = false;
  let parsedSpecResult: StructuredSpecification | null = null;

  if (specText) {
    const parsed = parseSpecification(specText, row.unit || 'mm', tableTol, dec);
    if (parsed.isValid) {
      parsedSpecResult = parsed;
      if (isNaN(nom) || nom === 0 || parsed.isMaxLimit || parsed.isMinLimit) {
        nom = parsed.nominal;
      }
      if (lowerTol === undefined || parsed.isMaxLimit || parsed.isMinLimit) {
        lowerTol = parsed.lowerTolerance;
      }
      if (upperTol === undefined || parsed.isMaxLimit || parsed.isMinLimit) {
        upperTol = parsed.upperTolerance;
      }
      if (parsed.isMaxLimit) isMaxLimit = true;
      if (parsed.isMinLimit) isMinLimit = true;
    }
  }

  // Check if explicit row limits already exist
  const existingLowerLimit =
    typeof row.lower_limit === 'number'
      ? row.lower_limit
      : typeof row.lowerLimit === 'number'
      ? row.lowerLimit
      : !isBlankValue(row.lower_limit ?? row.lowerLimit)
      ? parseFloat(String(row.lower_limit ?? row.lowerLimit))
      : NaN;

  const existingUpperLimit =
    typeof row.upper_limit === 'number'
      ? row.upper_limit
      : typeof row.upperLimit === 'number'
      ? row.upperLimit
      : !isBlankValue(row.upper_limit ?? row.upperLimit)
      ? parseFloat(String(row.upper_limit ?? row.upperLimit))
      : NaN;

  if (lowerTol === undefined && !isNaN(existingLowerLimit) && !isMaxLimit && !isMinLimit) {
    lowerTol = existingLowerLimit - nom;
  }
  if (upperTol === undefined && !isNaN(existingUpperLimit) && !isMaxLimit && !isMinLimit) {
    upperTol = existingUpperLimit - nom;
  }

  const tolCol = columns.find(
    (c) =>
      c &&
      (c.type === 'tolerance' ||
        c.role === 'TOLERANCE' ||
        /^(tolerance|tol|tolarance)$/i.test(c.id || '') ||
        /tolerance|tolarance/i.test(c.label || '')),
  );

  const rowColTol = tolCol ? parseToleranceValue(row[tolCol.id]) : undefined;
  if (rowColTol !== undefined && lowerTol === undefined && upperTol === undefined) {
    lowerTol = -rowColTol;
    upperTol = rowColTol;
  }

  if (lowerTol === undefined) {
    const tolVal =
      rowColTol !== undefined
        ? rowColTol
        : typeof row.tolerance === 'number'
        ? row.tolerance
        : parseToleranceValue(row.tolerance) ??
          ((parseFloat(String(row.tolerance ?? tableTol)) || tableTol));
    lowerTol = -tolVal;
    upperTol = tolVal;
  }
  if (upperTol === undefined) upperTol = -lowerTol;

  const lowerLimit = isMaxLimit
    ? (parsedSpecResult?.lowerLimit ?? 0)
    : (!isNaN(existingLowerLimit) ? existingLowerLimit : (nom + lowerTol));
  const upperLimit = isMaxLimit
    ? (parsedSpecResult?.upperLimit ?? upperTol)
    : (!isNaN(existingUpperLimit) ? existingUpperLimit : (nom + upperTol));
  const tolerance = isMaxLimit
    ? (parsedSpecResult?.upperTolerance ?? upperTol)
    : (rowColTol !== undefined
        ? rowColTol
        : typeof row.tolerance === 'number'
        ? row.tolerance
        : Math.max(Math.abs(lowerTol), Math.abs(upperTol)));

  // Identify trial values
  const trialValues: number[] = [];
  for (let i = 1; i <= 20; i++) {
    const aliases = [
      `t${i}`,
      `trial_${i}`,
      `trial${i}`,
      `reading_${i}`,
      `reading${i}`,
      `actual_${i}`,
      `actual${i}`,
      `col_${i}`,
      String(i),
    ];
    for (const a of aliases) {
      const v = row[a];
      if (!isBlankValue(v)) {
        const num = parseFloat(String(v));
        if (!isNaN(num)) {
          trialValues.push(num);
        }
        break;
      }
    }
  }

  let actualVal: number | undefined = undefined;
  if (trialValues.length > 0) {
    actualVal = trialValues.reduce((a, b) => a + b, 0) / trialValues.length;
  } else if (!isBlankValue(row.avg) && row.avg !== '-') {
    actualVal = parseFloat(String(row.avg));
  } else if (!isBlankValue(row.average) && row.average !== '-') {
    actualVal = parseFloat(String(row.average));
  } else if (!isBlankValue(row.actual_value)) {
    actualVal = parseFloat(String(row.actual_value));
  } else if (!isBlankValue(row.reading)) {
    actualVal = parseFloat(String(row.reading));
  } else if (!isBlankValue(row.actual)) {
    actualVal = parseFloat(String(row.actual));
  } else if (!isBlankValue(row.actual_dimension)) {
    actualVal = parseFloat(String(row.actual_dimension));
  } else if (!isBlankValue(row.ascending_reading)) {
    actualVal = parseFloat(String(row.ascending_reading));
  } else if (!isBlankValue(row.t1)) {
    actualVal = parseFloat(String(row.t1));
  }

  if (actualVal !== undefined && isNaN(actualVal)) actualVal = undefined;
  const hasReading = actualVal !== undefined;

  const valuesMap: Record<string, any> = {
    nominal: nom,
    nom: nom,
    std: nom,
    STD: nom,
    nominal_value: nom,
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
    upperLimit: upperLimit,
    upperlimit: upperLimit,
    upper_limit: upperLimit,
    tolerance: tolerance,
    tol: tolerance,
    actual: hasReading ? actualVal : '',
    Actual: hasReading ? actualVal : '',
    reading: hasReading ? actualVal : '',
    Reading: hasReading ? actualVal : '',
    avg: trialValues.length > 0 ? actualVal : (row.avg ?? ''),
    average: trialValues.length > 0 ? actualVal : (row.average ?? ''),
    error: hasReading ? actualVal! - nom : (row.error ?? ''),
    deviation: hasReading ? actualVal! - nom : (row.deviation ?? ''),
    MPE: tolerance,
    mpe: tolerance,
  };

  for (let i = 1; i <= 20; i++) {
    const val = row[`t${i}`] ?? row[String(i)] ?? row[`col_${i}`] ?? row[`trial_${i}`];
    if (!isBlankValue(val)) {
      const num = parseFloat(String(val));
      valuesMap[`t${i}`] = isNaN(num) ? val : num;
      valuesMap[`trial_${i}`] = isNaN(num) ? val : num;
    }
  }

  // Register column attributes
  columns.forEach((col) => {
    if (!col || !col.id) return;
    const rawVal = row[col.id];
    if (!isBlankValue(rawVal)) {
      const num = parseFloat(String(rawVal));
      valuesMap[col.id] = isNaN(num) ? rawVal : num;
      valuesMap[col.id.toLowerCase()] = isNaN(num) ? rawVal : num;
      if (col.label) {
        valuesMap[col.label.trim()] = isNaN(num) ? rawVal : num;
      }
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
    trialValues,
    isMaxLimit,
    isMinLimit,
  };
}

// ============================================================================
// 6. AUTHORITATIVE EVALUATOR FOR CERTIFICATE GENERATION & PREVIEW
// ============================================================================

/**
 * Authoritatively evaluates row formulas for PDF and certificate generation.
 * Replaces ad-hoc regex heuristics with robust AST parsing, asymmetric limit checking,
 * and strict blank propagation.
 */
export function evaluateRowMetrology(
  formula: string,
  row: any,
  tolerance: number = 0.02,
  dec: number = 3,
  columns: any[] = [],
  col?: any,
): string {
  if (!formula || typeof formula !== 'string' || !formula.trim()) return '-';

  try {
    let expr = formula.trim();
    if (expr.startsWith('=')) expr = expr.substring(1).trim();

    const ctx = buildRowEvaluationContext(row, columns, tolerance, dec);

    // 1. Direct AST evaluation
    const parseRes = parseFormulaAST(expr);
    if (parseRes.ast) {
      const rawRes = evaluateAST(parseRes.ast, ctx.valuesMap, { isBlankDetection: true });

      if (rawRes === null || rawRes === undefined || rawRes === '') {
        return '-';
      }

      if (typeof rawRes === 'boolean') {
        const wantsOk = /OK/i.test(expr);
        return wantsOk ? (rawRes ? 'OK' : 'NOT OK') : (rawRes ? 'PASS' : 'FAIL');
      }

      if (typeof rawRes === 'number') {
        if (isNaN(rawRes)) return '-';
        if (!isFinite(rawRes)) return 'Div/0';

        const isErrorCol =
          col?.id === 'error' ||
          col?.id === 'deviation' ||
          col?.label?.toLowerCase().includes('error') ||
          col?.label?.toLowerCase().includes('deviation') ||
          /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(expr);

        if (isErrorCol) {
          const rounded = parseFloat(rawRes.toFixed(dec));
          return (rounded >= 0 ? '+' : '') + rounded.toFixed(dec);
        }

        return dec === 0 ? String(Math.round(rawRes)) : rawRes.toFixed(dec);
      }

      return String(rawRes);
    }

    // 2. Fallback to legacy regex parser if formula syntax is non-standard
    return evaluateLegacyFormula(expr, row, ctx, tolerance, dec);
  } catch {
    return '-';
  }
}

/**
 * Legacy formula evaluator fallback for backwards compatibility with unusual legacy formats.
 */
function evaluateLegacyFormula(
  expr: string,
  row: any,
  ctx: RowEvaluationContext,
  tolerance: number,
  dec: number,
): string {
  const nominal = ctx.nom;
  const tol = ctx.tolerance || tolerance;

  // 1. AVERAGE
  const isSubtraction = expr.includes('-') || /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(expr);
  const avgMatch = !isSubtraction && expr.match(/^=?AVERAGE\(([^)]+)\)/i);
  if (avgMatch || (!isSubtraction && (expr.toLowerCase() === 'avg' || expr.toLowerCase() === 'average'))) {
    if (ctx.trialValues.length === 0) return '-';
    const avg = ctx.trialValues.reduce((a, b) => a + b, 0) / ctx.trialValues.length;
    return avg.toFixed(dec);
  }

  // 2. ERROR (measured - nominal)
  const isError =
    /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(expr) ||
    /(nominal|std)\s*-\s*(avg|average|reading|actual)/i.test(expr) ||
    (/error/i.test(expr) && !/PASS.*FAIL/i.test(expr));

  if (isError) {
    const isInverted = /(nominal|std)\s*-\s*(avg|average|reading|actual)/i.test(expr);
    if (!ctx.hasReading || ctx.actualVal === undefined) return '-';
    const err = isInverted ? nominal - ctx.actualVal : ctx.actualVal - nominal;
    return (err >= 0 ? '+' : '') + err.toFixed(dec);
  }

  // 3. STATUS / JUDGEMENT with asymmetric tolerance awareness
  if (/IF\(.*PASS.*FAIL.*\)/i.test(expr) || /PASS.*FAIL/i.test(expr) || /judg|verdict|status/i.test(expr)) {
    if (!ctx.hasReading || ctx.actualVal === undefined) return '-';

    // Check asymmetric bounds
    const isPass = ctx.actualVal >= ctx.lowerLimit - 1e-9 && ctx.actualVal <= ctx.upperLimit + 1e-9;
    const wantsOk = /OK/i.test(expr);
    return wantsOk ? (isPass ? 'OK' : 'NOT OK') : (isPass ? 'PASS' : 'FAIL');
  }

  return row[expr] ?? '-';
}

/**
 * Validates formula syntax using the authoritative AST parser.
 * Checks for syntax errors and disallowed tokens (eval, Function, etc.).
 */
export function validateFormulaSyntax(formulaStr: string): { valid: boolean; message?: string } {
  if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.trim()) {
    return { valid: true };
  }
  let clean = formulaStr.trim();
  if (clean.startsWith('=')) clean = clean.substring(1).trim();
  if (!clean) return { valid: true };

  const res = parseFormulaAST(clean);
  if (res.error) {
    return { valid: false, message: res.error };
  }
  return { valid: true };
}

/**
 * Validates all formula strings defined in template layout blocks.
 */
export function validateTemplateBlockFormulas(blocks: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(blocks) || blocks.length === 0) return { valid: true, errors };

  const checkFormula = (formula: string | undefined, locationDesc: string) => {
    if (!formula || typeof formula !== 'string' || !formula.trim()) return;
    const res = validateFormulaSyntax(formula);
    if (!res.valid) {
      errors.push(`${locationDesc}: ${res.message}`);
    }
  };

  const processTable = (table: any, tableName: string) => {
    if (!table || typeof table !== 'object') return;
    const columns = Array.isArray(table.columns) ? table.columns : [];
    columns.forEach((col: any) => {
      if (col && typeof col === 'object') {
        if (col.customFormula) {
          checkFormula(col.customFormula, `${tableName} Column "${col.label || col.id}" formula`);
        } else if (col.formula) {
          checkFormula(col.formula, `${tableName} Column "${col.label || col.id}" formula`);
        }
      }
    });

    const rows = Array.isArray(table.rows) ? table.rows : [];
    rows.forEach((row: any, rIdx: number) => {
      if (row && typeof row === 'object' && row._cellFormulas && typeof row._cellFormulas === 'object') {
        Object.entries(row._cellFormulas).forEach(([colId, formVal]) => {
          if (typeof formVal === 'string') {
            checkFormula(formVal, `${tableName} Row ${rIdx + 1} cell "${colId}" formula`);
          }
        });
      }
    });
  };

  blocks.forEach((block: any, bIdx: number) => {
    if (!block) return;
    if (block.type === 'table_grid') {
      processTable(block, block.title || `Table ${bIdx + 1}`);
    } else if (block.type === 'split_row' && Array.isArray(block.children)) {
      block.children.forEach((child: any, cIdx: number) => {
        if (child && child.type === 'table_grid') {
          processTable(child, child.title || `Split Table ${bIdx + 1}.${cIdx + 1}`);
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

export interface RecalculateBlocksResult {
  layoutBlocks: any[];
  overallVerdict: 'PASS' | 'FAIL' | 'CONDITIONAL';
  totalRowsEvaluated: number;
  passCount: number;
  failCount: number;
}

/**
 * Server-side authoritative recalculation gate.
 * Recalculates all derived formula cells and evaluates compliance judgements
 * across all canvas blocks using zero-eval AST metrology.
 */
export function recalculateCalibrationLayoutBlocks(layoutBlocks: any[]): RecalculateBlocksResult {
  if (!layoutBlocks || !Array.isArray(layoutBlocks)) {
    return {
      layoutBlocks: layoutBlocks || [],
      overallVerdict: 'PASS',
      totalRowsEvaluated: 0,
      passCount: 0,
      failCount: 0,
    };
  }

  let totalRows = 0;
  let passCount = 0;
  let failCount = 0;

  const processTable = (table: any) => {
    if (!table || typeof table !== 'object') return;
    const columns = Array.isArray(table.columns) ? table.columns : [];
    const rows = Array.isArray(table.rows) ? table.rows : [];
    if (columns.length === 0 || rows.length === 0) return;

    const tableTol = Number(table.tolerance) || 0.02;
    const tableDec = Number(table.decimal_places ?? table.decimalPlaces ?? 3);

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;

      // 1. Recalculate each column's value if it has a formula or is a calculated role
      for (const col of columns) {
        if (!col || typeof col !== 'object') continue;
        const colId = col.id;
        if (!colId) continue;

        const effectiveFormula =
          (row._cellFormulas && row._cellFormulas[colId]) ||
          (row.cellFormulas && row.cellFormulas[colId]) ||
          col.customFormula ||
          col.formula;

        const isCalculatedCol =
          effectiveFormula ||
          col.type === 'formula' ||
          col.role === 'CALCULATED' ||
          colId === 'average' ||
          colId === 'avg' ||
          colId === 'error' ||
          colId === 'deviation';

        if (isCalculatedCol) {
          let formulaToUse = effectiveFormula;
          if (!formulaToUse) {
            if (colId === 'average' || colId === 'avg') {
              formulaToUse = 'AVERAGE(t1,t2,t3,t4,t5)';
            } else if (colId === 'error' || colId === 'deviation') {
              formulaToUse = 'avg - nominal';
            }
          }

          if (formulaToUse) {
            const calculatedVal = evaluateRowMetrology(
              formulaToUse,
              row,
              tableTol,
              col.decimal_places ?? tableDec,
              columns,
              col,
            );
            if (calculatedVal !== '-') {
              row[colId] = calculatedVal;
              if (colId === 'error' || colId === 'deviation') {
                row.error = calculatedVal;
                row.deviation = calculatedVal;
              }
              if (colId === 'average' || colId === 'avg') {
                row.average = calculatedVal;
                row.avg = calculatedVal;
              }
            }
          }
        }
      }

      // 2. Evaluate row metrology verdict
      const statusCol = columns.find((c: any) =>
        c &&
        (c.type === 'status' ||
          c.role === 'JUDGEMENT' ||
          /judg|verdict|status|decision/i.test(c.id || '') ||
          /judg|verdict|status/i.test(c.label || ''))
      );

      let rowVerdict = '';
      if (statusCol) {
        const statusFormula =
          (row._cellFormulas && row._cellFormulas[statusCol.id]) ||
          (row.cellFormulas && row.cellFormulas[statusCol.id]) ||
          statusCol.customFormula ||
          statusCol.formula;

        if (statusFormula) {
          const res = evaluateRowMetrology(statusFormula, row, tableTol, 0, columns, statusCol);
          if (res !== '-') {
            rowVerdict = res;
            row[statusCol.id] = res;
          }
        } else {
          const ctx = buildRowEvaluationContext(row, columns, tableTol, tableDec);
          if (ctx.hasReading && ctx.actualVal !== undefined) {
            const isPass = ctx.actualVal >= (ctx.lowerLimit - 1e-9) && ctx.actualVal <= (ctx.upperLimit + 1e-9);
            rowVerdict = isPass ? 'PASS' : 'FAIL';
            row[statusCol.id] = rowVerdict;
          }
        }
      }

      if (!rowVerdict) {
        const ctx = buildRowEvaluationContext(row, columns, tableTol, tableDec);
        if (ctx.hasReading && ctx.actualVal !== undefined) {
          const isPass = ctx.actualVal >= (ctx.lowerLimit - 1e-9) && ctx.actualVal <= (ctx.upperLimit + 1e-9);
          rowVerdict = isPass ? 'PASS' : 'FAIL';
        }
      }

      if (rowVerdict) {
        row.judgement = rowVerdict;
        row.status = rowVerdict;
        row.verdict = rowVerdict;

        const vUpper = String(rowVerdict).toUpperCase();
        if (vUpper.includes('FAIL') || vUpper.includes('NOT OK') || vUpper.includes('REJECT') || vUpper === 'NG') {
          failCount++;
        } else if (vUpper.includes('PASS') || vUpper.includes('OK') || vUpper.includes('ACCEPT')) {
          passCount++;
        }
        totalRows++;
      }
    }
  };

  for (const block of layoutBlocks) {
    if (!block) continue;
    if (block.type === 'table_grid') {
      processTable(block);
    } else if (block.type === 'split_row' && Array.isArray(block.children)) {
      for (const child of block.children) {
        if (child && child.type === 'table_grid') {
          processTable(child);
        }
      }
    }
  }

  const overallVerdict: 'PASS' | 'FAIL' | 'CONDITIONAL' =
    failCount > 0 ? 'FAIL' : 'PASS';

  return {
    layoutBlocks,
    overallVerdict,
    totalRowsEvaluated: totalRows,
    passCount,
    failCount,
  };
}


