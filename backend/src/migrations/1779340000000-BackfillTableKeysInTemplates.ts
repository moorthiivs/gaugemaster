import { MigrationInterface, QueryRunner } from "typeorm";

function slugifyTableKey(title: string): string {
  if (!title) return 'table';
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^-+|-+$/g, '') || 'table'
  );
}

function ensureTableKeys(blocks: any[]): { blocks: any[]; changed: boolean } {
  if (!Array.isArray(blocks) || blocks.length === 0) return { blocks, changed: false };
  let changed = false;
  const usedKeys = new Set<string>();

  const assignKey = (table: any, defaultPrefix: string) => {
    if (!table || typeof table !== 'object') return;
    const existingKey = table.tableKey;
    let key = existingKey || slugifyTableKey(table.title || defaultPrefix);
    if (!key || key === 'table') {
      key = defaultPrefix;
    }
    let uniqueKey = key;
    let counter = 1;
    while (usedKeys.has(uniqueKey)) {
      uniqueKey = `${key}_${counter++}`;
    }
    usedKeys.add(uniqueKey);
    if (table.tableKey !== uniqueKey) {
      table.tableKey = uniqueKey;
      changed = true;
    }
  };

  blocks.forEach((block, idx) => {
    if (!block) return;
    if (block.type === 'table_grid') {
      assignKey(block, `table_${idx + 1}`);
    } else if (block.type === 'split_row' && Array.isArray(block.children)) {
      block.children.forEach((child: any, cIdx: number) => {
        if (child && child.type === 'table_grid') {
          assignKey(child, `table_${idx + 1}_${cIdx + 1}`);
        }
      });
    }
  });

  return { blocks, changed };
}

export class BackfillTableKeysInTemplates1779340000000 implements MigrationInterface {
    name = 'BackfillTableKeysInTemplates1779340000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Backfill layout_blocks in calibration_templates
        const hasTemplatesTable = await queryRunner.hasTable('calibration_templates');
        if (hasTemplatesTable) {
            const templates = await queryRunner.query(
                `SELECT id, layout_blocks FROM "calibration_templates" WHERE layout_blocks IS NOT NULL;`
            );

            for (const row of templates) {
                let blocks = row.layout_blocks;
                if (typeof blocks === 'string') {
                    try {
                        blocks = JSON.parse(blocks);
                    } catch {
                        continue;
                    }
                }

                if (Array.isArray(blocks) && blocks.length > 0) {
                    const { blocks: updatedBlocks, changed } = ensureTableKeys(blocks);
                    if (changed) {
                        await queryRunner.query(
                            `UPDATE "calibration_templates" SET layout_blocks = $1 WHERE id = $2;`,
                            [JSON.stringify(updatedBlocks), row.id]
                        );
                    }
                }
            }
        }

        // 2. Backfill layout_blocks in calibrations (if any existing canvas calibrations exist)
        const hasCalibrationsTable = await queryRunner.hasTable('calibrations');
        if (hasCalibrationsTable) {
            const calibrations = await queryRunner.query(
                `SELECT id, layout_blocks FROM "calibrations" WHERE layout_blocks IS NOT NULL;`
            );

            for (const row of calibrations) {
                let blocks = row.layout_blocks;
                if (typeof blocks === 'string') {
                    try {
                        blocks = JSON.parse(blocks);
                    } catch {
                        continue;
                    }
                }

                if (Array.isArray(blocks) && blocks.length > 0) {
                    const { blocks: updatedBlocks, changed } = ensureTableKeys(blocks);
                    if (changed) {
                        await queryRunner.query(
                            `UPDATE "calibrations" SET layout_blocks = $1 WHERE id = $2;`,
                            [JSON.stringify(updatedBlocks), row.id]
                        );
                    }
                }
            }
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Non-destructive: tableKey values enrich the canvas schema without removing or altering measurement data.
        // Reverting tableKey assignments would break cross-table formulas configured by users.
    }
}
