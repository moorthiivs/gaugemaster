import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizeInstrumentFrequencies1779450000000 implements MigrationInterface {
    name = 'NormalizeInstrumentFrequencies1779450000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create a safe backup table of existing raw frequency strings before normalization
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "_backup_instruments_frequency_1779450000000" AS
            SELECT id, frequency FROM "instruments";
        `);

        // 2. Normalize frequency strings to clean, canonical standard values
        await queryRunner.query(`
            UPDATE "instruments"
            SET "frequency" = CASE
                -- 3 Years
                WHEN "frequency" ILIKE '%3%year%' OR "frequency" ILIKE '%36%month%' THEN '3 Years'
                -- 2 Years
                WHEN "frequency" ILIKE '%2%year%' OR "frequency" ILIKE '%24%month%' THEN '2 Years'
                -- 6 Months
                WHEN "frequency" ILIKE '%6%month%' OR "frequency" ILIKE '%half%' OR "frequency" ILIKE '%semi%' THEN '6 Months'
                -- 3 Months
                WHEN "frequency" ILIKE '%3%month%' OR "frequency" ILIKE '%quarter%' THEN '3 Months'
                -- 1 Month (specifically 1 month, ignoring 12)
                WHEN "frequency" ILIKE '%1%month%' AND "frequency" NOT ILIKE '%12%' THEN '1 Month'
                WHEN "frequency" = 'monthly' OR "frequency" ILIKE 'once in%month' THEN '1 Month'
                -- 1 Year / 12 Months / default
                WHEN "frequency" ILIKE '%year%' OR "frequency" ILIKE '%annu%' OR "frequency" ILIKE '%12%month%' OR "frequency" IS NULL OR "frequency" = '' THEN '1 Year'
                ELSE "frequency"
            END
            WHERE "frequency" IS NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore original frequencies from backup table if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_backup_instruments_frequency_1779450000000') THEN
                    UPDATE "instruments" i
                    SET "frequency" = b.frequency
                    FROM "_backup_instruments_frequency_1779450000000" b
                    WHERE i.id = b.id;
                    
                    DROP TABLE "_backup_instruments_frequency_1779450000000";
                END IF;
            END $$;
        `);
    }
}

