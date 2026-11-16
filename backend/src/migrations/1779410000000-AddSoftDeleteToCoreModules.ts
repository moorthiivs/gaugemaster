import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSoftDeleteToCoreModules1779410000000 implements MigrationInterface {
    name = 'AddSoftDeleteToCoreModules1779410000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Calibrations
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "deleted_by_id" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "deleted_by_name" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "deletion_reason" text NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "deleted_with_parent_id" character varying NULL;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_calibrations_deleted_at" ON "calibrations" ("deleted_at");`);

        // 2. Instruments
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD COLUMN IF NOT EXISTS "deleted_by_id" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD COLUMN IF NOT EXISTS "deleted_by_name" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD COLUMN IF NOT EXISTS "deletion_reason" text NULL;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_instruments_deleted_at" ON "instruments" ("deleted_at");`);

        // 3. Calibration Templates
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "deleted_by_id" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "deleted_by_name" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "deletion_reason" text NULL;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_templates_deleted_at" ON "calibration_templates" ("deleted_at");`);

        // 4. Calibration Procedures
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_procedures" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_procedures" ADD COLUMN IF NOT EXISTS "deleted_by_id" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_procedures" ADD COLUMN IF NOT EXISTS "deleted_by_name" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_procedures" ADD COLUMN IF NOT EXISTS "deletion_reason" text NULL;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_procedures_deleted_at" ON "calibration_procedures" ("deleted_at");`);

        // 5. Work Instructions
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" ADD COLUMN IF NOT EXISTS "deleted_by_id" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" ADD COLUMN IF NOT EXISTS "deleted_by_name" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" ADD COLUMN IF NOT EXISTS "deletion_reason" text NULL;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_work_instructions_deleted_at" ON "work_instructions" ("deleted_at");`);

        // 6. Gauge Diagrams
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" ADD COLUMN IF NOT EXISTS "deleted_by_id" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" ADD COLUMN IF NOT EXISTS "deleted_by_name" character varying NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" ADD COLUMN IF NOT EXISTS "deletion_reason" text NULL;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_gauge_diagrams_deleted_at" ON "gauge_diagrams" ("deleted_at");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_gauge_diagrams_deleted_at";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_work_instructions_deleted_at";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_procedures_deleted_at";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_templates_deleted_at";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_instruments_deleted_at";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_calibrations_deleted_at";`);

        // Drop columns
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" DROP COLUMN IF EXISTS "deletion_reason", DROP COLUMN IF EXISTS "deleted_by_name", DROP COLUMN IF EXISTS "deleted_by_id", DROP COLUMN IF EXISTS "deleted_at";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" DROP COLUMN IF EXISTS "deletion_reason", DROP COLUMN IF EXISTS "deleted_by_name", DROP COLUMN IF EXISTS "deleted_by_id", DROP COLUMN IF EXISTS "deleted_at";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_procedures" DROP COLUMN IF EXISTS "deletion_reason", DROP COLUMN IF EXISTS "deleted_by_name", DROP COLUMN IF EXISTS "deleted_by_id", DROP COLUMN IF EXISTS "deleted_at";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "deletion_reason", DROP COLUMN IF EXISTS "deleted_by_name", DROP COLUMN IF EXISTS "deleted_by_id", DROP COLUMN IF EXISTS "deleted_at";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" DROP COLUMN IF EXISTS "deletion_reason", DROP COLUMN IF EXISTS "deleted_by_name", DROP COLUMN IF EXISTS "deleted_by_id", DROP COLUMN IF EXISTS "deleted_at";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "deleted_with_parent_id", DROP COLUMN IF EXISTS "deletion_reason", DROP COLUMN IF EXISTS "deleted_by_name", DROP COLUMN IF EXISTS "deleted_by_id", DROP COLUMN IF EXISTS "deleted_at";`);
    }
}
