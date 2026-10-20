import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecalibrationOfIdToCalibrations1779360000000 implements MigrationInterface {
    name = 'AddRecalibrationOfIdToCalibrations1779360000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD COLUMN IF NOT EXISTS "recalibration_of_id" character varying;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP COLUMN IF EXISTS "recalibration_of_id";`);
    }
}
