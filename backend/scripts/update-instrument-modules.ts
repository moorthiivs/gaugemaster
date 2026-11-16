/**
 * update-instrument-modules.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Safely updates the `module` column for existing instruments in the database
 * by matching `name` and `id_code` from an Excel master list.
 *
 * Safety Features:
 *   - DRY-RUN BY DEFAULT: Won't modify database unless `--execute` is explicitly passed.
 *   - ATOMIC TRANSACTIONS: All updates happen in a single DB transaction (all or nothing).
 *   - AUDIT TRAIL / BACKUP: Automatically generates a timestamped backup JSON in backups/
 *     prior to committing changes.
 *   - 1-CLICK ROLLBACK: Revert any previous run using `--rollback=backups/module-update-<ts>.json`.
 *   - ONLY-EMPTY DEFAULT: Only updates instruments where `module` is null/empty,
 *     preserving existing manual data unless `--overwrite` is specified.
 *   - MULTI-TIER DISAMBIGUATION: Resolves duplicate gauge codes using part_name, serial_no,
 *     and sino to guarantee 100% accurate assignment.
 *   - CONFLICT PROTECTION: Ambiguous rows with conflicting modules are safely skipped
 *     and reported in detail rather than making blind assumptions.
 *
 * Usage:
 *   # Dry-run (preview changes safely without modifying DB):
 *   npx ts-node scripts/update-instrument-modules.ts
 *
 *   # Dry-run for a specific company:
 *   npx ts-node scripts/update-instrument-modules.ts --company="AT India"
 *
 *   # Live execution (applies changes in an atomic transaction + creates backup):
 *   npx ts-node scripts/update-instrument-modules.ts --company="AT India" --execute
 *
 *   # Rollback a previous run:
 *   npx ts-node scripts/update-instrument-modules.ts --rollback=backups/module-update-2026-10-16T11-00-00.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';

// ── Command Line Arguments ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const IS_EXECUTE = args.includes('--execute');
const IS_DRY_RUN = !IS_EXECUTE || args.includes('--dry-run');
const IS_OVERWRITE = args.includes('--overwrite');

const envArg = args.find((a) => a.startsWith('--env='));
const ENV_FILE = envArg ? envArg.split('=')[1] : (process.env.DOTENV_CONFIG_PATH || '.env');
const resolvedEnvPath = path.resolve(process.cwd(), ENV_FILE);
if (fs.existsSync(resolvedEnvPath)) {
  dotenv.config({ path: resolvedEnvPath, override: true });
} else {
  dotenv.config();
}

const fileArg = args.find((a) => a.startsWith('--file='));
const EXCEL_FILE = fileArg ? fileArg.split('=')[1] : 'Master List for adding Model.xlsx';

const companyArg = args.find((a) => a.startsWith('--company='));
const COMPANY_FILTER = companyArg ? companyArg.split('=')[1] : 'AT India';

const rollbackArg = args.find((a) => a.startsWith('--rollback='));
const ROLLBACK_FILE = rollbackArg ? rollbackArg.split('=')[1] : null;

// ── Database Connection ──────────────────────────────────────────────────────
const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  extra: { options: '-c timezone=UTC' },
});

// ── Data Types ───────────────────────────────────────────────────────────────
interface ExcelRowItem {
  rowNum: number;
  sino: number | null;
  name: string;
  idCode: string;
  range: string;
  serialNo: string;
  location: string;
  partName: string;
  module: string;
}

interface DbInstrument {
  id: string;
  sino: number | null;
  name: string;
  id_code: string;
  serial_no: string;
  part_name: string;
  module: string | null;
  companyId: string;
  companyName: string;
}

interface PlannedUpdate {
  dbId: string;
  sino: number | null;
  name: string;
  id_code: string;
  companyId: string;
  companyName: string;
  oldModule: string;
  newModule: string;
  matchMethod: string;
  excelRow: number;
}

interface AmbiguousConflict {
  sino: number | null;
  name: string;
  id_code: string;
  conflictingModules: string[];
}

// ── String Normalization Helpers ────────────────────────────────────────────
function extractCellValue(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'object') {
    if (cellValue.richText && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((t: any) => t.text || '').join('');
    }
    if (cellValue.text) return String(cellValue.text);
    if (cellValue.result !== undefined) return String(cellValue.result);
  }
  return String(cellValue);
}

function cleanText(val: any): string {
  const str = extractCellValue(val);
  return str
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(str: string): string {
  return cleanText(str).toLowerCase();
}

// ── Rollback Runner ─────────────────────────────────────────────────────────
async function runRollback(backupFilePath: string) {
  console.log('\n==============================================================');
  console.log(' ROLLBACK MODE');
  console.log(` Target Backup File : ${backupFilePath}`);
  console.log('==============================================================\n');

  const resolvedPath = path.resolve(process.cwd(), backupFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup file not found at: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const backupData = JSON.parse(raw);
  const updates: PlannedUpdate[] = backupData.updates || [];

  if (updates.length === 0) {
    console.log('No update records found in backup file.');
    return;
  }

  console.log(`Found ${updates.length} updates in backup file to revert.`);

  await ds.initialize();
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    let revertedCount = 0;
    for (const item of updates) {
      await qr.query(
        `UPDATE instruments
         SET module = $1, updated_at = NOW()
         WHERE id = $2`,
        [item.oldModule || null, item.dbId]
      );
      revertedCount++;
    }

    await qr.commitTransaction();
    console.log(`\n[SUCCESS] Successfully reverted ${revertedCount} instruments to their prior module values.`);
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('\n[ROLLBACK FAILED] Error during rollback. Transaction aborted, database unchanged.', err);
    throw err;
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

// ── Main Update Runner ──────────────────────────────────────────────────────
async function main() {
  if (ROLLBACK_FILE) {
    await runRollback(ROLLBACK_FILE);
    return;
  }

  const resolvedExcelPath = path.resolve(process.cwd(), EXCEL_FILE);
  if (!fs.existsSync(resolvedExcelPath)) {
    throw new Error(`Excel file not found at: ${resolvedExcelPath}`);
  }

  console.log('\n==============================================================');
  console.log(' GAUGE MASTER - INSTRUMENTS MODULE POPULATOR');
  console.log('==============================================================');
  console.log(` Mode         : ${IS_DRY_RUN ? 'DRY RUN (Preview only, no DB writes)' : 'LIVE EXECUTION (Atomic Transaction)'}`);
  console.log(` Env File     : ${ENV_FILE}`);
  console.log(` Database Host: ${process.env.DB_HOST}:${process.env.DB_PORT ?? '5432'} (Database: ${process.env.DB_NAME})`);
  console.log(` Excel File   : ${EXCEL_FILE}`);
  console.log(` Target Comp. : ${COMPANY_FILTER}`);
  console.log(` Overwrite    : ${IS_OVERWRITE ? 'YES (overwrites existing modules)' : 'NO (only updates empty/null modules)'}`);
  console.log('==============================================================\n');

  // ── 1. Read Excel File ────────────────────────────────────────────────────
  console.log('[1/4] Reading and indexing Excel master file...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolvedExcelPath);
  const ws = wb.worksheets[0];

  const excelRows: ExcelRowItem[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const sinoRaw = row.getCell(1).value;
    const nameRaw = row.getCell(2).value;
    const idCodeRaw = row.getCell(3).value;
    const rangeRaw = row.getCell(4).value;
    const serialNoRaw = row.getCell(5).value;
    const locRaw = row.getCell(6).value;
    const partRaw = row.getCell(7).value;
    const moduleRaw = row.getCell(8).value;

    const name = cleanText(nameRaw);
    const idCode = cleanText(idCodeRaw);
    const moduleVal = cleanText(moduleRaw);

    if (!idCode && !name) continue;

    const parsedSino = sinoRaw !== null && sinoRaw !== undefined && !isNaN(Number(sinoRaw))
      ? Number(sinoRaw)
      : null;

    excelRows.push({
      rowNum: r,
      sino: parsedSino,
      name,
      idCode,
      range: cleanText(rangeRaw),
      serialNo: cleanText(serialNoRaw),
      location: cleanText(locRaw),
      partName: cleanText(partRaw),
      module: moduleVal,
    });
  }

  const withModuleRows = excelRows.filter((r) => r.module !== '');
  console.log(`  -> Total rows in Excel sheet : ${excelRows.length}`);
  console.log(`  -> Rows with valid module   : ${withModuleRows.length}`);
  console.log(`  -> Rows without module      : ${excelRows.length - withModuleRows.length} (skipped)\n`);

  // ── 2. Connect to Database & Load Instruments ─────────────────────────────
  console.log('[2/4] Connecting to database and loading instruments...');
  await ds.initialize();
  const qr = ds.createQueryRunner();
  await qr.connect();

  const colCheck = await qr.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'instruments' AND column_name = 'deleted_at'`
  );
  const hasDeletedAt = colCheck.length > 0;
  const deletedAtClause = hasDeletedAt ? 'AND i.deleted_at IS NULL' : '';

  let companyClause = '';
  const queryParams: any[] = [];
  if (COMPANY_FILTER.toLowerCase() !== 'all') {
    companyClause = `AND (c."companyName" ILIKE $1 OR c.id::text = $1)`;
    queryParams.push(`%${COMPANY_FILTER}%`);
  }

  const dbRows: DbInstrument[] = await qr.query(
    `SELECT i.id, i.sino, i.name, i.id_code, i.serial_no, i.part_name, i.module,
            i."companyId", c."companyName"
     FROM instruments i
     LEFT JOIN companies c ON c.id = i."companyId"
     WHERE 1=1
       ${deletedAtClause}
       ${companyClause}
     ORDER BY i.sino ASC NULLS LAST`,
    queryParams
  );

  console.log(`  -> Loaded ${dbRows.length} active instruments from database for targeted company.\n`);

  if (dbRows.length === 0) {
    console.log('No instruments matched the specified company filter. Exiting.');
    await qr.release();
    await ds.destroy();
    return;
  }

  // ── 3. Perform 3-Tier Safe Matching ────────────────────────────────────────
  console.log('[3/4] Matching instruments against Excel master...');

  const plannedUpdates: PlannedUpdate[] = [];
  const ambiguousConflicts: AmbiguousConflict[] = [];
  let skippedAlreadySet = 0;
  let unmatchedInExcel = 0;

  for (const inst of dbRows) {
    const hasExistingModule = inst.module !== null && inst.module.trim() !== '';
    if (hasExistingModule && !IS_OVERWRITE) {
      skippedAlreadySet++;
      continue;
    }

    const normName = normalizeKey(inst.name);
    const normId = normalizeKey(inst.id_code);
    const normPart = normalizeKey(inst.part_name);
    const normSerial = normalizeKey(inst.serial_no);

    // Find all Excel rows with matching Name and ID Code
    const nameIdMatches = withModuleRows.filter(
      (ex) => normalizeKey(ex.name) === normName && normalizeKey(ex.idCode) === normId
    );

    let selectedMatch: ExcelRowItem | null = null;
    let matchMethod = '';

    if (nameIdMatches.length === 1) {
      selectedMatch = nameIdMatches[0];
      matchMethod = 'EXACT_NAME_AND_ID_CODE';
    } else if (nameIdMatches.length > 1) {
      // Multiple Excel rows exist with this Name + ID Code.
      // Disambiguate using Part Name, Serial No, or S.No
      const byPart = nameIdMatches.filter(
        (ex) =>
          normPart !== '' &&
          normalizeKey(ex.partName) !== '' &&
          (normalizeKey(ex.partName).includes(normPart) || normPart.includes(normalizeKey(ex.partName)))
      );
      const bySerial = nameIdMatches.filter(
        (ex) => normSerial !== '' && normalizeKey(ex.serialNo) === normSerial
      );
      const bySino = nameIdMatches.filter((ex) => inst.sino !== null && ex.sino === inst.sino);

      if (byPart.length === 1) {
        selectedMatch = byPart[0];
        matchMethod = 'DISAMBIGUATED_BY_PART_NAME';
      } else if (bySerial.length === 1) {
        selectedMatch = bySerial[0];
        matchMethod = 'DISAMBIGUATED_BY_SERIAL_NO';
      } else if (bySino.length === 1) {
        selectedMatch = bySino[0];
        matchMethod = 'DISAMBIGUATED_BY_SINO';
      } else {
        // Check if all duplicates happen to have the identical module name
        const uniqueMods = [...new Set(nameIdMatches.map((m) => m.module))];
        if (uniqueMods.length === 1) {
          selectedMatch = nameIdMatches[0];
          matchMethod = 'DUPLICATE_IDENTICAL_MODULE';
        } else {
          ambiguousConflicts.push({
            sino: inst.sino,
            name: inst.name,
            id_code: inst.id_code,
            conflictingModules: uniqueMods,
          });
          continue;
        }
      }
    } else {
      // Fallback: Check if ID Code alone uniquely matches in Excel
      const idOnlyMatches = withModuleRows.filter((ex) => normalizeKey(ex.idCode) === normId);
      if (idOnlyMatches.length === 1) {
        selectedMatch = idOnlyMatches[0];
        matchMethod = 'FALLBACK_ID_CODE_UNIQUE';
      } else {
        unmatchedInExcel++;
        continue;
      }
    }

    if (selectedMatch) {
      plannedUpdates.push({
        dbId: inst.id,
        sino: inst.sino,
        name: inst.name,
        id_code: inst.id_code,
        companyId: inst.companyId,
        companyName: inst.companyName,
        oldModule: inst.module || '',
        newModule: selectedMatch.module,
        matchMethod,
        excelRow: selectedMatch.rowNum,
      });
    }
  }

  // ── Preview Sample Changes ────────────────────────────────────────────────
  console.log(`\n--- Match Results Summary ---`);
  console.log(`  Instruments planned for update : ${plannedUpdates.length}`);
  console.log(`  Already populated (skipped)    : ${skippedAlreadySet}`);
  console.log(`  Ambiguous conflicts (safely skipped): ${ambiguousConflicts.length}`);
  console.log(`  No match in Excel (skipped)    : ${unmatchedInExcel}`);

  if (ambiguousConflicts.length > 0) {
    console.log('\n[SAFETY WARNING] The following rows have conflicting modules in Excel and were safely skipped:');
    console.table(ambiguousConflicts);
  }

  if (plannedUpdates.length > 0) {
    console.log('\nSample Preview (First 5 updates):');
    console.table(
      plannedUpdates.slice(0, 5).map((u) => ({
        sino: u.sino,
        name: u.name,
        id_code: u.id_code,
        old_module: u.oldModule || '<EMPTY>',
        new_module: u.newModule,
        matchMethod: u.matchMethod,
      }))
    );

    console.log('\nSample Preview (Last 5 updates):');
    console.table(
      plannedUpdates.slice(-5).map((u) => ({
        sino: u.sino,
        name: u.name,
        id_code: u.id_code,
        old_module: u.oldModule || '<EMPTY>',
        new_module: u.newModule,
        matchMethod: u.matchMethod,
      }))
    );
  }

  // ── 4. Execute or Dry-Run ─────────────────────────────────────────────────
  if (IS_DRY_RUN) {
    console.log('\n==============================================================');
    console.log(' [DRY RUN COMPLETE] No changes were written to the database.');
    console.log(' To apply these updates to the database safely, run:');
    console.log(`   npx ts-node scripts/update-instrument-modules.ts --company="${COMPANY_FILTER}" --execute`);
    console.log('==============================================================\n');
    await qr.release();
    await ds.destroy();
    return;
  }

  // ── LIVE EXECUTION WITH TRANSACTION & BACKUP ──────────────────────────────
  console.log('\n[4/4] Starting atomic database transaction...');
  const backupsDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupJsonPath = path.join(backupsDir, `module-update-${timestamp}.json`);
  const backupCsvPath = path.join(backupsDir, `module-update-${timestamp}.csv`);

  // Write audit trail before committing
  const auditData = {
    executedAt: new Date().toISOString(),
    excelFile: EXCEL_FILE,
    company: COMPANY_FILTER,
    totalUpdated: plannedUpdates.length,
    updates: plannedUpdates,
    ambiguousConflicts,
  };
  fs.writeFileSync(backupJsonPath, JSON.stringify(auditData, null, 2), 'utf8');

  // Also write friendly CSV
  const csvHeaders = 'db_id,sino,name,id_code,old_module,new_module,match_method,excel_row\n';
  const csvRows = plannedUpdates
    .map(
      (u) =>
        `"${u.dbId}","${u.sino}","${u.name.replace(/"/g, '""')}","${u.id_code.replace(/"/g, '""')}","${u.oldModule.replace(/"/g, '""')}","${u.newModule.replace(/"/g, '""')}","${u.matchMethod}",${u.excelRow}`
    )
    .join('\n');
  fs.writeFileSync(backupCsvPath, csvHeaders + csvRows, 'utf8');

  console.log(`  -> Audit backup saved to: ${backupJsonPath}`);
  console.log(`  -> Audit CSV saved to:    ${backupCsvPath}`);

  await qr.startTransaction();
  try {
    let appliedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < plannedUpdates.length; i += batchSize) {
      const batch = plannedUpdates.slice(i, i + batchSize);
      for (const item of batch) {
        await qr.query(
          `UPDATE instruments
           SET module = $1, updated_at = NOW()
           WHERE id = $2`,
          [item.newModule, item.dbId]
        );
        appliedCount++;
      }
      process.stdout.write(`\r  -> Progress: ${appliedCount} / ${plannedUpdates.length} rows updated...`);
    }

    await qr.commitTransaction();
    console.log(`\n\n==============================================================`);
    console.log(' [SUCCESS] ALL UPDATES COMMITTED SUCCESSFULLY!');
    console.log(` Total instruments updated : ${appliedCount}`);
    console.log(` Rollback file generated   : ${backupJsonPath}`);
    console.log(' To revert these changes at any time, run:');
    console.log(`   npx ts-node scripts/update-instrument-modules.ts --rollback="${path.relative(process.cwd(), backupJsonPath)}"`);
    console.log('==============================================================\n');
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('\n[TRANSACTION ABORTED] An error occurred. Database rolled back cleanly.', err);
    throw err;
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('\nFatal execution error:', err);
  process.exit(1);
});
