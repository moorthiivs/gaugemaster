import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AiService } from './ai.service';
import {
  SaveAiConfigDto,
  TestAiConnectionDto,
  CopilotPromptDto,
  GenerateTemplateDto,
} from './dto/ai-gateway.dto';

@ApiTags('api/ai')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Helper to extract companyId reliably from authenticated JWT user.
   */
  private extractCompanyId(req: any): string {
    const user = req.user;
    const companyId = user?.companyId;
    if (!companyId) {
      throw new BadRequestException('User is not associated with an active company organization.');
    }
    return companyId;
  }

  @Get('status')
  @ApiOperation({ summary: 'Get safe AI configuration status (unprivileged)' })
  async getAiStatus(@Req() req: any) {
    const companyId = this.extractCompanyId(req);
    return this.aiService.getSafeAiStatus(companyId);
  }

  @Post('config')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Save company AI configuration (Admin only)' })
  async saveAiConfig(@Req() req: any, @Body() dto: SaveAiConfigDto) {
    const companyId = this.extractCompanyId(req);
    const userId = req.user?.userId || req.user?.sub;
    return this.aiService.saveAiConfig(companyId, userId, dto);
  }

  @Post('test-connection')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Test connection to Google Gemini API (Admin only)' })
  async testConnection(@Req() req: any, @Body() dto: TestAiConnectionDto) {
    const companyId = this.extractCompanyId(req);
    return this.aiService.testConnection(companyId, dto);
  }

  @Post('copilot')
  @ApiOperation({ summary: 'Send a prompt to the ISO 17025 Metrology Copilot (Authenticated)' })
  async copilotPrompt(@Req() req: any, @Body() dto: CopilotPromptDto) {
    const companyId = this.extractCompanyId(req);
    return this.aiService.executeCopilot(companyId, dto);
  }

  @Post('generate-template')
  @ApiOperation({ summary: 'Generate structured calibration template from uploaded document (Authenticated)' })
  async generateTemplate(@Req() req: any, @Body() dto: GenerateTemplateDto) {
    const companyId = this.extractCompanyId(req);
    return this.aiService.generateTemplate(companyId, dto);
  }
}
