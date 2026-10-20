import { MigrationInterface, QueryRunner } from "typeorm";

export class FixInHouseCalibrationSource1779380000000 implements MigrationInterface {
    name = 'FixInHouseCalibrationSource1779380000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Update calibration_history entries that match calibrations created inside the app
        await queryRunner.query(`
            UPDATE calibration_history ch
            SET calibration_source = 'In-House'
            FROM calibrations c
            WHERE c.instrument_id = ch.instrument_id
              AND DATE(c.calibration_date) = DATE(ch.last_calibration_date)
              AND (ch.calibration_source IS NULL 
                   OR ch.calibration_source = ''
                   OR ch.calibration_source ILIKE 'inhouse'
                   OR ch.calibration_source ILIKE 'external'
                   OR ch.calibration_source = 'Initial Master');
        `);

        // 2. Also match calibration_history by certificate file / certificate number
        await queryRunner.query(`
            UPDATE calibration_history ch
            SET calibration_source = 'In-House'
            FROM calibrations c
            WHERE c.instrument_id = ch.instrument_id
              AND (
                (c.certificate_file IS NOT NULL AND ch.certificate_file = c.certificate_file)
                OR (c.certificate_number IS NOT NULL AND ch.certificate_file ILIKE '%' || c.certificate_number || '%')
              )
              AND (ch.calibration_source IS NULL 
                   OR ch.calibration_source = ''
                   OR ch.calibration_source ILIKE 'inhouse'
                   OR ch.calibration_source ILIKE 'external');
        `);

        // 3. Update instruments whose calibrations were performed inside the app
        await queryRunner.query(`
            UPDATE instruments i
            SET calibration_source = 'In-House'
            FROM calibrations c
            WHERE c.instrument_id = i.id
              AND (i.calibration_source IS NULL 
                   OR i.calibration_source = '' 
                   OR i.calibration_source ILIKE 'inhouse'
                   OR i.calibration_source ILIKE 'external');
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Data fix migration; down is a no-op as restoring empty/incorrect strings is undesirable
    }
}
