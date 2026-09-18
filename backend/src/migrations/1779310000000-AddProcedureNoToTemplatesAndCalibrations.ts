import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcedureNoToTemplatesAndCalibrations1779310000000 implements MigrationInterface {
    name = 'AddProcedureNoToTemplatesAndCalibrations1779310000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "procedure_no" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "procedure_no" character varying;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "procedure_no";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "procedure_no";`);
    }
}
