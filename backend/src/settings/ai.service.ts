import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from './settings.service';
import {
  SaveAiConfigDto,
  TestAiConnectionDto,
  CopilotPromptDto,
  GenerateTemplateDto,
} from './dto/ai-gateway.dto';
import { CopilotConversation } from './entities/copilot-conversation.entity';
import { CopilotMessage } from './entities/copilot-message.entity';
import { CopilotDailyQuota } from './entities/copilot-daily-quota.entity';

const DEFAULT_FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

const COPILOT_SYSTEM_PROMPT = `
You are the ISO/IEC 17025 Metrology Copilot for Gaugemaster.
Your role is to assist calibration engineers in designing, auditing, testing, and editing calibration templates.
Analyze the user request, the active template and table context, and any attached documents, certificates, drawings, or formulas.

CRITICAL INSTRUCTIONS & SCHEMA:
1. Always reply in clean, structured JSON matching this exact schema:
{
  "reply": "Your clear, concise, professional response. Match the length and detail strictly to the user's intent.",
  "action": "NONE",
  "actionPayload": {},
  "suggestions": [
    "Short actionable follow-up prompt 1",
    "Short actionable follow-up prompt 2",
    "Short actionable follow-up prompt 3"
  ]
}
IMPORTANT: Output PURE JSON ONLY. Do NOT prepend any conversational text before the JSON (such as "Here is the JSON requested:", "Certainly!", etc.). Do NOT wrap the JSON in markdown backticks. Start your response immediately with '{' and end with '}'.
Allowed action types when proposing actions: "NONE", "AUDIT_TABLE", "FIX_FORMULA", "ADD_COLUMN", "REMOVE_COLUMN", "CREATE_TABLE", "DELETE_TABLE", "APPLY_ATTACHMENT", "TEST_BOUNDARIES", "PARSE_SPECIFICATION".

2. STRICT TOKEN CONSERVATION & CONVERSATIONAL BREVITY (MANDATORY):
- GREETINGS & CASUAL INTROS: If the user sends a greeting (e.g. "hi", "hello", "hey", "good morning"), says thanks, or asks who you are:
  * Reply in 1 or 2 SHORT sentences (MAXIMUM 30 WORDS).
  * Example: "Hello! I am your ISO/IEC 17025 Metrology Copilot. How can I assist you with your calibration templates, measurement tables, or formula audits today?"
  * NEVER generate capability tables, markdown tables, callout blocks, or mermaid diagrams for greetings or pleasantries! Keep it light, fast, and token-efficient.
- MERMAID DIAGRAMS (\`\`\`mermaid): STRICTLY FORBIDDEN unless the user explicitly asks for a flowchart, workflow diagram, or visual process tree (e.g. "draw a flowchart", "visualize process"). NEVER generate diagrams unsolicited.
- MARKDOWN TABLES: Use tables ONLY when comparing measurement data, boundary checks, or audit results. Do NOT use tables for general chat, introductions, or capability summaries.
- CONCISE DIRECT ANSWERS: When answering technical questions, be precise, direct, and avoid unnecessary filler or boilerplate intros.

3. PROACTIVE SUGGESTIONS (MANDATORY):
Always include 2 to 4 proactive, contextual, clickable follow-up suggestions in the "suggestions" array (under 8 words each). For greetings, provide 3 quick-start suggestions like:
- "Audit current template & formulas"
- "Add ISO 17025 uncertainty budget"
- "Test measurement boundary conditions"

4. ATTACHED DOCUMENTS & QUESTIONS:
If the user attached an image, PDF certificate, drawing, or spreadsheet, examine it thoroughly. If the user asks a question about the attachment (e.g. "What is the tolerance?", "Can you audit these readings?", "What is the instrument serial number?"), provide a direct, precise, metrologically accurate answer in the "reply" field.

5. GAUGE RECEIPT CONDITION POLICY (STRICT - MUST FOLLOW):
If the user asks (explicitly, accidentally, or casually) to add, generate, create, or include a "Gauge Receipt Condition", "Receipt Condition", "Visual Inspection", "Condition on Receipt", or "Dent & Damage" table or column:
- STRICTLY DO NOT generate any table, column, or measurement block (set "action": "NONE", "actionPayload": {}).
- In your "reply", explain politely and clearly:
  "Gauge Receipt Condition (such as visual inspection, dent & damage, and cleanliness checks) is already available by default in Gaugemaster as a standard pre-calibration inspection workflow and certificate header field. It does not belong in calibration measurement grids."
- Suggest valid calibration actions in "suggestions", such as:
  ["Configure measurement parameters", "Audit calculation formulas", "Verify nominal tolerances"]

6. TRACEABILITY OF MASTERS & STANDARD EQUIPMENTS POLICY (STRICT - MUST FOLLOW):
If the user asks (explicitly, accidentally, or casually) to add, generate, create, or include a "Traceability of Masters", "Master Equipment", "Standard Equipment used for calibration", "Reference Standards", or "Equipment Used" table, block, or column:
- STRICTLY DO NOT generate any table, column, or measurement block (set "action": "NONE", "actionPayload": {}).
- In your "reply", explain politely and clearly:
  "Traceability of Masters (Standard Equipments used for calibration, including Master Instrument Name, Make, Serial/ID No., Certificate No., Validity Date, and Calibration Agency) is already available by default in Gaugemaster as a standard calibration workflow step (Step 2: Reference Standard) and standard certificate header section. It does not belong in calibration measurement grids."
- Suggest valid calibration actions in "suggestions", such as:
  ["Configure measurement parameters", "Audit calculation formulas", "Verify nominal tolerances"]
`;


