import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncInstrumentDatesWithLatestCalibration1779460000000 implements MigrationInterface {
    name = 'SyncInstrumentDatesWithLatestCalibration1779460000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Sync instruments with their latest in-house calibration record
        await queryRunner.query(`
            WITH latest_cals AS (
                SELECT DISTINCT ON (instrument_id)
                    id,
                    instrument_id,
                    calibration_date,
                    next_calibration_date,
                    certificate_number,
                    certificate_file,
                    approval_status,
                    verdict
                FROM calibrations
                WHERE deleted_at IS NULL
                ORDER BY instrument_id, calibration_date DESC, created_at DESC
            )
            UPDATE instruments i
            SET last_calibration_date = lc.calibration_date,
                due_date = lc.next_calibration_date,
                cert_no = lc.certificate_number,
                calibration_source = 'In-House'
            FROM latest_cals lc
            WHERE i.id = lc.instrument_id
              AND (
                i.last_calibration_date IS DISTINCT FROM lc.calibration_date
                OR i.due_date IS DISTINCT FROM lc.next_calibration_date
                OR i.cert_no IS DISTINCT FROM lc.certificate_number
              );
        `);

        // 2. Sync calibration_history entries for in-house calibrations
        await queryRunner.query(`
            WITH latest_cals AS (
                SELECT DISTINCT ON (instrument_id)
                    id,
                    instrument_id,
                    calibration_date,
                    next_calibration_date,
                    certificate_number,
                    certificate_file
                FROM calibrations
                WHERE deleted_at IS NULL
                ORDER BY instrument_id, calibration_date DESC, created_at DESC
            ),
            target_histories AS (
                SELECT DISTINCT ON (ch.instrument_id)
                    ch.id as history_id,
                    lc.calibration_date,
                    lc.next_calibration_date,
                    lc.certificate_file
                FROM calibration_history ch
                JOIN latest_cals lc ON lc.instrument_id = ch.instrument_id
                WHERE ch.calibration_source = 'In-House'
                ORDER BY ch.instrument_id, ch.created_at DESC
            )
            UPDATE calibration_history ch
            SET last_calibration_date = th.calibration_date,
                due_date = th.next_calibration_date
            FROM target_histories th
            WHERE ch.id = th.history_id
              AND (
                ch.last_calibration_date IS DISTINCT FROM th.calibration_date
                OR ch.due_date IS DISTINCT FROM th.next_calibration_date
              );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op rollback as this is a data synchronization migration
    }
}

