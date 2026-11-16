import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTemplateAndProcedureDocumentControlFields1779300000000 implements MigrationInterface {
    name = 'AddTemplateAndProcedureDocumentControlFields1779300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns to calibration_templates
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "doc_date" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "doc_rev" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "procedure_name" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "procedure_date" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "procedure_rev" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "acceptance_criteria_doc_no" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "acceptance_criteria_date" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "acceptance_criteria_rev" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" ADD COLUMN IF NOT EXISTS "acceptance_criteria_reference" text;`);

        // Add columns to calibrations
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "doc_date" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "doc_rev" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "procedure_name" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "procedure_date" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "procedure_rev" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "acceptance_criteria_doc_no" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "acceptance_criteria_date" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "acceptance_criteria_rev" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "acceptance_criteria_reference" text;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop columns from calibrations
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "acceptance_criteria_reference";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "acceptance_criteria_rev";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "acceptance_criteria_date";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "acceptance_criteria_doc_no";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "procedure_rev";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "procedure_date";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "procedure_name";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "doc_rev";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "doc_date";`);

        // Drop columns from calibration_templates
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "acceptance_criteria_reference";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "acceptance_criteria_rev";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "acceptance_criteria_date";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "acceptance_criteria_doc_no";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "procedure_rev";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "procedure_date";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "procedure_name";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "doc_rev";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibration_templates" DROP COLUMN IF EXISTS "doc_date";`);
    }
}