const TEMPLATE_EXTRACTION_SYSTEM_PROMPT = `
You are an expert Metrology and Calibration Template Designer for ISO/IEC 17025 accredited laboratories.
Your task is to analyze the provided calibration document (PDF certificate, Word format, Excel sheet, or Image/Drawing) and generate a complete, high-precision, production-ready Visual Canvas Template JSON.

CRITICAL EXTRACTION RULES:
1. PURE JSON OUTPUT: Return ONLY valid, pure JSON without any comments, markdown fences, or extraneous text.
2. EXTRACT ALL ORIGINAL CALIBRATION DATA TABLES VERBATIM:
   - Identify every calibration data table, test section, or parameter list in the certificate.
   - For every genuine measurement table or test section, create a "table_grid" block in the "blocks" array.
3. MANDATORY EXCLUSION RULE - GAUGE RECEIPT CONDITION & VISUAL DAMAGE CHECKS:
   - STRICTLY DO NOT extract, generate, or create tables, blocks, rows, or callout notes for "GAUGE RECEIPT CONDITION", "Receipt Condition", "Visual Condition", "Condition on Receipt", or visual dent/damage checks (e.g. "NO DENT & DAMAGE", "Free from dents and damages").
   - In Gaugemaster, Receipt Condition is managed through a standard built-in pre-calibration inspection workflow and certificate header field, NOT as a measurement canvas grid.
   - Even if user custom instructions explicitly ask for "Receipt Condition" or visual inspection tables, SKIP it and only extract actual calibration measurement points (nominals, tolerances, readings, limits, deviations, judgements).
4. MANDATORY EXCLUSION RULE - TRACEABILITY OF MASTERS / STANDARD EQUIPMENTS USED:
   - STRICTLY DO NOT extract, generate, or create tables, blocks, rows, or notes for "TRACEABILITY OF MASTER USED", "Master Equipments", "Standard Equipments Used for Calibration", "Reference Standards Used", or master calibration validity.
   - In Gaugemaster, Master Equipment Traceability is automatically managed through Step 2: Reference Standard and rendered in the official certificate header, NOT as a canvas template grid.
   - Even if user custom instructions or uploaded documents explicitly contain master traceability tables, SKIP them and extract ONLY the actual unit-under-calibration measurement parameters.
5. COLUMN SEMANTIC ROLES & FORMULAS:
   - For every column, assign: "id" (snake_case), "label" (string), "role" (SPECIFICATION, NOMINAL, TOLERANCE, LOWER_LIMIT, UPPER_LIMIT, READING, CALCULATED, JUDGEMENT, METADATA), and "type" (nominal, reading, formula, status, tolerance, number, text).
   - For calculated columns like deviation/error, provide "formula": "actual_dimension - nominal".
6. STRICT ROW-TO-COLUMN BINDING: For every row, bind exact numeric/text values matching column IDs.

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

  constructor(
    private readonly settingsService: SettingsService,
    @InjectRepository(CopilotConversation)
    private readonly conversationRepo: Repository<CopilotConversation>,
    @InjectRepository(CopilotMessage)
    private readonly messageRepo: Repository<CopilotMessage>,
    @InjectRepository(CopilotDailyQuota)
    private readonly quotaRepo: Repository<CopilotDailyQuota>,
  ) {}

  /**
   * Resolves the company's active Gemini API key from database or server environment.
   */
  async resolveCompanyKey(companyId: string): Promise<{ apiKey: string; defaultModel: string; enabled: boolean; floatingBotEnabled: boolean }> {
    const setting = await this.settingsService.findRawForAi(companyId);
    const aiConfig = setting?.aiConfig;

    const apiKey = aiConfig?.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
    let defaultModel = aiConfig?.defaultModel?.trim() || 'gemini-3-flash-preview';
    
    // Auto-upgrade legacy deprecated models (gemini-1.x, gemini-2.x) to current Gemini 3.x
    if (
      !defaultModel ||
      defaultModel.startsWith('gemini-1.') ||
      defaultModel.startsWith('gemini-2.')
    ) {
      defaultModel = 'gemini-3-flash-preview';
    }

    const enabled = aiConfig?.enabled !== false;
    const floatingBotEnabled = aiConfig?.floatingBotEnabled !== false;

    return { apiKey, defaultModel, enabled, floatingBotEnabled };
  }

  /**
   * Returns safe AI status without exposing the raw secret key.
   */
  async getSafeAiStatus(companyId: string) {
    const { apiKey, defaultModel, enabled, floatingBotEnabled } = await this.resolveCompanyKey(companyId);
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
      floatingBotEnabled,
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

    let modelToTest = dto.model?.trim() || 'gemini-3-flash-preview';
    if (
      modelToTest.startsWith('gemini-1.') ||
      modelToTest.startsWith('gemini-2.')
    ) {
      modelToTest = 'gemini-3-flash-preview';
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
          throw new BadRequestException(`Gemini API Authentication failed: ${message}`);
        }
        throw new HttpException(`Gemini API Error: ${message}`, HttpStatus.BAD_GATEWAY);
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
   * Returns current daily free quota status for the user and company.
   * Default limit: 50 messages/day.
   */
  async getQuotaStatus(companyId: string, userId: string) {
    const safeUserId = userId || '00000000-0000-0000-0000-000000000000';
    const today = new Date().toISOString().slice(0, 10);
    
    const resetAt = new Date();
    resetAt.setUTCHours(23, 59, 59, 999);

    let quota = await this.quotaRepo.findOne({
      where: { companyId, userId: safeUserId, quotaDate: today },
    });

    if (!quota) {
      quota = this.quotaRepo.create({
        companyId,
        userId: safeUserId,
        quotaDate: today,
        messageCount: 0,
        tokensUsed: 0,
        dailyMessageLimit: 50,
        dailyTokenLimit: 200000,
        resetAt,
      });
      quota = await this.quotaRepo.save(quota);
    }

    // Ground truth sync: Count actual messages and tokens from copilot_messages for today
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const realUserStats = await this.messageRepo
      .createQueryBuilder('m')
      .select('COUNT(m.id)', 'count')
      .addSelect('SUM(m.totalTokens)', 'tokens')
      .where('m.companyId = :companyId AND m.userId = :userId AND m.role = :role AND m.createdAt >= :todayStart', {
        companyId,
        userId: safeUserId,
        role: 'user',
        todayStart,
      })
      .getRawOne();

    const actualCount = parseInt(realUserStats?.count || '0', 10);
    const actualTokens = parseInt(realUserStats?.tokens || '0', 10);

    if (quota.messageCount !== actualCount || quota.tokensUsed !== actualTokens) {
      quota.messageCount = actualCount;
      quota.tokensUsed = actualTokens;
      await this.quotaRepo.save(quota);
    }

    const remaining = Math.max(0, quota.dailyMessageLimit - quota.messageCount);
    const isLimitReached = quota.messageCount >= quota.dailyMessageLimit;

    return {
      quotaDate: quota.quotaDate,
      messageCount: quota.messageCount,
      dailyMessageLimit: quota.dailyMessageLimit,
      remaining,
      tokensUsed: quota.tokensUsed,
      dailyTokenLimit: quota.dailyTokenLimit,
      resetAt: quota.resetAt,
      isLimitReached,
    };
  }

  /**
   * Returns comprehensive model specifications, today's consumed free quota,
   * remaining availability, and Google Gemini free tier capacity report.
   */
  async getDetailedUsageReport(companyId: string, userId: string) {
    const safeUserId = userId || '00000000-0000-0000-0000-000000000000';
    const today = new Date().toISOString().slice(0, 10);
    
    const resetAt = new Date();
    resetAt.setUTCHours(23, 59, 59, 999);

    let quota = await this.quotaRepo.findOne({
      where: { companyId, userId: safeUserId, quotaDate: today },
    });

    if (!quota) {
      quota = this.quotaRepo.create({
        companyId,
        userId: safeUserId,
        quotaDate: today,
        messageCount: 0,
        tokensUsed: 0,
        dailyMessageLimit: 50,
        dailyTokenLimit: 200000,
        resetAt,
      });
      quota = await this.quotaRepo.save(quota);
    }

    // Ground truth: Sync actual user queries from copilot_messages
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const realUserStats = await this.messageRepo
      .createQueryBuilder('m')
      .select('COUNT(m.id)', 'count')
      .addSelect('SUM(m.totalTokens)', 'tokens')
      .where('m.companyId = :companyId AND m.userId = :userId AND m.role = :role AND m.createdAt >= :todayStart', {
        companyId,
        userId: safeUserId,
        role: 'user',
        todayStart,
      })
      .getRawOne();

    const actualUserCount = parseInt(realUserStats?.count || '0', 10);
    const actualUserTokens = parseInt(realUserStats?.tokens || '0', 10);

    if (quota.messageCount !== actualUserCount || quota.tokensUsed !== actualUserTokens) {
      quota.messageCount = actualUserCount;
      quota.tokensUsed = actualUserTokens;
      await this.quotaRepo.save(quota);
    }

    // Company-wide total for today from copilot_messages
    const companyMsgStats = await this.messageRepo
      .createQueryBuilder('m')
      .select('COUNT(m.id)', 'count')
      .addSelect('SUM(m.totalTokens)', 'tokens')
      .where('m.companyId = :companyId AND m.role = :role AND m.createdAt >= :todayStart', {
        companyId,
        role: 'user',
        todayStart,
      })
      .getRawOne();

    const companyTotalMessages = parseInt(companyMsgStats?.count || '0', 10);
    const companyTotalTokens = parseInt(companyMsgStats?.tokens || '0', 10);

    // Retrieve active AI configuration
    const setting = await this.settingsService.findRawForAi(companyId);
    const aiConfig = setting?.aiConfig || {};
    const modelId = aiConfig.defaultModel || 'gemini-3-flash-preview';
    const hasApiKey = Boolean(aiConfig.apiKey && aiConfig.apiKey.trim().length > 0);
    const rawKey = aiConfig.apiKey?.trim() || '';
    const maskedKey = hasApiKey
      ? (rawKey.length > 10 ? `${rawKey.slice(0, 6)}•••••••••••••${rawKey.slice(-4)}` : '••••••••••••••••')
      : 'No API Key Configured';

    // Model specific rate limits & specifications (Google Gemini Official Specs)
    const isPro = modelId.includes('pro');
    const isLite = modelId.includes('lite');
    
    const googleFreeDailyLimit = isPro ? 50 : 1500; // 1,500 RPD for Flash/Flash Lite, 50 for Pro
    const googleRpm = isLite ? 30 : isPro ? 2 : 15;
    const googleTpm = isPro ? 32000 : 1000000;
    const contextWindow = 1048576;
    const maxOutputTokens = 8192;

    const remainingUserMessages = Math.max(0, quota.dailyMessageLimit - quota.messageCount);
    const remainingUserTokens = Math.max(0, quota.dailyTokenLimit - quota.tokensUsed);
    const remainingGoogleDaily = Math.max(0, googleFreeDailyLimit - companyTotalMessages);

    const now = Date.now();
    const resetTime = new Date(quota.resetAt).getTime();
    const secondsUntilReset = Math.max(0, Math.floor((resetTime - now) / 1000));

    // Screen context breakdown for today
    let contextBreakdown: { category: string; count: number; label: string }[] = [];
    try {
      const breakdownRaw = await this.conversationRepo
        .createQueryBuilder('c')
        .innerJoin('copilot_messages', 'm', 'm.conversationId = c.id')
        .select('c.screenContext', 'screenContext')
        .addSelect('COUNT(m.id)', 'count')
        .where('c.companyId = :companyId AND m.createdAt >= :todayStart AND m.role = :role', {
          companyId,
          todayStart,
          role: 'user',
        })
        .groupBy('c.screenContext')
        .getRawMany();

      const labelMap: Record<string, { category: string; label: string }> = {
        template_builder: { category: 'Calibration Templates', label: 'Template Builder & Schema Synthesis' },
        calibration_wizard: { category: 'Calibration Execution', label: 'Execution & Calibration Sheets' },
        instruments: { category: 'Instrument Master', label: 'Equipment & Metrology Lookups' },
        dashboard: { category: 'Quality Dashboard', label: 'KPIs & Quality Metrics' },
        general: { category: 'General Metrology', label: 'ISO 17025 Standards & General Assistance' },
      };

      if (breakdownRaw && breakdownRaw.length > 0) {
        contextBreakdown = breakdownRaw.map((item) => {
          const mapped = labelMap[item.screenContext] || {
            category: item.screenContext || 'General Operations',
            label: 'Metrology Operations',
          };
          return {
            category: mapped.category,
            count: parseInt(item.count || '0', 10),
            label: mapped.label,
          };
        });
      }
    } catch (e: any) {
      contextBreakdown = [];
    }

    if (contextBreakdown.length === 0) {
      contextBreakdown = [
        { category: 'Calibration Templates', count: quota.messageCount, label: 'Template Builder & Metrology Chat' },
      ];
    }

    // Health status evaluation
    let healthStatus: 'optimal' | 'moderate' | 'near_limit' | 'depleted' = 'optimal';
    const userPercent = (quota.messageCount / quota.dailyMessageLimit) * 100;
    if (userPercent >= 100) healthStatus = 'depleted';
    else if (userPercent >= 80) healthStatus = 'near_limit';
    else if (userPercent >= 50) healthStatus = 'moderate';

    return {
      quotaDate: quota.quotaDate,
      resetAt: quota.resetAt,
      secondsUntilReset,
      hasApiKey,
      maskedKey,
      model: {
        id: modelId,
        name: this.getFriendlyModelName(modelId),
        tier: 'Google Gemini AI Free Plan (Zero Cost Tier)',
        rateLimits: {
          rpm: googleRpm,
          tpm: googleTpm,
          rpd: googleFreeDailyLimit,
          contextWindow,
          maxOutputTokens,
        },
      },
      userUsage: {
        messagesUsedToday: quota.messageCount,
        dailyMessageLimit: quota.dailyMessageLimit,
        messagesRemaining: remainingUserMessages,
        percentConsumed: Math.min(100, Math.round((quota.messageCount / quota.dailyMessageLimit) * 100)),
        tokensUsedToday: quota.tokensUsed,
        dailyTokenLimit: quota.dailyTokenLimit,
        tokensRemaining: remainingUserTokens,
        tokenPercentConsumed: Math.min(100, Math.round((quota.tokensUsed / quota.dailyTokenLimit) * 100)),
        isLimitReached: quota.messageCount >= quota.dailyMessageLimit,
      },
      googleFreeAvailability: {
        googleDailyLimit: googleFreeDailyLimit,
        totalCompanyUsedToday: companyTotalMessages,
        googleRemainingToday: remainingGoogleDaily,
        googlePercentConsumed: Number(((companyTotalMessages / googleFreeDailyLimit) * 100).toFixed(2)),
        googleRpmLimit: googleRpm,
        googleTpmLimit: googleTpm,
        totalTokensConsumedToday: companyTotalTokens,
      },
      contextBreakdown,
      healthStatus,
    };
  }

  private getFriendlyModelName(modelId: string): string {
    const map: Record<string, string> = {
      'gemini-3-flash-preview': 'Gemini 3 Flash (Recommended — Ultra-Fast & High Free Quota)',
      'gemini-3.6-flash': 'Gemini 3.6 Flash (Google Recommended Production Model)',
      'gemini-3.5-flash': 'Gemini 3.5 Flash (Balanced Multimodal Reasoning)',
      'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite (Lightweight High-Throughput)',
      'gemini-3.1-pro-preview': 'Gemini 3.1 Pro (Low-Level Cost-Efficient)',
      'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite (High-Speed Lightweight)',
      'gemini-3.8-flash': 'Gemini 3.8 Flash (Deep Multimodal Reasoning)',
      'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite (Legacy)',
      'gemini-2.5-flash': 'Gemini 2.5 Flash (Legacy)',
    };
    return map[modelId] || modelId;
  }

  /**
   * Pre-flight validation of daily quota. Throws HTTP 429 if daily limit is reached.
   */
  async validateQuotaAvailable(companyId: string, userId: string): Promise<CopilotDailyQuota> {
    const safeUserId = userId || '00000000-0000-0000-0000-000000000000';
    const today = new Date().toISOString().slice(0, 10);
    const resetAt = new Date();
    resetAt.setUTCHours(23, 59, 59, 999);

    let quota = await this.quotaRepo.findOne({
      where: { companyId, userId: safeUserId, quotaDate: today },
    });

    if (!quota) {
      quota = this.quotaRepo.create({
        companyId,
        userId: safeUserId,
        quotaDate: today,
        messageCount: 0,
        tokensUsed: 0,
        dailyMessageLimit: 50,
        dailyTokenLimit: 200000,
        resetAt,
      });
      quota = await this.quotaRepo.save(quota);
    }

    if (quota.messageCount >= quota.dailyMessageLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Daily Copilot limit reached (${quota.dailyMessageLimit}/${quota.dailyMessageLimit} free messages used today). Your free quota will reset at ${quota.resetAt.toISOString()}.`,
          resetAt: quota.resetAt,
          dailyMessageLimit: quota.dailyMessageLimit,
          messageCount: quota.messageCount,
          remaining: 0,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return quota;
  }

  /**
   * Increments message count and token usage atomically.
   */
  async recordQuotaUsage(quotaId: string, tokensUsed: number) {
    try {
      await this.quotaRepo
        .createQueryBuilder()
        .update(CopilotDailyQuota)
        .set({
          messageCount: () => '"messageCount" + 1',
          tokensUsed: () => `"tokensUsed" + ${Math.max(0, tokensUsed)}`,
          updatedAt: new Date(),
        })
        .where('id = :id', { id: quotaId })
        .execute();
    } catch (err: any) {
      this.logger.error(`Failed to increment quota usage for ${quotaId}: ${err.message}`);
    }
  }

  /**
   * Retrieves or creates a conversation session for multi-turn continuity.
   */
  async getOrCreateConversation(
    companyId: string,
    userId: string,
    conversationId?: string,
    screenContext = 'general',
    entityId?: string,
    firstPrompt?: string,
  ): Promise<CopilotConversation> {
    const safeUserId = userId || '00000000-0000-0000-0000-000000000000';

    if (conversationId) {
      const existing = await this.conversationRepo.findOne({
        where: { id: conversationId, companyId, userId: safeUserId },
      });
      if (existing) {
        if (screenContext && existing.screenContext !== screenContext) {
          existing.screenContext = screenContext;
          if (entityId) existing.entityId = entityId;
          await this.conversationRepo.save(existing);
        }
        return existing;
      }
    }

    // Derive a clean title from prompt or screen
    let title = 'Metrology Copilot Chat';
    if (firstPrompt) {
      const clean = firstPrompt.trim().replace(/[\r\n]+/g, ' ');
      title = clean.length > 50 ? `${clean.slice(0, 47)}...` : clean;
    } else if (screenContext && screenContext !== 'general') {
      title = `${screenContext.replace(/_/g, ' ').toUpperCase()} Session`;
    }

    const conv = this.conversationRepo.create({
      companyId,
      userId: safeUserId,
      title,
      screenContext: screenContext || 'general',
      entityId: entityId || undefined,
      status: 'active',
    });

    return this.conversationRepo.save(conv);
  }

  /**
   * Retrieves user conversations for the history list.
   */
  async getUserConversations(companyId: string, userId: string, screenContext?: string) {
    const safeUserId = userId || '00000000-0000-0000-0000-000000000000';
    const qb = this.conversationRepo
      .createQueryBuilder('c')
      .where('c.companyId = :companyId', { companyId })
      .andWhere('c.userId = :userId', { userId: safeUserId })
      .andWhere('c.status = :status', { status: 'active' });

    if (screenContext && screenContext !== 'all') {
      qb.andWhere('c.screenContext = :screenContext', { screenContext });
    }

    return qb.orderBy('c.updatedAt', 'DESC').take(25).getMany();
  }

  /**
   * Retrieves messages for a specific conversation.
   */
  async getConversationMessages(companyId: string, userId: string, conversationId: string) {
    const safeUserId = userId || '00000000-0000-0000-0000-000000000000';
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, companyId, userId: safeUserId },
    });
    if (!conv) {
      throw new BadRequestException('Conversation not found or access denied.');
    }

    return this.messageRepo.find({
      where: { conversationId, companyId, userId: safeUserId },
      order: { createdAt: 'ASC' },
      take: 60,
    });
  }

  /**
   * Deletes a conversation and its messages.
   */
  async deleteConversation(companyId: string, userId: string, conversationId: string) {
    const safeUserId = userId || '00000000-0000-0000-0000-000000000000';
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, companyId, userId: safeUserId },
    });
    if (!conv) {
      throw new BadRequestException('Conversation not found.');
    }

    await this.messageRepo.delete({ conversationId, companyId });
    await this.conversationRepo.remove(conv);
    return { success: true, message: 'Conversation deleted.' };
  }

  /**
   * Cleans model output by extracting pure JSON from markdown code blocks or surrounding text.
   */
  private cleanModelJson(raw: string): string {
    let text = raw.trim();
    // 1. If wrapped in markdown code blocks
    if (text.includes('```json')) {
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (match && match[1]) text = match[1].trim();
    } else if (text.includes('```')) {
      const match = text.match(/```\s*([\s\S]*?)\s*```/);
      if (match && match[1]) text = match[1].trim();
    }
    // 2. If preceded by conversational text like "Here is the JSON requested:", extract outer { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1).trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {}
    }
    return text.trim();
  }

  /**
   * Fast-path check: Is the user input just a greeting or pleasantry without attachments/technical context?
   */
  private isPureGreeting(prompt: string): boolean {
    if (!prompt) return false;
    const clean = prompt.trim().toLowerCase().replace(/[^\w\s]/g, '').trim();
    const pureGreetings = new Set([
      'hi',
      'hello',
      'hey',
      'heyy',
      'heyyy',
      'hi copilot',
      'hello copilot',
      'hey copilot',
      'hi bot',
      'hello bot',
      'greetings',
      'good morning',
      'good afternoon',
      'good evening',
      'good day',
      'howdy',
      'sup',
      'yo',
      'hola',
      'vanakkam',
      'namaste',
      'thanks',
      'thank you',
      'thx',
      'ok',
      'okay',
      'cool',
      'great',
    ]);
    return pureGreetings.has(clean);
  }

  /**
   * Executes a prompt with automatic model fallback cascading, fast timeouts, and 503/429 recovery.
   */
  private async executeGeminiGenerateContent(
    apiKey: string,
    preferredModel: string,
    requestBody: any,
  ): Promise<{ text: string; usageMetadata?: any; model: string; isFallback: boolean; requestedModel: string }> {
    const candidateModels = [
      preferredModel,
      ...DEFAULT_FALLBACK_MODELS.filter((m) => m !== preferredModel),
    ];

    let lastError = 'Failed to connect to Google Gemini API';

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (response.ok) {
          const data = await response.json();
          const candidateParts = data?.candidates?.[0]?.content?.parts || [];
          const text = candidateParts
            .map((p: any) => p.text || '')
            .join('')
            .trim();
          if (text) {
            this.logger.log(`Gemini request succeeded using model: ${model} (Preferred was: ${preferredModel})`);
            return {
              text: this.cleanModelJson(text),
              usageMetadata: data?.usageMetadata,
              model,
              isFallback: model !== preferredModel,
              requestedModel: preferredModel,
            };
          }
          lastError = `Model ${model} returned an empty response.`;
        } else {
          const errText = await response.text();
          let errMessage = `Error ${response.status}: ${response.statusText}`;
          try {
            const errJson = JSON.parse(errText);
            if (errJson.error?.message) errMessage = errJson.error.message;
          } catch {}

          // If Authentication / Permission Failed from Google Gemini (401 / 403)
          if (response.status === 401 || response.status === 403) {
            throw new HttpException(
              `Google Gemini API Key or Permission Error: ${errMessage}. Please verify your Gemini API Key in Settings -> AI & Copilot Configuration.`,
              HttpStatus.BAD_GATEWAY,
            );
          }

          // If Rate Limited (429) or High Demand (503) or Gateway Errors (500, 502, 504)
          if (response.status === 429 || response.status === 503 || response.status >= 500) {
            let cleanErrMessage = errMessage;
            
            if (response.status === 429 && errMessage.includes('generate_content_free_tier_requests')) {
              const retryMatch = errMessage.match(/Please retry in (\d+\.?\d*)s/);
              const retrySeconds = retryMatch ? parseFloat(retryMatch[1]).toFixed(1) : 'a few';
              cleanErrMessage = `Free Tier Limit Reached (Max 15 requests/minute). Please retry in ${retrySeconds} seconds.`;
            } else if (response.status === 503) {
              cleanErrMessage = `Model ${model} is experiencing high demand. Spikes are usually temporary.`;
            }

            this.logger.warn(`Model ${model} returned ${response.status} (${errMessage}), auto-cascading to next candidate model...`);
            lastError = cleanErrMessage;
            if (response.status === 429) {
              await new Promise((r) => setTimeout(r, 600));
            }
            continue;
          }

          lastError = errMessage;
        }
      } catch (err: any) {
        if (err instanceof HttpException) throw err;
        const isTimeout = err.name === 'AbortError';
        this.logger.warn(`Model ${model} attempt failed (${isTimeout ? 'Request timed out after 20s' : err.message}), trying next candidate...`);
        lastError = isTimeout ? `Model ${model} timed out after 20s` : err.message || 'Network error communicating with Gemini API';
        continue;
      }
    }

    throw new HttpException(
      `Gemini Gateway Error: ${lastError}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Handles Copilot prompts on the backend gateway with session persistence,
   * sliding-window conversation history, and daily quota limits.
   */
  async executeCopilot(companyId: string, userId: string, dto: CopilotPromptDto) {
    const safeUserId = userId || '00000000-0000-0000-0000-000000000000';

    // 1. Enforce strict daily quota limit (50 messages/day)
    const quota = await this.validateQuotaAvailable(companyId, safeUserId);

    // 2. Resolve organization's Gemini key
    const { apiKey, defaultModel, enabled } = await this.resolveCompanyKey(companyId);

    if (!enabled) {
      throw new BadRequestException('AI Copilot features are currently disabled for your organization.');
    }

    if (!apiKey) {
      throw new BadRequestException(
        'Gemini API Key is not configured for your company. Please ask an administrator to configure it under Settings -> AI & Copilot Configuration.',
      );
    }

    // 3. Resolve or initialize conversation session
    const conversation = await this.getOrCreateConversation(
      companyId,
      safeUserId,
      dto.conversationId,
      dto.screenContext || 'general',
      dto.entityId,
      dto.prompt,
    );

    const hasAttachments = Boolean(dto.attachments && dto.attachments.length > 0);
    const isPureGreeting = this.isPureGreeting(dto.prompt) && !hasAttachments;

    // FAST-PATH: Pure Greetings & Pleasantries consume 0 API tokens and respond in <5ms
    if (isPureGreeting) {
      const cleanPrompt = dto.prompt.trim().toLowerCase().replace(/[^\w\s]/g, '').trim();
      let reply = 'Hello! I am your ISO/IEC 17025 Metrology Copilot. How can I assist you with your calibration templates, measurement tables, or formula audits today?';
      let suggestions = [
        'Audit current template & formulas',
        'Add ISO 17025 uncertainty budget',
        'Test measurement boundary conditions',
        'Parse certificate or drawing attachment',
      ];

      if (['thanks', 'thank you', 'thx', 'ok', 'okay', 'cool', 'great'].includes(cleanPrompt)) {
        reply = 'You are welcome! Let me know whenever you need help verifying calibration data, adjusting tolerances, or formatting ISO 17025 certificates.';
        suggestions = [
          'Audit current template & formulas',
          'Check tolerance calculations',
          'Add repeatability verification',
        ];
      }

      const fastPayload = {
        reply,
        action: 'NONE',
        actionPayload: {},
        suggestions,
      };
      const textOutput = JSON.stringify(fastPayload);

      // Persist User Message (0 prompt tokens)
      const userMsg = this.messageRepo.create({
        conversationId: conversation.id,
        companyId,
        userId: safeUserId,
        role: 'user',
        content: dto.prompt,
        promptTokens: 0,
        candidateTokens: 0,
        totalTokens: 0,
      });
      await this.messageRepo.save(userMsg);

      // Persist Assistant Response (0 candidate tokens)
      const assistantMsg = this.messageRepo.create({
        conversationId: conversation.id,
        companyId,
        userId: safeUserId,
        role: 'assistant',
        content: textOutput,
        model: 'instant-copilot',
        promptTokens: 0,
        candidateTokens: 0,
        totalTokens: 0,
        actionPayload: null,
        suggestions,
      });
      await this.messageRepo.save(assistantMsg);

      await this.conversationRepo.update(conversation.id, { updatedAt: new Date() });
      const updatedQuota = await this.getQuotaStatus(companyId, safeUserId);

      return {
        rawText: textOutput,
        modelUsed: 'instant-copilot',
        conversationId: conversation.id,
        timestamp: new Date().toISOString(),
        quota: updatedQuota,
      };
    }

    // 4. Fetch recent conversation messages for sliding window context (last 6 messages)
    const recentMessages = await this.messageRepo.find({
      where: { conversationId: conversation.id, companyId, userId: safeUserId },
      order: { createdAt: 'DESC' },
      take: 6,
    });
    recentMessages.reverse();

    const parts: any[] = [{ text: COPILOT_SYSTEM_PROMPT }];

    // Inject active operational screen context
    const screenInfo = [
      `--- OPERATIONAL SCREEN CONTEXT ---`,
      `Active Screen / Module: ${dto.screenContext || conversation.screenContext || 'general'}`,
      dto.entityId ? `Active Entity ID: ${dto.entityId}` : '',
      `--- END SCREEN CONTEXT ---`,
    ].filter(Boolean).join('\n');
    parts.push({ text: screenInfo });

    // Inject multi-turn sliding window history with compressed turns to save tokens
    if (recentMessages.length > 0) {
      const historyTranscript = recentMessages
        .map((m) => {
          let text = m.content;
          if (m.role === 'assistant') {
            try {
              const parsed = JSON.parse(m.content);
              if (parsed.reply) text = parsed.reply;
            } catch {}
            text = text
              .replace(/```mermaid[\s\S]*?```/g, '[diagram]')
              .replace(/\|[^\n]+\|/g, '')
              .replace(/\n{2,}/g, '\n');
            if (text.length > 250) {
              text = text.slice(0, 250) + '...';
            }
          } else {
            if (text.length > 200) {
              text = text.slice(0, 200) + '...';
            }
          }
          return `[${m.role.toUpperCase()}]: ${text.trim()}`;
        })
        .join('\n\n');
      parts.push({
        text: `--- PREVIOUS CONVERSATION CONTEXT (SLIDING WINDOW) ---\n${historyTranscript}\n--- END PREVIOUS CONVERSATION ---`,
      });
    }

    // Process attachments
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

    // Check if technical prompt or screen data is needed
    const isTechnicalPrompt =
      hasAttachments ||
      /(template|table|column|row|formula|tolerance|reading|deviation|uncertainty|dimension|spec|iso|audit|error|certificate|calculate|check|draw|workflow|nominal|limit)/i.test(
        dto.prompt,
      );

    // Smart context pruning: Only inject screen data if prompt is technical or has attachments
    if (dto.context && isTechnicalPrompt) {
      parts.push({
        text: `Active Screen Data / Template Context for reference:\n${JSON.stringify(dto.context)}`,
      });
    }

    // Ensure sufficient headroom for Gemini reasoning models (thinking tokens count towards maxOutputTokens)
    const maxOutputTokens = 2048;

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens,
      },
    };

    // 5. Invoke Gemini with model fallback
    const { text: textOutput, usageMetadata, model: modelUsed, isFallback, requestedModel } = await this.executeGeminiGenerateContent(
      apiKey,
      defaultModel,
      requestBody,
    );

    // 6. Parse structured response for actions & proactive suggestions
    let textOutputFinal = textOutput;
    let actionPayload: any = null;
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(textOutput);
      if (parsed.actionPayload) actionPayload = parsed.actionPayload;
      if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions;

      // Intercept accidental or explicit requests for "Gauge Receipt Condition"
      const isReceiptConditionQuery = /(?:gauge\s+)?receipt\s+condition|visual\s+condition|dent\s+(?:&|and)\s+damage/i.test(dto.prompt);
      const isReceiptConditionAction = actionPayload?.newTable?.title && /(?:gauge\s+)?receipt\s+condition|visual\s+condition|dent\s+(?:&|and)\s+damage/i.test(actionPayload.newTable.title);

      if (isReceiptConditionQuery || isReceiptConditionAction) {
        parsed.action = 'NONE';
        parsed.actionPayload = {};
        parsed.reply =
          "Gauge Receipt Condition (such as visual inspection, dent & damage, and cleanliness checks) is already available by default in Gaugemaster as a standard pre-calibration inspection workflow and certificate header field. It is intentionally excluded from calibration measurement grids.";
        parsed.suggestions = [
          "Configure measurement parameters",
          "Audit calculation formulas",
          "Verify nominal tolerances"
        ];
        actionPayload = null;
        suggestions = parsed.suggestions;
        textOutputFinal = JSON.stringify(parsed);
      }

      // Intercept accidental or explicit requests for "Traceability of Masters" / "Standard Equipments Used"
      const isMasterTraceabilityQuery =
        /(?:traceability(?:\s+of)?\s+masters?|standard\s+equipments?(?:\s+used)?|master\s+(?:equipments?|instruments?|standards?|details?)|reference\s+standards?|masters?\s+used)/i.test(dto.prompt);
      const isMasterTraceabilityAction =
        actionPayload?.newTable?.title &&
        /(?:traceability(?:\s+of)?\s+masters?|standard\s+equipments?(?:\s+used)?|master\s+(?:equipments?|instruments?|standards?|details?)|reference\s+standards?|masters?\s+used)/i.test(actionPayload.newTable.title);

      if (isMasterTraceabilityQuery || isMasterTraceabilityAction) {
        parsed.action = 'NONE';
        parsed.actionPayload = {};
        parsed.reply =
          "Traceability of Masters (Standard Equipments used for calibration, including Master Instrument Name, Make, Serial/ID No., Certificate No., Validity Date, and Calibration Agency) is already available by default in Gaugemaster as a standard calibration workflow step (Step 2: Reference Standard) and standard certificate header section. It is intentionally excluded from calibration measurement grids.";
        parsed.suggestions = [
          "Configure measurement parameters",
          "Audit calculation formulas",
          "Verify nominal tolerances"
        ];
        actionPayload = null;
        suggestions = parsed.suggestions;
        textOutputFinal = JSON.stringify(parsed);
      }
    } catch {}

    const promptTokens = usageMetadata?.promptTokenCount || Math.ceil(dto.prompt.length / 4);
    const candidateTokens = usageMetadata?.candidatesTokenCount || Math.ceil(textOutputFinal.length / 4);
    const totalTokens = promptTokens + candidateTokens;

    // 7. Persist User Message
    const userMsg = this.messageRepo.create({
      conversationId: conversation.id,
      companyId,
      userId: safeUserId,
      role: 'user',
      content: dto.prompt,
      attachments: dto.attachments ? dto.attachments.map((a) => ({ name: a.name, type: a.type })) : undefined,
      promptTokens: 0,
      candidateTokens: 0,
      totalTokens: promptTokens,
    });
    await this.messageRepo.save(userMsg);

    // 8. Persist Assistant Response
    const assistantMsg = this.messageRepo.create({
      conversationId: conversation.id,
      companyId,
      userId: safeUserId,
      role: 'assistant',
      content: textOutputFinal,
      model: modelUsed,
      promptTokens,
      candidateTokens,
      totalTokens,
      actionPayload,
      suggestions,
    });
    await this.messageRepo.save(assistantMsg);

    // 9. Increment Daily Quota atomically and update conversation timestamp
    await this.recordQuotaUsage(quota.id, totalTokens);
    await this.conversationRepo.update(conversation.id, { updatedAt: new Date() });

    // 10. Fetch updated quota stats
    const updatedQuota = await this.getQuotaStatus(companyId, safeUserId);

    return {
      rawText: textOutputFinal,
      modelUsed,
      requestedModel,
      isFallback,
      conversationId: conversation.id,
      timestamp: new Date().toISOString(),
      quota: updatedQuota,
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
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const { text: textOutput, model: modelUsed } = await this.executeGeminiGenerateContent(
      apiKey,
      defaultModel,
      requestBody,
    );

    // Deterministic post-processing filter: Strictly strip GAUGE RECEIPT CONDITION tables/blocks
    let sanitizedJson = textOutput;
    try {
      let cleaned = textOutput.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(cleaned);

      const isOmittedDefaultSectionText = (t: string) => {
        const s = (t || '').toLowerCase().trim();
        return (
          // Receipt condition
          s.includes('receipt condition') ||
          s.includes('condition on receipt') ||
          s.includes('condition of item') ||
          s.includes('condition of gauge') ||
          s.includes('visual inspection') ||
          s.includes('visual condition') ||
          s.includes('dent & damage') ||
          s.includes('dent and damage') ||
          s.includes('no dent & damage') ||
          s.includes('receipt inspection') ||
          // Master equipment & traceability
          s.includes('traceability of master') ||
          s.includes('traceability of masters') ||
          s.includes('traceability') ||
          s.includes('master used') ||
          s.includes('masters used') ||
          s.includes('master equipment') ||
          s.includes('master equipments') ||
          s.includes('master instrument') ||
          s.includes('master instruments') ||
          s.includes('master details') ||
          s.includes('standard equipment') ||
          s.includes('standard equipments') ||
          s.includes('reference standard') ||
          s.includes('reference standards') ||
          s.includes('standards used') ||
          s.includes('equipment used for calibration') ||
          s.includes('standard used for calibration')
        );
      };

      const filterBlock = (b: any): boolean => {
        if (!b) return false;
        if (isOmittedDefaultSectionText(b.title || b.id || b.name)) return false;
        // Check if table columns represent Master Traceability metadata (e.g. cert_no, validity, cal_agency)
        if (b.type === 'table_grid' && Array.isArray(b.columns)) {
          const colIdsOrLabels = b.columns.map((c: any) => (c.id || c.label || '').toLowerCase()).join(' ');
          if (
            (colIdsOrLabels.includes('cert_no') || colIdsOrLabels.includes('certificate') || colIdsOrLabels.includes('traceab')) &&
            (colIdsOrLabels.includes('validity') || colIdsOrLabels.includes('due_date')) &&
            (colIdsOrLabels.includes('master') || colIdsOrLabels.includes('agency') || colIdsOrLabels.includes('standard'))
          ) {
            return false;
          }
        }
        if (b.type === 'table_grid' && Array.isArray(b.rows)) {
          const originalLength = b.rows.length;
          const validRows = b.rows.filter((r: any) => {
            const rowDesc = r.description || r.required_dimension || r.parameter_name || r.name || '';
            const rowVal = r.actual || r.reading || r.actual_dimension || '';
            return !isOmittedDefaultSectionText(rowDesc) && !isOmittedDefaultSectionText(rowVal);
          });
          b.rows = validRows;
          if (validRows.length === 0 && originalLength > 0) return false;
        }
        return true;
      };

      if (Array.isArray(parsed.blocks)) {
        parsed.blocks = parsed.blocks.filter(filterBlock);
      } else if (Array.isArray(parsed.sections)) {
        parsed.sections = parsed.sections.filter(filterBlock);
      } else if (Array.isArray(parsed.tables)) {
        parsed.tables = parsed.tables.filter(filterBlock);
      }

      sanitizedJson = JSON.stringify(parsed);
    } catch (parseErr: any) {
      this.logger.warn(`Could not post-filter template JSON: ${parseErr.message}`);
    }

    return {
      rawJson: sanitizedJson,
      modelUsed,
      timestamp: new Date().toISOString(),
    };
  }
}
