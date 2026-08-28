import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeviceTypeToInstruments1779260000000 implements MigrationInterface {
    name = 'AddDeviceTypeToInstruments1779260000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD COLUMN IF NOT EXISTS "device_type" character varying;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" DROP COLUMN IF EXISTS "device_type";`);
    }
}
