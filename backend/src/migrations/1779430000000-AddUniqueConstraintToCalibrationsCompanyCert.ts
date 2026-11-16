import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintToCalibrationsCompanyCert1779430000000 implements MigrationInterface {
    name = 'AddUniqueConstraintToCalibrationsCompanyCert1779430000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create partial unique index on calibrations (companyId, certificate_number) for active records
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_calibrations_company_cert_unique" 
            ON "calibrations" ("companyId", "certificate_number") 
            WHERE "deleted_at" IS NULL AND "certificate_number" IS NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_calibrations_company_cert_unique";`);
    }
}

