import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculatePageSlices,
  countCanvasDataRows,
  getBlocksForPage,
  paginateCanvasBlocks,
} from "./certificatePagination";

const makeVerticalTable = (id: string, title: string, rowCount: number, extraCols: any[] = []) => ({
  id,
  type: "table_grid",
  title,
  orientation: "vertical",
  columns: [
    { id: "sl_no", label: "Sl No", type: "sl_no" },
    { id: "reading", label: "Reading", type: "reading" },
    ...extraCols,
  ],
  rows: Array.from({ length: rowCount }, (_, i) => ({
    point_number: i + 1,
    reading: 62.04 + i * 0.001,
  })) as Array<{ point_number: number; reading: number; cellSpans?: Record<string, { colSpan?: number; rowSpan?: number }> }>,
});

describe("Certificate Canvas Pagination", () => {
  it("preserves all rows in later tables when the first table has fewer rows (2 + 5 regression)", () => {
    const blocks = [
      makeVerticalTable("t1", "Air Plug Gauge Measurement Results", 2),
      makeVerticalTable("t2", "Part Quality Confirmation", 5),
    ];

    assert.strictEqual(countCanvasDataRows(blocks), 7);

    const slices = paginateCanvasBlocks(blocks, false);
    assert.strictEqual(slices.length, 1);
    assert.strictEqual(slices[0].isFirst, true);
    assert.strictEqual(slices[0].isLast, true);
    assert.strictEqual(slices[0].start, 0);
    assert.strictEqual(slices[0].end, 7);

    const pageBlocks = getBlocksForPage(blocks, slices[0])!;
    assert.strictEqual(pageBlocks.length, 2);
    assert.strictEqual(pageBlocks[0].rows.length, 2);
    assert.strictEqual(pageBlocks[1].rows.length, 5);
    assert.deepStrictEqual(
      pageBlocks[1].rows.map((r: any) => r.point_number),
      [1, 2, 3, 4, 5]
    );
  });

  it("keeps all tables intact even when a diagram is present if total height fits", () => {
    const blocks = [
      makeVerticalTable("t1", "Air Plug Gauge Measurement Results", 2),
      makeVerticalTable("t2", "Part Quality Confirmation", 5),
    ];

    const slices = paginateCanvasBlocks(blocks, true);
    assert.strictEqual(slices.length, 1);
    const pageBlocks = getBlocksForPage(blocks, slices[0])!;
    assert.strictEqual(pageBlocks[0].rows.length, 2);
    assert.strictEqual(pageBlocks[1].rows.length, 5);
  });

  it("flows large multi-table templates sequentially across pages with zero lost or duplicated rows", () => {
    const blocks = [
      makeVerticalTable("t1", "Table 1", 22),
      makeVerticalTable("t2", "Table 2", 25),
    ];

    assert.strictEqual(countCanvasDataRows(blocks), 47);

    const slices = paginateCanvasBlocks(blocks, false);
    assert.ok(slices.length >= 2, `Expected >= 2 sheets, got ${slices.length}`);
    assert.strictEqual(slices[0].isFirst, true);
    assert.strictEqual(slices[slices.length - 1].isLast, true);

    const t1Collected: number[] = [];
    const t2Collected: number[] = [];

    slices.forEach((slice) => {
      const pageBlocks = getBlocksForPage(blocks, slice)!;
      for (const b of pageBlocks) {
        assert.ok(b.rows.length > 0, `Page ${slice.sheetNumber} should not emit empty table ${b.id}`);
        if (b.id === "t1") {
          t1Collected.push(...b.rows.map((r: any) => r.point_number));
        } else if (b.id === "t2") {
          t2Collected.push(...b.rows.map((r: any) => r.point_number));
        }
      }
    });

    assert.strictEqual(t1Collected.length, 22);
    assert.strictEqual(t2Collected.length, 25);
    assert.deepStrictEqual(
      t1Collected,
      Array.from({ length: 22 }, (_, i) => i + 1)
    );
    assert.deepStrictEqual(
      t2Collected,
      Array.from({ length: 25 }, (_, i) => i + 1)
    );
  });

  it("balances 30-row overflow into 2 sheets without creating an empty final sheet", () => {
    const blocks = [makeVerticalTable("t1", "Single Long Table", 30)];
    const slices = paginateCanvasBlocks(blocks, false);
    assert.strictEqual(slices.length, 2);

    const p1Blocks = getBlocksForPage(blocks, slices[0])!;
    const p2Blocks = getBlocksForPage(blocks, slices[1])!;
    assert.ok(p1Blocks[0].rows.length > 0);
    assert.ok(p2Blocks[0].rows.length > 0);
    assert.strictEqual(p1Blocks[0].rows.length + p2Blocks[0].rows.length, 30);
    assert.strictEqual(p2Blocks[0].__rowIndexOffset, p1Blocks[0].rows.length);
  });

  it("honors explicit page_break blocks cleanly", () => {
    const blocks = [
      makeVerticalTable("t1", "First Sheet Table", 2),
      { id: "pb1", type: "page_break" },
      makeVerticalTable("t2", "Second Sheet Table", 5),
    ];

    const slices = paginateCanvasBlocks(blocks, false);
    assert.strictEqual(slices.length, 2);

    const p1Blocks = getBlocksForPage(blocks, slices[0])!;
    const p2Blocks = getBlocksForPage(blocks, slices[1])!;
    assert.strictEqual(p1Blocks.length, 1);
    assert.strictEqual(p1Blocks[0].id, "t1");
    assert.strictEqual(p1Blocks[0].rows.length, 2);

    assert.strictEqual(p2Blocks.length, 1);
    assert.strictEqual(p2Blocks[0].id, "t2");
    assert.strictEqual(p2Blocks[0].rows.length, 5);
  });

  it("counts and preserves nested split_row child tables without slicing horizontal tables", () => {
    const horizontalTbl = {
      id: "h1",
      type: "table_grid",
      title: "Horizontal 15-pt Dial",
      orientation: "horizontal",
      columns: [
        { id: "sl_no", label: "Sl No", type: "sl_no" },
        { id: "nominal", label: "Nominal", type: "nominal" },
        { id: "reading", label: "Reading", type: "reading" },
      ],
      rows: Array.from({ length: 15 }, (_, i) => ({ point_number: i + 1, nominal: i, reading: i })),
    };

    const blocks = [
      {
        id: "sr1",
        type: "split_row",
        children: [
          makeVerticalTable("left", "Left Table", 2),
          makeVerticalTable("right", "Right Table", 5),
        ],
      },
      horizontalTbl,
    ];

    assert.strictEqual(countCanvasDataRows(blocks), 22);
    const slices = paginateCanvasBlocks(blocks, false);
    assert.strictEqual(slices.length, 1);
    const pBlocks = getBlocksForPage(blocks, slices[0])!;
    assert.strictEqual(pBlocks[0].children[0].rows.length, 2);
    assert.strictEqual(pBlocks[0].children[1].rows.length, 5);
    assert.strictEqual(pBlocks[1].rows.length, 15);
  });

  it("keeps rowSpan grouped together when a table splits across pages", () => {
    const tbl = makeVerticalTable("spanTbl", "Grouped Spec Table", 30);
    tbl.rows[24].cellSpans = { reading: { rowSpan: 2 } };
    const slices = paginateCanvasBlocks([tbl], false);
    assert.strictEqual(slices.length, 2);

    const p1 = getBlocksForPage([tbl], slices[0])![0];
    const p2 = getBlocksForPage([tbl], slices[1])![0];
    assert.strictEqual(p1.rows.length + p2.rows.length, 30);
    // Row index 24 has rowSpan 2 -> rows 24 and 25 must NOT be split across page boundary
    assert.notStrictEqual(p1.rows.length, 25);
  });

  it("preserves backwards compatibility for calculatePageSlices on legacy point arrays", () => {
    const single = calculatePageSlices(20, false);
    assert.strictEqual(single.length, 1);
    assert.deepStrictEqual([single[0].start, single[0].end], [0, 20]);

    const multi = calculatePageSlices(40, false);
    assert.strictEqual(multi.length, 2);
    assert.strictEqual(multi[1].end, 40);
  });
});
