import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintToCalibrationsCompanyCert1779430000000 implements MigrationInterface {
    name = 'AddUniqueConstraintToCalibrationsCompanyCert1779430000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Resolve pre-existing duplicates in historical data by suffixing duplicates with -1, -2, etc.
        await queryRunner.query(`
            WITH duplicates AS (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY "companyId", "certificate_number" 
                           ORDER BY "created_at" ASC, id ASC
                       ) as row_num
                FROM calibrations
                WHERE "certificate_number" IS NOT NULL
            )
            UPDATE calibrations c
            SET certificate_number = c.certificate_number || '-' || (d.row_num - 1)
            FROM duplicates d
            WHERE c.id = d.id AND d.row_num > 1;
        `);

        // 2. Create partial unique index on calibrations (companyId, certificate_number) for active records
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

