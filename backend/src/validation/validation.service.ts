import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidationRule } from './validation-rule.entity';

@Injectable()
export class ValidationService {
  constructor(
    @InjectRepository(ValidationRule)
    private readonly ruleRepository: Repository<ValidationRule>,
  ) {}

  async getRules(companyId: string): Promise<ValidationRule[]> {
    const existingRules = await this.ruleRepository.find({
      where: { companyId },
      order: { fieldName: 'ASC' },
    });

    const defaultFields = [
      { fieldName: "name", displayName: "Instrument Name", isRequired: true, isUnique: false, validationType: "text" },
      { fieldName: "id_code", displayName: "ID Code / IMTE", isRequired: true, isUnique: true, validationType: "text" },
      { fieldName: "location", displayName: "Location", isRequired: false, isUnique: false, validationType: "text" },
      { fieldName: "frequency", displayName: "Calibration Frequency", isRequired: false, isUnique: false, validationType: "text" },
      { fieldName: "last_calibration_date", displayName: "Last Calibration Date", isRequired: true, isUnique: false, validationType: "date" },
      { fieldName: "due_date", displayName: "Due Date", isRequired: true, isUnique: false, validationType: "date" },
      { fieldName: "agency", displayName: "Calibration Agency", isRequired: false, isUnique: false, validationType: "text" },
      { fieldName: "range", displayName: "Range", isRequired: false, isUnique: false, validationType: "text" },
      { fieldName: "serial_no", displayName: "Serial No", isRequired: false, isUnique: false, validationType: "text" },
      { fieldName: "least_count", displayName: "Least Count", isRequired: false, isUnique: false, validationType: "text" },
      { fieldName: "make", displayName: "Make", isRequired: false, isUnique: false, validationType: "text" },
      { fieldName: "remarks", displayName: "Remarks", isRequired: false, isUnique: false, validationType: "text" },
    ];

    if (existingRules.length === 0) {
      const savedRules: ValidationRule[] = [];
      for (const def of defaultFields) {
        const saved = await this.ruleRepository.save({ ...def, companyId });
        savedRules.push(saved);
      }
      return savedRules.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
    }

    let updated = false;
    for (const def of defaultFields) {
      if (!existingRules.some(r => r.fieldName === def.fieldName)) {
        const saved = await this.ruleRepository.save({ ...def, companyId });
        existingRules.push(saved);
        updated = true;
      }
    }

    if (updated) {
      return existingRules.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
    }

    return existingRules;
  }

  async updateRules(companyId: string, rules: Partial<ValidationRule>[]): Promise<ValidationRule[]> {
    for (const rule of rules) {
      if (rule.id) {
        await this.ruleRepository.update(rule.id, rule);
      } else {
        // Prevent duplicates by checking fieldName
        const existing = await this.ruleRepository.findOne({
          where: { companyId, fieldName: rule.fieldName }
        });
        
        if (existing) {
          await this.ruleRepository.update(existing.id, rule);
        } else {
          await this.ruleRepository.save({ ...rule, companyId });
        }
      }
    }
    return this.getRules(companyId);
  }

  async validateData(companyId: string, data: any): Promise<void> {
    const rules = await this.getRules(companyId);
    const errors: string[] = [];

    for (const rule of rules) {
      const value = data[rule.fieldName];
      if (rule.isRequired && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.displayName} is required`);
      }
      
      if (value) {
        if (rule.validationType === 'date') {
          const isInvalid = value instanceof Date ? isNaN(value.getTime()) : isNaN(Date.parse(value));
          if (isInvalid) {
            errors.push(`${rule.displayName} must be a valid date`);
          }
        }
        if (rule.validationType === 'number' && isNaN(Number(value))) {
          errors.push(`${rule.displayName} must be a valid number`);
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join(', '));
    }
  }
}
