import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCopilotConversationsMessagesAndQuotas1779320000000 implements MigrationInterface {
    name = 'CreateCopilotConversationsMessagesAndQuotas1779320000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "copilot_conversations" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "companyId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "title" character varying(255) NOT NULL DEFAULT 'New Conversation',
                "screenContext" character varying(100) NOT NULL DEFAULT 'general',
                "entityId" character varying(255),
                "status" character varying(50) NOT NULL DEFAULT 'active',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_copilot_conversations" PRIMARY KEY ("id")
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_copilot_conv_company_user" 
            ON "copilot_conversations" ("companyId", "userId", "status");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_copilot_conv_screen" 
            ON "copilot_conversations" ("companyId", "screenContext");
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "copilot_messages" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "conversationId" uuid NOT NULL,
                "companyId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "role" character varying(20) NOT NULL,
                "content" text NOT NULL,
                "model" character varying(50),
                "promptTokens" integer NOT NULL DEFAULT 0,
                "candidateTokens" integer NOT NULL DEFAULT 0,
                "totalTokens" integer NOT NULL DEFAULT 0,
                "actionPayload" jsonb,
                "attachments" jsonb,
                "suggestions" jsonb,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_copilot_messages" PRIMARY KEY ("id")
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_copilot_msg_conv_created" 
            ON "copilot_messages" ("conversationId", "createdAt");
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "copilot_daily_quotas" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "companyId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "quotaDate" date NOT NULL,
                "messageCount" integer NOT NULL DEFAULT 0,
                "tokensUsed" integer NOT NULL DEFAULT 0,
                "dailyMessageLimit" integer NOT NULL DEFAULT 50,
                "dailyTokenLimit" integer NOT NULL DEFAULT 200000,
                "resetAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_copilot_daily_quotas" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_copilot_daily_quota_user_date" UNIQUE ("companyId", "userId", "quotaDate")
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_copilot_quota_date" 
            ON "copilot_daily_quotas" ("quotaDate");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "copilot_daily_quotas";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "copilot_messages";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "copilot_conversations";`);
    }
}
