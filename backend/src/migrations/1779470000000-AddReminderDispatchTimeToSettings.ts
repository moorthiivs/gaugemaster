import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReminderDispatchTimeToSettings1779470000000 implements MigrationInterface {
    name = 'AddReminderDispatchTimeToSettings1779470000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "settings" 
            ADD COLUMN IF NOT EXISTS "reminderDispatchTime" character varying(10) DEFAULT '09:00',
            ADD COLUMN IF NOT EXISTS "lastReminderSentDate" character varying(20);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "settings" 
            DROP COLUMN IF EXISTS "reminderDispatchTime",
            DROP COLUMN IF EXISTS "lastReminderSentDate";
        `);
    }
}
