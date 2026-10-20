import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomInstrumentStatusesToSettings1779390000000 implements MigrationInterface {
    name = 'AddCustomInstrumentStatusesToSettings1779390000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "settings" 
            ADD COLUMN IF NOT EXISTS "customInstrumentStatuses" jsonb DEFAULT '[]'::jsonb;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "settings" 
            DROP COLUMN IF EXISTS "customInstrumentStatuses";
        `);
    }
}
