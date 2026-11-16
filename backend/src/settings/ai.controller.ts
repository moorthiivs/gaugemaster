import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  Delete,
  Param,
  Query,
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

  /**
   * Helper to extract userId reliably from authenticated JWT user.
   */
  private extractUserId(req: any): string {
    return req.user?.userId || req.user?.id || req.user?.sub || '00000000-0000-0000-0000-000000000000';
  }

  @Get('status')
  @ApiOperation({ summary: 'Get safe AI configuration status (unprivileged)' })
  async getAiStatus(@Req() req: any) {
    const companyId = this.extractCompanyId(req);
    return this.aiService.getSafeAiStatus(companyId);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get current daily Copilot message and token quota for the user' })
  async getQuota(@Req() req: any) {
    const companyId = this.extractCompanyId(req);
    const userId = this.extractUserId(req);
    return this.aiService.getQuotaStatus(companyId, userId);
  }

  @Get('usage-report')
  @ApiOperation({ summary: 'Get comprehensive Gemini model usage and free tier availability report' })
  async getUsageReport(@Req() req: any) {
    const companyId = this.extractCompanyId(req);
    const userId = this.extractUserId(req);
    return this.aiService.getDetailedUsageReport(companyId, userId);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user Copilot conversations' })
  async getConversations(@Req() req: any, @Query('screenContext') screenContext?: string) {
    const companyId = this.extractCompanyId(req);
    const userId = this.extractUserId(req);
    return this.aiService.getUserConversations(companyId, userId, screenContext);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a Copilot conversation' })
  async getConversationMessages(@Req() req: any, @Param('id') conversationId: string) {
    const companyId = this.extractCompanyId(req);
    const userId = this.extractUserId(req);
    return this.aiService.getConversationMessages(companyId, userId, conversationId);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a Copilot conversation session' })
  async deleteConversation(@Req() req: any, @Param('id') conversationId: string) {
    const companyId = this.extractCompanyId(req);
    const userId = this.extractUserId(req);
    return this.aiService.deleteConversation(companyId, userId, conversationId);
  }

  @Post('config')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Save company AI configuration (Admin only)' })
  async saveAiConfig(@Req() req: any, @Body() dto: SaveAiConfigDto) {
    const companyId = this.extractCompanyId(req);
    const userId = this.extractUserId(req);
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
    const userId = this.extractUserId(req);
    return this.aiService.executeCopilot(companyId, userId, dto);
  }

  @Post('generate-template')
  @ApiOperation({ summary: 'Generate structured calibration template from uploaded document (Authenticated)' })
  async generateTemplate(@Req() req: any, @Body() dto: GenerateTemplateDto) {
    const companyId = this.extractCompanyId(req);
    return this.aiService.generateTemplate(companyId, dto);
  }
}
