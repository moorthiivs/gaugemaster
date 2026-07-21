import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { ValidationRule } from './validation-rule.entity';

@Controller('api/validation')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Get('rules')
  async getRules(@Query('companyId') companyId: string) {
    return await this.validationService.getRules(companyId);
  }

  @Post('rules')
  async updateRules(
    @Query('companyId') companyId: string,
    @Body() rules: Partial<ValidationRule>[],
  ) {
    return await this.validationService.updateRules(companyId, rules);
  }
}
