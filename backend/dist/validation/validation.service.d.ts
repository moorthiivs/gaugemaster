import { Repository } from 'typeorm';
import { ValidationRule } from './validation-rule.entity';
export declare class ValidationService {
    private readonly ruleRepository;
    constructor(ruleRepository: Repository<ValidationRule>);
    getRules(companyId: string): Promise<ValidationRule[]>;
    updateRules(companyId: string, rules: Partial<ValidationRule>[]): Promise<ValidationRule[]>;
    validateData(companyId: string, data: any): Promise<void>;
}
