import {
  parseSpecification,
  tokenizeFormula,
  parseFormulaAST,
  evaluateAST,
  buildRowEvaluationContext,
  evaluateRowMetrology,
  isBlankValue,
  validateFormulaSyntax,
  validateTemplateBlockFormulas,
} from './formula-engine.util';

describe('Authoritative Metrology & Formula Engine (Backend)', () => {
  describe('Specification Parser', () => {
    it('should parse symmetric tolerance (13±0.01)', () => {
      const parsed = parseSpecification('Shaft Dist 13±0.01');
      expect(parsed.isValid).toBe(true);
      expect(parsed.nominal).toBe(13);
      expect(parsed.lowerTolerance).toBe(-0.01);
      expect(parsed.upperTolerance).toBe(0.01);
      expect(parsed.lowerLimit).toBe(12.99);
      expect(parsed.upperLimit).toBe(13.01);
    });

    it('should parse dual asymmetric tolerance (Ø35.035-0.02/-0.01)', () => {
      const parsed = parseSpecification('Shaft Ø35.035-0.02/-0.01');
      expect(parsed.isValid).toBe(true);
      expect(parsed.nominal).toBe(35.035);
      expect(parsed.lowerTolerance).toBe(-0.02);
      expect(parsed.upperTolerance).toBe(-0.01);
      expect(parsed.lowerLimit).toBe(35.015);
      expect(parsed.upperLimit).toBe(35.025);
    });

    it('should parse dual asymmetric tolerance with positive and negative limits (10+0.02/-0.01)', () => {
      const parsed = parseSpecification('10+0.02/-0.01');
      expect(parsed.isValid).toBe(true);
      expect(parsed.nominal).toBe(10);
      expect(parsed.lowerTolerance).toBe(-0.01);
      expect(parsed.upperTolerance).toBe(0.02);
      expect(parsed.lowerLimit).toBe(9.99);
      expect(parsed.upperLimit).toBe(10.02);
    });

    it('should parse single negative-only tolerance (50.0-0.005)', () => {
      const parsed = parseSpecification('50.0-0.005');
      expect(parsed.isValid).toBe(true);
      expect(parsed.nominal).toBe(50.0);
      expect(parsed.lowerTolerance).toBe(-0.005);
      expect(parsed.upperTolerance).toBe(0);
      expect(parsed.lowerLimit).toBe(49.995);
      expect(parsed.upperLimit).toBe(50.0);
    });

    it('should parse Max limit specification (0.003Max)', () => {
      const parsed = parseSpecification('Flatness 0.003Max');
      expect(parsed.isValid).toBe(true);
      expect(parsed.isMaxLimit).toBe(true);
      expect(parsed.lowerLimit).toBe(0);
      expect(parsed.upperLimit).toBe(0.003);
    });
  });

  describe('AST Tokenizer and Parser', () => {
    it('should tokenize arithmetic and functions correctly', () => {
      const { tokens, error } = tokenizeFormula('AVERAGE(t1, t2) - nominal');
      expect(error).toBeUndefined();
      expect(tokens.map((t) => t.type)).toEqual([
        'IDENTIFIER',
        'LPAREN',
        'IDENTIFIER',
        'COMMA',
        'IDENTIFIER',
        'RPAREN',
        'OPERATOR',
        'IDENTIFIER',
        'EOF',
      ]);
    });

    it('should reject dangerous code injection (eval, Function, process)', () => {
      const r1 = parseFormulaAST('eval("1+1")');
      expect(r1.ast).toBeNull();
      expect(r1.error).toContain('Security error');

      const r2 = parseFormulaAST('process.exit()');
      expect(r2.ast).toBeNull();
      expect(r2.error).toContain('Security error');
    });

    it('should parse nested expressions and IF statement', () => {
      const res = parseFormulaAST('IF(ABS(actual - nominal) <= tolerance, "PASS", "FAIL")');
      expect(res.ast).not.toBeNull();
      expect(res.ast?.type).toBe('FunctionCall');
      if (res.ast?.type === 'FunctionCall') {
        expect(res.ast.name).toBe('IF');
        expect(res.ast.args.length).toBe(3);
      }
    });
  });

  describe('AST Evaluator', () => {
    it('should evaluate arithmetic and mathematical functions', () => {
      const ast = parseFormulaAST('ROUND(SQRT(16) * 2.5 + ABS(-5), 2)').ast!;
      const result = evaluateAST(ast, {});
      expect(result).toBe(15);
    });

    it('should evaluate multi-argument statistical functions (AVERAGE, MIN, MAX, SUM)', () => {
      const ctx = { t1: 10.1, t2: 10.2, t3: 10.3 };
      const astAvg = parseFormulaAST('AVERAGE(t1, t2, t3)').ast!;
      expect(evaluateAST(astAvg, ctx)).toBeCloseTo(10.2, 5);

      const astSum = parseFormulaAST('SUM(t1, t2, t3)').ast!;
      expect(evaluateAST(astSum, ctx)).toBeCloseTo(30.6, 5);

      const astMin = parseFormulaAST('MIN(t1, t2, t3)').ast!;
      expect(evaluateAST(astMin, ctx)).toBe(10.1);

      const astMax = parseFormulaAST('MAX(t1, t2, t3)').ast!;
      expect(evaluateAST(astMax, ctx)).toBe(10.3);
    });

    it('should handle division by zero as Infinity without crashing', () => {
      const ast = parseFormulaAST('10 / 0').ast!;
      const result = evaluateAST(ast, {});
      expect(result).toBe(Infinity);
    });
  });

  describe('Strict Blank Handling & Propagation', () => {
    it('should correctly identify blanks vs numeric 0', () => {
      expect(isBlankValue(undefined)).toBe(true);
      expect(isBlankValue(null)).toBe(true);
      expect(isBlankValue('')).toBe(true);
      expect(isBlankValue('-')).toBe(true);
      expect(isBlankValue('   ')).toBe(true);

      expect(isBlankValue(0)).toBe(false);
      expect(isBlankValue('0')).toBe(false);
      expect(isBlankValue('0.000')).toBe(false);
    });

    it('should return "-" when reading is blank in evaluateRowMetrology', () => {
      const row = {
        point_number: 1,
        nominal: 25.0,
        tolerance: 0.02,
        reading: '', // Blank reading!
      };

      const resErr = evaluateRowMetrology('actual - nominal', row, 0.02, 3);
      expect(resErr).toBe('-');

      const resStatus = evaluateRowMetrology(
        'IF(ABS(actual - nominal) <= tolerance, "PASS", "FAIL")',
        row,
        0.02,
        3,
      );
      expect(resStatus).toBe('-');
    });

    it('should NOT treat numeric 0 as blank', () => {
      const row = {
        point_number: 1,
        nominal: 0.0,
        tolerance: 0.01,
        reading: 0.0,
      };

      const resErr = evaluateRowMetrology('actual - nominal', row, 0.01, 3);
      expect(resErr).toBe('+0.000');

      const resStatus = evaluateRowMetrology(
        'IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")',
        row,
        0.01,
        3,
      );
      expect(resStatus).toBe('PASS');
    });
  });

  describe('Asymmetric Tolerances in Metrology Evaluation', () => {
    it('should accurately judge asymmetric tolerance bounds (+0.02 / -0.01)', () => {
      const rowPass = {
        specificationText: 'Shaft 10.000+0.02/-0.01',
        reading: 10.015, // +0.015 is within [-0.01, +0.02]
      };
      const passResult = evaluateRowMetrology(
        'IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")',
        rowPass,
      );
      expect(passResult).toBe('PASS');

      const rowFailUpper = {
        specificationText: 'Shaft 10.000+0.02/-0.01',
        reading: 10.025, // +0.025 exceeds +0.02
      };
      const failUpperResult = evaluateRowMetrology(
        'IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")',
        rowFailUpper,
      );
      expect(failUpperResult).toBe('FAIL');

      const rowFailLower = {
        specificationText: 'Shaft 10.000+0.02/-0.01',
        reading: 9.985, // -0.015 is below -0.01
      };
      const failLowerResult = evaluateRowMetrology(
        'IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")',
        rowFailLower,
      );
      expect(failLowerResult).toBe('FAIL');
    });

    it('should correctly evaluate legacy regex formulas with asymmetric limits', () => {
      const row = {
        specificationText: 'Shaft 10.000+0.02/-0.01',
        reading: 10.018,
      };
      // Legacy formula format: "IF(error <= tolerance, PASS, FAIL)"
      const res = evaluateRowMetrology('IF(error <= tolerance, PASS, FAIL)', row);
      expect(res).toBe('PASS');
    });

    it('should respect explicit lower_limit and upper_limit defined on row', () => {
      const rowInSpec = {
        lower_limit: 35.015,
        upper_limit: 35.025,
        actual_dimension: 35.020,
      };
      const passResult = evaluateRowMetrology(
        'IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")',
        rowInSpec,
      );
      expect(passResult).toBe('PASS');

      const rowOutOfSpec = {
        lower_limit: 35.015,
        upper_limit: 35.025,
        actual_dimension: 35.028,
      };
      const failResult = evaluateRowMetrology(
        'IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")',
        rowOutOfSpec,
      );
      expect(failResult).toBe('FAIL');
    });

    it('should correctly evaluate Max Limit specifications (e.g. 0.003Max)', () => {
      const rowPass = {
        specificationText: '0.003Max',
        reading: 0.0025,
      };
      expect(evaluateRowMetrology('IF(actual <= upper_limit, "PASS", "FAIL")', rowPass)).toBe('PASS');

      const rowFail = {
        specificationText: '0.003Max',
        reading: 0.0035,
      };
      expect(evaluateRowMetrology('IF(actual <= upper_limit, "PASS", "FAIL")', rowFail)).toBe('FAIL');
    });

    it('should correctly evaluate range specifications (e.g. 12.000 - 12.018)', () => {
      const rowPass = {
        specificationText: '12.000 - 12.018',
        reading: 12.010,
      };
      expect(evaluateRowMetrology('IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")', rowPass)).toBe('PASS');

      const rowFail = {
        specificationText: '12.000 - 12.018',
        reading: 12.022,
      };
      expect(evaluateRowMetrology('IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")', rowFail)).toBe('FAIL');
    });
  });

  describe('Multi-trial Averaging and Error Calculation', () => {
    it('should calculate AVERAGE across trials and format deviation with sign', () => {
      const row = {
        nominal: 20.0,
        t1: 20.002,
        t2: 20.004,
        t3: 20.006,
      };

      const avgRes = evaluateRowMetrology('AVERAGE(t1, t2, t3)', row, 0.02, 3);
      expect(avgRes).toBe('20.004');

      const errRes = evaluateRowMetrology('actual - nominal', row, 0.02, 3);
      expect(errRes).toBe('+0.004');
    });
  });

  describe('Template & Formula Validation Gate', () => {
    it('should validate valid formulas successfully', () => {
      expect(validateFormulaSyntax('reading - nominal').valid).toBe(true);
      expect(validateFormulaSyntax('=AVERAGE(t1, t2, t3)').valid).toBe(true);
      expect(validateFormulaSyntax('IF(actual >= lower_limit && actual <= upper_limit, "PASS", "FAIL")').valid).toBe(true);
    });

    it('should reject formulas with syntax errors or dangerous injections', () => {
      expect(validateFormulaSyntax('reading +').valid).toBe(false);
      expect(validateFormulaSyntax('eval("1+1")').valid).toBe(false);
      expect(validateFormulaSyntax('process.exit(1)').valid).toBe(false);
      expect(validateFormulaSyntax('Function("return 1")()').valid).toBe(false);
    });

    it('should validate template blocks and identify broken formulas', () => {
      const validBlocks = [
        {
          type: 'table_grid',
          title: 'Dimensions',
          columns: [
            { id: 'nominal', label: 'Nominal' },
            { id: 'reading', label: 'Reading' },
            { id: 'error', label: 'Error', formula: 'reading - nominal' },
          ],
          rows: [{ nominal: 10, reading: 10.002 }],
        },
      ];
      expect(validateTemplateBlockFormulas(validBlocks).valid).toBe(true);

      const invalidBlocks = [
        {
          type: 'table_grid',
          title: 'Dimensions',
          columns: [
            { id: 'error', label: 'Error', formula: 'reading + * 5' },
          ],
        },
      ];
      const check = validateTemplateBlockFormulas(invalidBlocks);
      expect(check.valid).toBe(false);
      expect(check.errors.length).toBeGreaterThan(0);
      expect(check.errors[0]).toContain('Dimensions Column "Error" formula');
    });
  });
});

