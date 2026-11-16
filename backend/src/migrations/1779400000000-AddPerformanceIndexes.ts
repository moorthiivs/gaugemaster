import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPerformanceIndexes1779400000000 implements MigrationInterface {
    name = 'AddPerformanceIndexes1779400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Index on calibration_history for fast date-range queries & dashboard workload aggregations
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_cal_hist_last_date" 
            ON "calibration_history" ("last_calibration_date");
        `);

        // Composite and single-column indexes on instruments for frequent dashboard and inventory filters
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_inst_company_ref" 
            ON "instruments" ("companyId", "is_reference_standard");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_inst_device_type" 
            ON "instruments" ("companyId", "device_type");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_inst_id_code" 
            ON "instruments" ("companyId", "id_code");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_inst_item_status" 
            ON "instruments" ("companyId", "item_status");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_inst_item_status";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_inst_id_code";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_inst_device_type";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_inst_company_ref";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_cal_hist_last_date";`);
    }
}
