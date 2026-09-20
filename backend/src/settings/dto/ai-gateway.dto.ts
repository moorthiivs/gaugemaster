import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsIn, IsArray } from 'class-validator';

export class SaveAiConfigDto {
  @ApiProperty({ description: 'Google Gemini API Key', required: false })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty({ description: 'Default model name', default: 'gemini-3.5-flash-lite', required: false })
  @IsOptional()
  @IsString()
  defaultModel?: string;

  @ApiProperty({ description: 'Whether AI features are enabled', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestAiConnectionDto {
  @ApiProperty({ description: 'Optional API Key to test prior to saving', required: false })
  @IsOptional()
  @IsString()
  apiKeyOverride?: string;

  @ApiProperty({ description: 'Model to ping', default: 'gemini-3.5-flash-lite', required: false })
  @IsOptional()
  @IsString()
  model?: string;
}

export class CopilotPromptDto {
  @ApiProperty({ description: 'The engineer prompt/command' })
  @IsString()
  prompt: string;

  @ApiProperty({ description: 'Context including active table, columns, template metadata', required: false })
  @IsOptional()
  context?: any;

  @ApiProperty({ description: 'Optional attachments (excel formulas, document summaries, images)', required: false })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @ApiProperty({ description: 'Recent conversation history', required: false })
  @IsOptional()
  @IsArray()
  history?: any[];
}

export class GenerateTemplateDto {
  @ApiProperty({ description: 'Document format: image, excel, pdf, word', enum: ['image', 'excel', 'pdf', 'word'] })
  @IsIn(['image', 'excel', 'pdf', 'word'])
  documentType: 'image' | 'excel' | 'pdf' | 'word';

  @ApiProperty({ description: 'Extracted text/tabular content for Excel/Word', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: 'Base64 data for PDF or Image', required: false })
  @IsOptional()
  @IsString()
  base64?: string;

  @ApiProperty({ description: 'MIME type of uploaded file', required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ description: 'File name', required: false })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({ description: 'Special user instructions for template generation', required: false })
  @IsOptional()
  @IsString()
  userInstructions?: string;
}
