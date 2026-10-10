/**
 * Script to clear default 'Standard calibration per ISO/IEC 17025' from remarks in calibration_templates.
 *
 * Usage:
 *   node src/scripts/clear-template-remarks.js
 *
 * Or pass --all flag to clear remarks for ALL templates:
 *   node src/scripts/clear-template-remarks.js --all
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function clearRemarks() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const clearAll = process.argv.includes('--all');

  try {
    await client.connect();
    console.log(`Connected to database "${process.env.DB_NAME}".`);

    let query = '';
    if (clearAll) {
      query = `UPDATE calibration_templates SET remarks = NULL;`;
      console.log('Clearing remarks for ALL templates...');
    } else {
      query = `UPDATE calibration_templates SET remarks = NULL WHERE remarks = 'Standard calibration per ISO/IEC 17025';`;
      console.log('Clearing default placeholder remarks ("Standard calibration per ISO/IEC 17025")...');
    }

    const result = await client.query(query);
    console.log(`Successfully updated ${result.rowCount} template(s).`);

    const status = await client.query(
      `SELECT count(*) as total, count(remarks) as with_remarks FROM calibration_templates;`
    );
    console.log(`Templates summary: Total = ${status.rows[0].total}, Templates with remarks = ${status.rows[0].with_remarks}`);
  } catch (err) {
    console.error('Failed to update template remarks:', err.message);
  } finally {
    await client.end();
  }
}

clearRemarks();
