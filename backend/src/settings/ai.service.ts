import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import {
  SaveAiConfigDto,
  TestAiConnectionDto,
  CopilotPromptDto,
  GenerateTemplateDto,
} from './dto/ai-gateway.dto';

const DEFAULT_FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
];

const COPILOT_SYSTEM_PROMPT = `
You are the ISO/IEC 17025 Metrology Copilot for Gaugemaster.
Your role is to assist calibration engineers in designing, auditing, testing, and editing calibration templates.
Analyze the user request, the active template and table context, and any attached documents, certificates, drawings, or formulas.

CRITICAL INSTRUCTIONS:
1. Always reply in clean, structured JSON matching this exact schema:
{
  "reply": "Your clear, comprehensive, professional explanation. Use rich Markdown: headings (##), tables (| col |), bullet points, checklists (- [x] and - [ ]), callouts (> [!NOTE] or > [!WARNING]), and visual diagrams (\`\`\`mermaid) where helpful.",
  "action": "NONE",
  "actionPayload": {},
  "suggestions": [
    "Short actionable follow-up prompt 1 (e.g. Audit & Validate formulas and measurement uncertainties)",
    "Short actionable follow-up prompt 2 (e.g. Test Boundary Conditions against ISO/IEC 17025 standards)",
    "Short actionable follow-up prompt 3 (e.g. Add repeatability verification columns)"
  ]
}
Allowed action types when proposing actions: "NONE", "AUDIT_TABLE", "FIX_FORMULA", "ADD_COLUMN", "REMOVE_COLUMN", "CREATE_TABLE", "DELETE_TABLE", "APPLY_ATTACHMENT", "TEST_BOUNDARIES", "PARSE_SPECIFICATION".

2. PROACTIVE SUGGESTIONS (MANDATORY):
You MUST ALWAYS include 2 to 4 proactive, contextual, clickable follow-up suggestions in the "suggestions" array. These suggestions must be concise, relevant questions or actions the engineer can click to take the next step.

3. ATTACHED DOCUMENTS & QUESTIONS:
If the user attached an image, PDF certificate, drawing, or spreadsheet, examine it thoroughly. If the user asks a question about the attachment (e.g. "What is the tolerance?", "Can you audit these readings?", "What is the instrument serial number?"), provide a direct, precise, metrologically accurate answer in the "reply" field.

4. VISUAL PRESENTATION:
Use Markdown tables for comparison data, boundary checks, and error audits. Include status tags like PASS, FAIL, or WARNING in tables.
If illustrating measurement flows or decision trees, output a \`\`\`mermaid diagram block.
`;

