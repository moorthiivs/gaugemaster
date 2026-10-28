import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRangeToDiagramsAndWorkInstructions1779420000000 implements MigrationInterface {
    name = 'AddRangeToDiagramsAndWorkInstructions1779420000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add range column to gauge_diagrams
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" ADD COLUMN IF NOT EXISTS "range" character varying;`);

        // Add range column to gauge_diagram_history
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagram_history" ADD COLUMN IF NOT EXISTS "range" character varying;`);

        // Add range column to work_instructions
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" ADD COLUMN IF NOT EXISTS "range" character varying;`);

        // Add range column to work_instruction_history
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instruction_history" ADD COLUMN IF NOT EXISTS "range" character varying;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instruction_history" DROP COLUMN IF EXISTS "range";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" DROP COLUMN IF EXISTS "range";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagram_history" DROP COLUMN IF EXISTS "range";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" DROP COLUMN IF EXISTS "range";`);
    }
}

