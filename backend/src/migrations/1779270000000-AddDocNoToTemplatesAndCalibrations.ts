import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDocNoToTemplatesAndCalibrations1779270000000 implements MigrationInterface {
    name = 'AddDocNoToTemplatesAndCalibrations1779270000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "doc_no" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "doc_no" character varying;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "doc_no";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "doc_no";`);
    }
}
