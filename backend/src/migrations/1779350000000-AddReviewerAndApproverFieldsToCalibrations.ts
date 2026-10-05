import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewerAndApproverFieldsToCalibrations1779350000000 implements MigrationInterface {
    name = 'AddReviewerAndApproverFieldsToCalibrations1779350000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "reviewer_remarks" text;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "reviewed_by_id" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "approved_by_id" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "approver_remarks" text;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "approver_remarks";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "approved_by_id";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "reviewed_by_id";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "reviewer_remarks";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "reviewed_at";`);
    }
}
