import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
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

  @Post('custom-field')
  async addCustomField(
    @Query('companyId') companyId: string,
    @Body() body: {
      fieldName: string;
      displayName: string;
      validationType?: string;
      isRequired?: boolean;
      excelAliases?: string[];
    },
  ) {
    return await this.validationService.addCustomField(companyId, body);
  }

  @Delete('custom-field/:id')
  async deleteCustomField(@Param('id') id: string) {
    return await this.validationService.deleteCustomField(id);
  }
}

