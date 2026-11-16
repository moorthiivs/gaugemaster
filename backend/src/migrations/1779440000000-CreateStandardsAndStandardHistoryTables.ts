import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStandardsAndStandardHistoryTables1779440000000 implements MigrationInterface {
  name = 'CreateStandardsAndStandardHistoryTables1779440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create standards table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "standards" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "standard_number" character varying NOT NULL,
        "standard_name" character varying NOT NULL,
        "standard_type" character varying NOT NULL,
        "document_name" character varying NULL,
        "file_type" character varying NULL,
        "file_path" character varying NULL,
        "version" integer NOT NULL DEFAULT 1,
        "description" text NULL,
        "companyId" uuid NULL,
        "created_by_id" character varying NULL,
        "created_by_name" character varying NULL,
        "updated_by_id" character varying NULL,
        "updated_by_name" character varying NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE NULL,
        "deleted_by_id" character varying NULL,
        "deleted_by_name" character varying NULL,
        "deletion_reason" text NULL,
        CONSTRAINT "PK_standards_id" PRIMARY KEY ("id")
      );
    `);

    // 2. Create indices for standards table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_standards_company" ON "standards" ("companyId");
      CREATE INDEX IF NOT EXISTS "idx_standards_type" ON "standards" ("standard_type");
      CREATE INDEX IF NOT EXISTS "idx_standards_deleted_at" ON "standards" ("deleted_at");
      CREATE INDEX IF NOT EXISTS "idx_standards_number" ON "standards" ("standard_number");
    `);

    // 3. Create standard_history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "standard_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "standard_id" uuid NOT NULL,
        "standard_number" character varying NOT NULL,
        "standard_name" character varying NOT NULL,
        "standard_type" character varying NOT NULL,
        "document_name" character varying NULL,
        "file_type" character varying NULL,
        "file_path" character varying NULL,
        "version" integer NOT NULL DEFAULT 1,
        "action_details" text NULL,
        "created_by_id" character varying NULL,
        "created_by_name" character varying NULL,
        "companyId" uuid NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_standard_history_id" PRIMARY KEY ("id")
      );
    `);

    // 4. Create indices for standard_history table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sh_standard_id" ON "standard_history" ("standard_id");
      CREATE INDEX IF NOT EXISTS "idx_sh_company" ON "standard_history" ("companyId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "standard_history";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "standards";`);
  }
}

