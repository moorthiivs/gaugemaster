import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPartNameAndIdCodeToDiagramsAndWorkInstructions1779290000000 implements MigrationInterface {
    name = 'AddPartNameAndIdCodeToDiagramsAndWorkInstructions1779290000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns to gauge_diagrams
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" ADD COLUMN IF NOT EXISTS "id_code" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" ADD COLUMN IF NOT EXISTS "part_name" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" ADD COLUMN IF NOT EXISTS "instrument_id" character varying;`);

        // Add columns to gauge_diagram_history
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagram_history" ADD COLUMN IF NOT EXISTS "id_code" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagram_history" ADD COLUMN IF NOT EXISTS "part_name" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagram_history" ADD COLUMN IF NOT EXISTS "instrument_id" character varying;`);

        // Add columns to work_instructions
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" ADD COLUMN IF NOT EXISTS "id_code" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" ADD COLUMN IF NOT EXISTS "part_name" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" ADD COLUMN IF NOT EXISTS "instrument_id" character varying;`);

        // Add columns to work_instruction_history
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instruction_history" ADD COLUMN IF NOT EXISTS "id_code" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instruction_history" ADD COLUMN IF NOT EXISTS "part_name" character varying;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instruction_history" ADD COLUMN IF NOT EXISTS "instrument_id" character varying;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instruction_history" DROP COLUMN IF EXISTS "instrument_id";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instruction_history" DROP COLUMN IF EXISTS "part_name";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instruction_history" DROP COLUMN IF EXISTS "id_code";`);

        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" DROP COLUMN IF EXISTS "instrument_id";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" DROP COLUMN IF EXISTS "part_name";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "work_instructions" DROP COLUMN IF EXISTS "id_code";`);

        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagram_history" DROP COLUMN IF EXISTS "instrument_id";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagram_history" DROP COLUMN IF EXISTS "part_name";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagram_history" DROP COLUMN IF EXISTS "id_code";`);

        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" DROP COLUMN IF EXISTS "instrument_id";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" DROP COLUMN IF EXISTS "part_name";`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "gauge_diagrams" DROP COLUMN IF EXISTS "id_code";`);
    }
}