const TEMPLATE_EXTRACTION_SYSTEM_PROMPT = `
You are an expert Metrology and Calibration Template Designer for ISO/IEC 17025 accredited laboratories.
Your task is to analyze the provided calibration document (PDF certificate, Word format, Excel sheet, or Image/Drawing) and generate a complete, high-precision, production-ready Visual Canvas Template JSON.

CRITICAL EXTRACTION RULES:
1. PURE JSON OUTPUT: Return ONLY valid, pure JSON without any comments, markdown fences, or extraneous text.
2. EXTRACT ALL ORIGINAL CALIBRATION DATA TABLES VERBATIM:
   - Identify every calibration data table, test section, or parameter list in the certificate.
   - For every table or test section, create a "table_grid" block in the "blocks" array.
3. COLUMN SEMANTIC ROLES & FORMULAS:
   - For every column, assign: "id" (snake_case), "label" (string), "role" (SPECIFICATION, NOMINAL, TOLERANCE, LOWER_LIMIT, UPPER_LIMIT, READING, CALCULATED, JUDGEMENT, METADATA), and "type" (nominal, reading, formula, status, tolerance, number, text).
   - For calculated columns like deviation/error, provide "formula": "actual_dimension - nominal".
4. STRICT ROW-TO-COLUMN BINDING: For every row, bind exact numeric/text values matching column IDs.

OUTPUT JSON SCHEMA:
{
  "name": "Instrument / Test Name (e.g. IN-HOUSE GAUGE CALIBRATION REPORT)",
  "description": "Concise description of calibration procedure and standard",
  "instrumentType": "Identified Instrument Type (e.g. LF Gauge / Setting Ring)",
  "defaultUnit": "mm",
  "defaultTolerance": 0.01,
  "decimalPlaces": 3,
  "blocks": [
    {
      "id": "table_1",
      "type": "table_grid",
      "title": "Calibration Results",
      "width": "100%",
      "unit": "mm",
      "tolerance": 0.01,
      "decimal_places": 3,
      "columns": [
        { "id": "sl_no", "label": "SL.NO.", "role": "METADATA", "type": "number", "width": "8%" },
        { "id": "required_dimension", "label": "REQUIRED DIMENSION", "role": "SPECIFICATION", "type": "text", "width": "30%" },
        { "id": "actual_dimension", "label": "ACTUAL DIMENSION", "role": "READING", "type": "reading", "width": "20%" },
        { "id": "deviation", "label": "DEVIATION", "role": "CALCULATED", "type": "formula", "formula": "actual_dimension - nominal", "width": "20%" },
        { "id": "judgement", "label": "JUDGEMENT", "role": "JUDGEMENT", "type": "status", "width": "22%" }
      ],
      "rows": [
        {
          "sl_no": "1",
          "required_dimension": "Shaft Ø35.035-0.02/-0.01",
          "actual_dimension": "",
          "deviation": "",
          "judgement": ""
        }
      ]
    }
  ]
}
`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Resolves the company's active Gemini API key from database or server environment.
   */
  async resolveCompanyKey(companyId: string): Promise<{ apiKey: string; defaultModel: string; enabled: boolean }> {
    const setting = await this.settingsService.findRawForAi(companyId);
    const aiConfig = setting?.aiConfig;

    const apiKey = aiConfig?.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
    let defaultModel = aiConfig?.defaultModel?.trim() || 'gemini-3.5-flash-lite';
    
    // Auto-upgrade deprecated or rate-limited models to high-speed GA model
    if (
      !defaultModel ||
      defaultModel.startsWith('gemini-1.') ||
      defaultModel.startsWith('gemini-2.') ||
      defaultModel.includes('preview')
    ) {
      defaultModel = 'gemini-3.5-flash-lite';
    }

    const enabled = aiConfig?.enabled !== false;

    return { apiKey, defaultModel, enabled };
  }

  /**
   * Returns safe AI status without exposing the raw secret key.
   */
  async getSafeAiStatus(companyId: string) {
    const { apiKey, defaultModel, enabled } = await this.resolveCompanyKey(companyId);
    const configured = Boolean(apiKey && apiKey.length > 5);

    let maskedKey = '';
    if (configured) {
      maskedKey = apiKey.length > 8
        ? `${apiKey.slice(0, 6)}•••••••••••••••${apiKey.slice(-4)}`
        : '••••••••••••••••';
    }

    return {
      configured,
      maskedKey,
      defaultModel,
      enabled,
    };
  }

  /**
   * Saves AI configuration for a company. Restricted to Admins with settings:edit.
   */
  async saveAiConfig(companyId: string, userId: string, dto: SaveAiConfigDto) {
    const current = await this.settingsService.findRawForAi(companyId);

    const updatePayload: any = {
      companyId,
      userId: userId || current?.userId,
      aiConfig: {
        ...(current?.aiConfig || {}),
        ...dto,
      },
    };

    return this.settingsService.create(updatePayload);
  }

  /**
   * Pings the Gemini API to verify the API key and check available models.
   */
  async testConnection(companyId: string, dto: TestAiConnectionDto) {
    let key = dto.apiKeyOverride?.trim();
    if (!key) {
      const resolved = await this.resolveCompanyKey(companyId);
      key = resolved.apiKey;
    }

    if (!key) {
      throw new BadRequestException('No Gemini API Key provided or configured for this company.');
    }

    let modelToTest = dto.model?.trim() || 'gemini-3.5-flash-lite';
    if (
      modelToTest.startsWith('gemini-1.') ||
      modelToTest.startsWith('gemini-2.') ||
      modelToTest.includes('preview')
    ) {
      modelToTest = 'gemini-3.5-flash-lite';
    }
    const startTime = Date.now();

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTest}?key=${key}`;
      const res = await fetch(url, { method: 'GET' });
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errorText = await res.text();
        let message = `Google Gemini returned status ${res.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) message = parsed.error.message;
        } catch {}

        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new UnauthorizedException(`Authentication failed: ${message}`);
        }
        throw new HttpException(`Gemini API Error: ${message}`, res.status);
      }

      const data = await res.json();
      return {
        success: true,
        model: modelToTest,
        displayName: data.displayName || modelToTest,
        latencyMs,
        message: 'Successfully connected to Google Gemini Cloud API.',
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `Failed to connect to Google Gemini API: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Executes a prompt with automatic model fallback cascading and error mapping.
   */
  private async executeGeminiGenerateContent(
    apiKey: string,
    preferredModel: string,
    requestBody: any,
  ): Promise<string> {
    const candidateModels = [
      preferredModel,
      ...DEFAULT_FALLBACK_MODELS.filter((m) => m !== preferredModel),
    ];

    let lastError = 'Failed to connect to Google Gemini API';

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            this.logger.log(`Gemini request succeeded using model: ${model}`);
            return text;
          }
          lastError = `Model ${model} returned an empty response.`;
        } else {
          const errText = await response.text();
          let errMessage = `Error ${response.status}: ${response.statusText}`;
          try {
            const errJson = JSON.parse(errText);
            if (errJson.error?.message) errMessage = errJson.error.message;
          } catch {}

          // If Authentication Failed (401 / 403)
          if (response.status === 401 || response.status === 403) {
            throw new UnauthorizedException(
              `Company Gemini API Key Authentication failed: ${errMessage}`,
            );
          }

          // If Rate Limited (429)
          if (response.status === 429) {
            this.logger.warn(`Model ${model} hit rate limit (429), trying next candidate model...`);
            lastError = `Rate limit reached on ${model}. ${errMessage}`;
            continue;
          }

          lastError = errMessage;
        }
      } catch (err: any) {
        if (err instanceof UnauthorizedException) throw err;
        lastError = err.message || 'Network error communicating with Gemini API';
      }
    }

    throw new HttpException(
      `Gemini Gateway Error: ${lastError}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Handles Copilot prompts on the backend gateway.
   */
  async executeCopilot(companyId: string, dto: CopilotPromptDto) {
    const { apiKey, defaultModel, enabled } = await this.resolveCompanyKey(companyId);

    if (!enabled) {
      throw new BadRequestException('AI Copilot features are currently disabled for your organization.');
    }

    if (!apiKey) {
      throw new BadRequestException(
        'Gemini API Key is not configured for your company. Please ask an administrator to configure it under Settings -> AI & Copilot Configuration.',
      );
    }

    const hasAttachments = Boolean(dto.attachments && dto.attachments.length > 0);
    const parts: any[] = [{ text: COPILOT_SYSTEM_PROMPT }];

    if (hasAttachments && dto.attachments) {
      parts.push({
        text: `CRITICAL INSTRUCTION: The engineer has attached ${dto.attachments.length} calibration file(s). You MUST examine and explain the attached document(s) in detail! Extract and explain its title, organization, gauge type, drawing axes, nominal specifications, tolerances, and calibration data tables.`,
      });

      for (const att of dto.attachments) {
        if (att.dataUrl && att.dataUrl.includes('base64')) {
          const [prefix, b64] = att.dataUrl.split(',');
          let mime = prefix.split(';')[0].replace('data:', '') || 'application/pdf';
          if (!mime || mime === 'data') {
            mime = att.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
          }
          parts.push({
            inline_data: { mime_type: mime, data: b64 },
          });
          parts.push({
            text: `Attached Document File: "${att.name}" (Format: ${mime}). Analyze this document thoroughly.`,
          });
        } else if (att.textSummary) {
          parts.push({
            text: `Attached Document (${att.name}):\n${att.textSummary}`,
          });
        }

        if (att.extractedFormulas && att.extractedFormulas.length > 0) {
          parts.push({
            text: `Extracted Formulas in ${att.name}:\n${att.extractedFormulas.join('\n')}`,
          });
        }
      }
    }

    // User prompt
    parts.push({
      text: hasAttachments
        ? `Engineer Prompt: "${dto.prompt}".\nNOTE: Since the engineer attached document(s), answer directly regarding the attached document(s)! Explain its contents, specifications, and structure, and explain how it maps or compares to the template.`
        : `Engineer Prompt: "${dto.prompt}"`,
    });

    if (dto.context) {
      parts.push({
        text: `Active Canvas Template (Current Workspace Context for reference):\n${JSON.stringify(dto.context, null, 2)}`,
      });
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.2,
      },
    };

    const textOutput = await this.executeGeminiGenerateContent(apiKey, defaultModel, requestBody);
    return {
      rawText: textOutput,
      modelUsed: defaultModel,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handles multi-format document template extraction on the backend gateway.
   */
  async generateTemplate(companyId: string, dto: GenerateTemplateDto) {
    const { apiKey, defaultModel, enabled } = await this.resolveCompanyKey(companyId);

    if (!enabled) {
      throw new BadRequestException('AI Template Generation is currently disabled for your organization.');
    }

    if (!apiKey) {
      throw new BadRequestException(
        'Gemini API Key is not configured for your company. Please ask an administrator to configure it under Settings -> AI & Copilot Configuration.',
      );
    }

    const parts: any[] = [{ text: TEMPLATE_EXTRACTION_SYSTEM_PROMPT }];

    if (dto.userInstructions) {
      parts.push({ text: `Additional Engineer Instructions: ${dto.userInstructions}` });
    }

    if (dto.documentType === 'image' || dto.documentType === 'pdf') {
      if (!dto.base64) {
        throw new BadRequestException(`Base64 data is required for ${dto.documentType} processing.`);
      }
      const mime = dto.mimeType || (dto.documentType === 'pdf' ? 'application/pdf' : 'image/jpeg');
      parts.push({
        inline_data: {
          mime_type: mime,
          data: dto.base64,
        },
      });
    } else if (dto.documentType === 'excel' || dto.documentType === 'word') {
      if (!dto.content) {
        throw new BadRequestException(`Extracted text/tabular content is required for ${dto.documentType} processing.`);
      }
      parts.push({
        text: `Extracted Document Data (${dto.fileName || 'Workbook'}):\n${dto.content}`,
      });
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
      },
    };

    const textOutput = await this.executeGeminiGenerateContent(apiKey, defaultModel, requestBody);
    return {
      rawJson: textOutput,
      modelUsed: defaultModel,
      timestamp: new Date().toISOString(),
    };
  }
}
