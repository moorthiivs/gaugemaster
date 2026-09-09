import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLabelPrintHistories1779280000000 implements MigrationInterface {
    name = 'CreateLabelPrintHistories1779280000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "label_print_histories" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "companyId" uuid,
                "userId" uuid,
                "action" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'Print Label',
                "itemsCount" integer NOT NULL DEFAULT 0,
                "selectedFields" jsonb,
                "labelConfig" jsonb,
                "items" jsonb,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_label_print_histories" PRIMARY KEY ("id")
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_label_hist_company_created" 
            ON "label_print_histories" ("companyId", "createdAt");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "label_print_histories";`);
    }
}
