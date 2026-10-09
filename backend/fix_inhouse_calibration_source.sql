-- =====================================================================
-- FIX: Update In-House Calibration Source for App-Created Calibrations
-- =====================================================================

BEGIN;

-- 1. Identify affected records before fix
-- SELECT DISTINCT i.id_code, i.name, i.calibration_source AS inst_source, 
--        ch.calibration_source AS hist_source, c.certificate_number, c.approval_status
-- FROM calibrations c
-- JOIN instruments i ON i.id = c.instrument_id
-- LEFT JOIN calibration_history ch ON ch.instrument_id = i.id 
--   AND DATE(ch.last_calibration_date) = DATE(c.calibration_date)
-- WHERE (i.calibration_source != 'In-House' OR i.calibration_source IS NULL OR i.calibration_source = '')
--    OR (ch.calibration_source != 'In-House' OR ch.calibration_source IS NULL OR ch.calibration_source = '');

-- 2. Fix calibration_history matched by instrument and calibration date
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

-- 3. Fix calibration_history matched by certificate file or certificate number
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

-- 4. Fix instruments table: set calibration_source = 'In-House' for all instruments with in-app calibrations
UPDATE instruments i
SET calibration_source = 'In-House'
FROM calibrations c
WHERE c.instrument_id = i.id
  AND (i.calibration_source IS NULL 
       OR i.calibration_source = '' 
       OR i.calibration_source ILIKE 'inhouse'
       OR i.calibration_source ILIKE 'external');

COMMIT;
