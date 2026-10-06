import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVerdictOverrideAndCalculatedVerdictToCalibrations1779370000000 implements MigrationInterface {
    name = 'AddVerdictOverrideAndCalculatedVerdictToCalibrations1779370000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "calculated_verdict" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "is_verdict_overridden" boolean DEFAULT false;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "verdict_override_reason" text;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "template_version_id" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "version";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "template_version_id";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "verdict_override_reason";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "is_verdict_overridden";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "calculated_verdict";`);
    }
}
