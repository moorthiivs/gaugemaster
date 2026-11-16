/**
 * backfill-cal-agency.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Backfills the `agency` field inside the `reference_standards` JSONB array
 * for all existing calibration records where it is missing or empty.
 *
 * Strategy:
 *   For each calibration row that has reference_standards, iterate each entry
 *   and look up the matching instrument (master) from the `instruments` table
 *   using id_code (primary match) OR name (fallback match).
 *   If a match is found and the instrument has a non-empty agency, write it back.
 *
 * Run (from the backend/ directory):
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-cal-agency.ts
 *
 * Flags:
 *   --dry-run          Print what would change without writing to DB
 *   --company=<uuid>   Limit to a specific companyId (optional)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';

// ── Parse CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const companyArg = args.find((a) => a.startsWith('--company='));
const FILTER_COMPANY = companyArg ? companyArg.split('=')[1] : null;

// ── DB connection (mirrors ormconfig.ts) ─────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalize(s: string | undefined | null): string {
  return (s ?? '').trim().toLowerCase();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n==============================================================');
  console.log(' Backfill Cal.Agency in reference_standards');
  console.log(` Mode     : ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE (writes to DB)'}`);
  console.log(` Company  : ${FILTER_COMPANY ?? 'ALL'}`);
  console.log('==============================================================\n');

  await ds.initialize();
  const qr = ds.createQueryRunner();

  try {
    // ── 1. Load all instruments (master list) that have a non-empty agency ─
    const instruments: {
      id: string;
      id_code: string;
      name: string;
      agency: string;
      companyId: string;
    }[] = await qr.query(
      `SELECT id, id_code, name, agency, "companyId"
       FROM instruments
       WHERE agency IS NOT NULL AND TRIM(agency) <> ''`,
    );

    console.log(`Loaded ${instruments.length} instruments with a non-empty agency.\n`);

    // Build lookup maps for fast matching
    const byIdCode = new Map<string, (typeof instruments)[0]>();
    const byName   = new Map<string, (typeof instruments)[0]>();

    for (const inst of instruments) {
      if (inst.id_code) byIdCode.set(normalize(inst.id_code), inst);
      if (inst.name)    byName.set(normalize(inst.name), inst);
    }

    // ── 2. Fetch calibrations that have reference_standards ───────────────
    const companyFilter = FILTER_COMPANY
      ? `AND c."companyId" = '${FILTER_COMPANY}'`
      : '';

    const calibrations: {
      id: string;
      companyId: string;
      reference_standards: any[];
    }[] = await qr.query(
      `SELECT id, "companyId", reference_standards
       FROM calibrations c
       WHERE reference_standards IS NOT NULL
         AND jsonb_array_length(reference_standards) > 0
         ${companyFilter}
       ORDER BY created_at DESC`,
    );

    console.log(`Found ${calibrations.length} calibration(s) with reference_standards.\n`);

    let totalUpdatedCalibrations = 0;
    let totalUpdatedEntries      = 0;
    let totalSkipped             = 0;
    let totalNoMatch             = 0;

    // ── 3. Process each calibration ───────────────────────────────────────
    for (const cal of calibrations) {
      const refs: any[] = cal.reference_standards;
      let calDirty = false;

      const updatedRefs = refs.map((ref: any) => {
        // Already has a valid agency — skip
        if (ref.agency && String(ref.agency).trim() !== '') {
          totalSkipped++;
          return ref;
        }

        // Try to find the master instrument by id_code first, then by name
        const idCodeKey = normalize(ref.id) || normalize(ref.id_code) || normalize(ref.sr_no);
        const nameKey   = normalize(ref.name);

        let matched = idCodeKey ? byIdCode.get(idCodeKey) : undefined;
        if (!matched && nameKey) matched = byName.get(nameKey);

        if (!matched || !matched.agency?.trim()) {
          totalNoMatch++;
          return ref; // leave unchanged
        }

        // Found a matching master with agency
        calDirty = true;
        totalUpdatedEntries++;

        console.log(
          `  [CAL ${cal.id.slice(0, 8)}] ref "${ref.name ?? ref.id}" ` +
          `-> matched "${matched.name}" (${matched.id_code}) ` +
          `-> agency: "${matched.agency}"`,
        );

        return { ...ref, agency: matched.agency.trim() };
      });

      if (!calDirty) continue;

      totalUpdatedCalibrations++;

      if (!DRY_RUN) {
        await qr.query(
          `UPDATE calibrations SET reference_standards = $1::jsonb WHERE id = $2`,
          [JSON.stringify(updatedRefs), cal.id],
        );
      }
    }

    // ── 4. Summary ────────────────────────────────────────────────────────
    console.log('\n==============================================================');
    console.log(' Summary');
    console.log('==============================================================');
    console.log(` Calibrations updated     : ${totalUpdatedCalibrations}`);
    console.log(` Reference entries filled : ${totalUpdatedEntries}`);
    console.log(` Entries already set      : ${totalSkipped} (skipped)`);
    console.log(` Entries with no match    : ${totalNoMatch} (left as-is)`);
    if (DRY_RUN) {
      console.log('\n[DRY RUN] No changes were written to the database.');
      console.log('Remove --dry-run to apply changes.');
    } else {
      console.log('\n[DONE] All changes written to the database.');
    }
    console.log('==============================================================\n');
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
