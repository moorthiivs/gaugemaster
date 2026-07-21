import { ValidationService } from './validation.service';
import { ValidationRule } from './validation-rule.entity';
export declare class ValidationController {
    private readonly validationService;
    constructor(validationService: ValidationService);
    getRules(companyId: string): Promise<ValidationRule[]>;
    updateRules(companyId: string, rules: Partial<ValidationRule>[]): Promise<ValidationRule[]>;
}
