import { MigrationInterface, QueryRunner } from "typeorm";

export class DecoupleCompanyAndUserForeignKeys1779330000000 implements MigrationInterface {
    name = 'DecoupleCompanyAndUserForeignKeys1779330000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Companies - make registeredUserId nullable and change FK to ON DELETE SET NULL
        await queryRunner.query(`ALTER TABLE IF EXISTS "companies" ALTER COLUMN "registeredUserId" DROP NOT NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "companies" DROP CONSTRAINT IF EXISTS "FK_a43fffcf7dda054ee7bd24c66be";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "companies" ADD CONSTRAINT "FK_a43fffcf7dda054ee7bd24c66be" FOREIGN KEY ("registeredUserId") REFERENCES "users"("id") ON DELETE SET NULL;`);

        // 2. Instruments - set created_by and updated_by to ON DELETE SET NULL
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" DROP CONSTRAINT IF EXISTS "FK_7bb07d4f5a8014e9b540b06819c";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD CONSTRAINT "FK_7bb07d4f5a8014e9b540b06819c" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" DROP CONSTRAINT IF EXISTS "FK_da331de0b49de044b169ff70668";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD CONSTRAINT "FK_da331de0b49de044b169ff70668" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;`);

        // 3. Calibrations - set created_by to ON DELETE SET NULL
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP CONSTRAINT IF EXISTS "FK_1db5fa8e331dc5805cab07743e7";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD CONSTRAINT "FK_1db5fa8e331dc5805cab07743e7" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;`);

        // 4. ReminderFrequncy - set created_by and updated_by to ON DELETE SET NULL
        await queryRunner.query(`ALTER TABLE IF EXISTS "ReminderFrequncy" DROP CONSTRAINT IF EXISTS "FK_04d2eaa3406b81486b66c06a13f";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "ReminderFrequncy" ADD CONSTRAINT "FK_04d2eaa3406b81486b66c06a13f" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "ReminderFrequncy" DROP CONSTRAINT IF EXISTS "FK_999e057d2a225ca9a84559d68e0";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "ReminderFrequncy" ADD CONSTRAINT "FK_999e057d2a225ca9a84559d68e0" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert 4: ReminderFrequncy
        await queryRunner.query(`ALTER TABLE IF EXISTS "ReminderFrequncy" DROP CONSTRAINT IF EXISTS "FK_999e057d2a225ca9a84559d68e0";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "ReminderFrequncy" ADD CONSTRAINT "FK_999e057d2a225ca9a84559d68e0" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "ReminderFrequncy" DROP CONSTRAINT IF EXISTS "FK_04d2eaa3406b81486b66c06a13f";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "ReminderFrequncy" ADD CONSTRAINT "FK_04d2eaa3406b81486b66c06a13f" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION;`);

        // Revert 3: Calibrations
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" DROP CONSTRAINT IF EXISTS "FK_1db5fa8e331dc5805cab07743e7";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "calibrations" ADD CONSTRAINT "FK_1db5fa8e331dc5805cab07743e7" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION;`);

        // Revert 2: Instruments
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" DROP CONSTRAINT IF EXISTS "FK_da331de0b49de044b169ff70668";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD CONSTRAINT "FK_da331de0b49de044b169ff70668" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" DROP CONSTRAINT IF EXISTS "FK_7bb07d4f5a8014e9b540b06819c";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "instruments" ADD CONSTRAINT "FK_7bb07d4f5a8014e9b540b06819c" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION;`);

        // Revert 1: Companies
        await queryRunner.query(`ALTER TABLE IF EXISTS "companies" DROP CONSTRAINT IF EXISTS "FK_a43fffcf7dda054ee7bd24c66be";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "companies" ADD CONSTRAINT "FK_a43fffcf7dda054ee7bd24c66be" FOREIGN KEY ("registeredUserId") REFERENCES "users"("id") ON DELETE CASCADE;`);
    }
}
