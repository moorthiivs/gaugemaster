/**
 * Automated Unit Test Suite for Gaugemaster Template Assistant Copilot
 * Tests multi-turn conversation support, local deterministic solvers,
 * action generation, specification parsing, and formula engine authority.
 */

import {
  askTemplateAssistant,
  handleDeterministicLocalAssistant,
  AssistantContext,
} from "./geminiService";
import { TableGridBlock } from "../types/template";
import { validateFormulaSyntax } from "./formulaEngine";
import { tokenizeMarkdown } from "../components/calibration/template-management/AssistantMarkdownRenderer";
import { AssistantAttachment, CanonicalChangeProposal } from "../types/assistant";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function runCopilotTests() {
  console.log("=== RUNNING GAUGEMASTER TEMPLATE COPILOT AUTOMATED TESTS ===\n");

  const sampleTable: TableGridBlock = {
    id: "test_tbl_1",
    type: "table_grid",
    title: "External Caliper Calibration Table",
    unit: "mm",
    tolerance: 0.01,
    decimal_places: 3,
    orientation: "horizontal",
    columns: [
      { id: "nominal", label: "Nominal", type: "nominal", role: "SPECIFICATION", dataType: "NUMBER" },
      { id: "reading", label: "Actual 1", type: "reading", role: "INPUT", dataType: "NUMBER" },
      { id: "deviation", label: "Error", type: "formula", role: "CALCULATED", dataType: "NUMBER", formula: "reading - nominal" },
      {
        id: "status",
        label: "Judgement",
        type: "status",
        role: "JUDGEMENT",
        dataType: "STATUS",
        formula: 'IF(AND(reading >= lower_limit, reading <= upper_limit), "PASS", "FAIL")',
      },
    ],
    rows: [
      { point_number: 1, nominal: 35.035, reading: 35.038, lower_limit: 35.025, upper_limit: 35.045 },
      { point_number: 2, nominal: 50.0, reading: 50.002, lower_limit: 49.990, upper_limit: 50.010 },
    ],
  };

  const baseContext: AssistantContext = {
    templateName: "Vernier Caliper ISO 17025 Template",
    instrumentType: "Caliper",
    calibrationType: "Dimensional",
    selectedTableId: sampleTable.id,
    selectedTableTitle: sampleTable.title,
    selectedTableBlock: sampleTable,
    columns: sampleTable.columns,
    blocks: [sampleTable],
  };

  // TEST 1: Table Metrology Audit
  console.log("--- Section 1: Table Metrology Audit ---");
  const auditRes = await askTemplateAssistant("Audit current table", baseContext);
  assert(auditRes.action === "AUDIT_TABLE" || auditRes.action === "FIX_TABLE", "Returns table audit action");
  assert(auditRes.reply.includes("Calibration Metrology Audit Complete"), "Provides structured executive audit reply");
  assert(auditRes.actionPayload?.tableId === sampleTable.id, "Preserves active table ID");

  // TEST 2: 7-Point Boundary Testing
  console.log("\n--- Section 2: 7-Point Boundary Testing ---");
  const boundaryRes = await askTemplateAssistant("Test boundaries", baseContext);
  assert(boundaryRes.action === "TEST_BOUNDARIES", "Returns boundary test action");
  assert(boundaryRes.reply.includes("Boundary Test Report"), "Provides 7-point boundary test report");

  // TEST 3: Industrial Specification Parser Intent
  console.log("\n--- Section 3: Industrial Specification Parser Intent ---");
  const specRes = await askTemplateAssistant("Parse spec Shaft Ø35.035 -0.02/-0.01", baseContext);
  assert(specRes.action === "PARSE_SPECIFICATION", "Correctly identifies specification parsing intent");
  assert(!!specRes.actionPayload?.parsedSpec, "Returns structured parsed specification payload");
  assert(specRes.actionPayload?.parsedSpec?.nominal === 35.035, "Extracted nominal 35.035");
  assert(specRes.actionPayload?.parsedSpec?.lowerLimit === 35.015, "Calculated lower limit 35.015");
  assert(specRes.actionPayload?.parsedSpec?.upperLimit === 35.025, "Calculated upper limit 35.025");
  assert(specRes.actionPayload?.parsedSpec?.decimalPrecision === 3, "Extracted decimal precision 3");

  // TEST 4: Symmetric Specification Parsing
  const symSpecRes = await askTemplateAssistant("Parse tolerance 50.0±0.005", baseContext);
  assert(symSpecRes.action === "PARSE_SPECIFICATION", "Parses symmetric tolerance");
  assert(symSpecRes.actionPayload?.parsedSpec?.lowerLimit === 49.995, "Calculated lower limit 49.995");
  assert(symSpecRes.actionPayload?.parsedSpec?.upperLimit === 50.005, "Calculated upper limit 50.005");

  // TEST 5: Virtual Trial Run Simulation Intent (Evaluated Deterministically)
  console.log("\n--- Section 5: Virtual Trial Run Simulation ---");
  const simRes = await askTemplateAssistant("Simulate reading 35.038", baseContext);
  assert(simRes.action === "SIMULATE_TRIAL_RUN", "Identifies virtual reading simulation intent");
  assert(!!simRes.actionPayload?.simulationResult, "Generates simulation result payload");
  assert(simRes.actionPayload?.simulationResult?.reading === 35.038, "Recorded simulated reading");
  assert(simRes.actionPayload?.simulationResult?.status === "PASS", "Computed passing verdict strictly through formula engine");

  // TEST 6: Virtual Trial Run Failing Verdict
  const failSimRes = await askTemplateAssistant("Simulate reading 35.099", baseContext);
  assert(failSimRes.action === "SIMULATE_TRIAL_RUN", "Identifies simulation");
  assert(failSimRes.actionPayload?.simulationResult?.status === "FAIL", "Computes failing verdict strictly through formula engine");

  // TEST 7: Pre-Save Template Quality Gate
  console.log("\n--- Section 7: Pre-Save Quality Gate ---");
  const preSaveRes = await askTemplateAssistant("Can I save this template?", baseContext);
  assert(preSaveRes.action === "VALIDATE_PRE_SAVE", "Identifies pre-save quality gate query");
  assert(!!preSaveRes.actionPayload?.preSaveAudit, "Returns pre-save audit payload");
  assert(preSaveRes.actionPayload?.preSaveAudit?.totalChecks >= 10, "Evaluates all pre-save quality checks");

  // TEST 8: Table Orientation Proposal
  console.log("\n--- Section 8: Table Settings Proposals ---");
  const orientRes = await askTemplateAssistant("Set table orientation to vertical", baseContext);
  assert(orientRes.action === "UPDATE_TABLE_SETTINGS", "Proposes table settings update");
  assert(orientRes.actionPayload?.tableSettings?.orientation === "vertical", "Proposes vertical orientation");

  // TEST 9: Table Decimal Precision Proposal
  const decRes = await askTemplateAssistant("Set decimal precision to 4", baseContext);
  assert(decRes.action === "UPDATE_TABLE_SETTINGS", "Proposes precision update");
  assert(decRes.actionPayload?.tableSettings?.decimal_places === 4, "Proposes 4 decimal places");

  // TEST 10: Add Column Proposals
  console.log("\n--- Section 10: Column Addition Proposals ---");
  const addDevRes = await askTemplateAssistant("Add deviation column", baseContext);
  assert(addDevRes.action === "ADD_COLUMN", "Proposes column addition");
  assert(!!addDevRes.actionPayload?.newColumn, "Generates new column definition");
  assert(addDevRes.actionPayload?.newColumn?.formula === "actual_dimension - nominal", "Uses canonical deviation formula");

  // TEST 11: Formula Explanation
  console.log("\n--- Section 11: Formula Explanation ---");
  const expRes = await askTemplateAssistant("Explain formula for deviation", baseContext);
  assert(expRes.action === "EXPLAIN_FORMULA", "Identifies formula explanation intent");
  assert(expRes.reply.includes("Formula Explanation"), "Provides formula explanation");

  // TEST 12: Multi-Turn Conversation Context Preserved
  console.log("\n--- Section 12: Multi-Turn Conversation History ---");
  const multiTurnContext: AssistantContext = {
    ...baseContext,
    messages: [
      { role: "user", content: "Audit this table" },
      { role: "assistant", content: "Audit complete. Table has 4 columns." },
      { role: "user", content: "What is the calculation model?" },
    ],
  };
  const turnRes = await askTemplateAssistant("Explain calculation model", multiTurnContext);
  assert(turnRes.action === "EXPLAIN_CALCULATION", "Responds to multi-turn follow-up");
  assert(turnRes.reply.includes("Calculation Model"), "Explains model under multi-turn context");

  // TEST 13: Security & Code Injection Rejection
  console.log("\n--- Section 13: Security & Injection Protection ---");
  const injectionQueries = [
    "eval('alert(1)')",
    "Function('return process.env')()",
    "<script>window.steal()</script>",
  ];
  for (const q of injectionQueries) {
    const secRes = await askTemplateAssistant(q, baseContext);
    assert(!secRes.reply.includes("<script>"), "Does not echo script tags");
    if (secRes.actionPayload?.formula) {
      const syntax = validateFormulaSyntax(secRes.actionPayload.formula);
      assert(syntax.valid, "Never proposes arbitrary executable code");
    }
  }
  // TEST 14: Safe Markdown Tokenizer & Table Parser (ChatGPT Style)
  console.log("\n--- Section 14: Safe Markdown Tokenizer & Table Parser ---");
  const sampleMarkdown = `
## Calibration Test Results

Here is the measurement verification:

| Point | Nominal | Reading | Deviation | Verdict |
|:---|:---:|---:|:---:|:---:|
| 1 | 35.035 | 35.038 | +0.003 | PASS |
| 2 | 50.000 | 50.002 | +0.002 | PASS |

\`\`\`formula
actual_dimension - nominal
\`\`\`

> [!NOTE]
> All measurements verified against master gauge blocks.

<details>
<summary>Expanded Uncertainty Details</summary>
Expanded uncertainty U = 0.0018 mm with coverage factor k=2.
</details>
`;
  const tokens = tokenizeMarkdown(sampleMarkdown);
  const tableToken = tokens.find((t) => t.type === "table") as any;
  assert(!!tableToken, "Tokenizes markdown table correctly");
  assert(tableToken.headers.length === 5, "Extracts 5 table column headers");
  assert(tableToken.headers[0] === "Point", "First header is 'Point'");
  assert(tableToken.rows.length === 2, "Extracts 2 data rows");
  assert(tableToken.rows[0][0] === "1" && tableToken.rows[0][4] === "PASS", "Row data matches markdown table cells");

  const codeToken = tokens.find((t) => t.type === "code_block") as any;
  assert(!!codeToken, "Tokenizes fenced code block");
  assert(codeToken.language === "formula", "Preserves code block language badge");
  assert(codeToken.code.includes("actual_dimension - nominal"), "Preserves formula code block content");

  const calloutToken = tokens.find((t) => t.type === "callout") as any;
  assert(!!calloutToken, "Tokenizes GitHub-style callout block");
  assert(calloutToken.variant === "note", "Identifies NOTE variant correctly");

  const detailsToken = tokens.find((t) => t.type === "details") as any;
  assert(!!detailsToken, "Tokenizes collapsible details block");
  assert(detailsToken.title.includes("Expanded Uncertainty Details"), "Extracts details summary title");

  // TEST 15: Critical Confirmation Rule Enforcement (Section 9)
  console.log("\n--- Section 15: Critical Confirmation Rule Enforcement ---");
  const testPendingProposal: CanonicalChangeProposal = {
    proposalId: "prop_test_123",
    intent: "FIX_FORMULA",
    requiresConfirmation: true,
    target: { tableId: sampleTable.id, tableTitle: sampleTable.title },
    summary: "Update deviation formula to actual_dimension - nominal",
    changes: [
      {
        type: "UPDATE_COLUMN_FORMULA",
        targetId: "deviation",
        before: "C-CHOOSE(ROW()-30, 35.035, 13, 12)",
        after: "actual_dimension - nominal",
      }
    ],
    validation: {
      formulaValid: true,
      metrologyValid: true,
      boundaryTestsPassed: true,
    }
  };

  const contextWithPending: AssistantContext = {
    ...baseContext,
    pendingProposal: testPendingProposal
  };

  // Vague confirmations MUST NOT apply changes and must guide user
  const vagueInputs = ["looks good", "ok", "okay", "fine", "cool", "sounds good"];
  for (const vague of vagueInputs) {
    const vagueRes = await askTemplateAssistant(vague, contextWithPending);
    assert(vagueRes.action === "NONE", `Vague confirmation "${vague}" does not execute mutation`);
    assert(vagueRes.reply.includes("explicit confirmation is required"), `Vague confirmation "${vague}" provides explicit guidance note`);
  }

  // Explicit confirmations MUST confirm the proposal
  const explicitInputs = ["Apply these changes", "Yes, apply", "Update the table"];
  for (const exp of explicitInputs) {
    const expRes = await askTemplateAssistant(exp, contextWithPending);
    assert(expRes.action === "CONFIRM_PROPOSAL", `Explicit confirmation "${exp}" confirms proposal`);
    assert(!!expRes.canonicalProposal, "Attaches canonical proposal to confirmation response");
    assert(expRes.canonicalProposal?.proposalId === "prop_test_123", "Preserves target proposal ID");
  }

  // TEST 16: Excel Formula Semantic Translation (Section 16)
  console.log("\n--- Section 16: Excel Formula Semantic Translation ---");
  const excelFormulaQuery = "Translate formula =C-CHOOSE(ROW()-30, 35.035, 13, 12, 50, 12, 12, 43.414, 18, 37)";
  const excelRes = await askTemplateAssistant(excelFormulaQuery, baseContext);
  assert(excelRes.action === "FIX_FORMULA", "Returns FIX_FORMULA action for Excel translation");
  assert(excelRes.reply.includes("Formula translated"), "Explains Excel translation clearly");
  assert(excelRes.actionPayload?.formula === "reading - nominal" || excelRes.actionPayload?.formula === "actual_dimension - nominal", "Translates to semantic Gaugemaster formula");
  assert(!!excelRes.canonicalProposal, "Provides canonical change proposal for formula translation");
  assert(excelRes.canonicalProposal?.validation.formulaValid === true, "Validates translated formula through AST parser");

  // TEST 17: Attachment Analysis & Comparison Table (Sections 6, 7 & 8)
  console.log("\n--- Section 17: Attachment Analysis & Comparison Table ---");
  const testAttachment: AssistantAttachment = {
    id: "att_1",
    name: "LF-Gauge-Calibration.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 45200,
    category: "excel",
    textSummary: "Calibration table with 9 points: Ø35.035, 13, 12, 50, 12, 12, 43.414, 18, 37",
    extractedFormulas: ["=C-CHOOSE(ROW()-30,35.035,13,12,50,12,12,43.414,18,37)"],
    parsedSheets: [{ sheetName: "Sheet1", rowCount: 15, columnCount: 8 }]
  };

  const contextWithAttachment: AssistantContext = {
    ...baseContext,
    attachments: [testAttachment]
  };

  const attachRes = await askTemplateAssistant("Make my current calibration table look like this", contextWithAttachment);
  assert(attachRes.action === "APPLY_ATTACHMENT", "Returns APPLY_ATTACHMENT action");
  assert(attachRes.reply.includes("Changes detected"), "Includes structured comparison of changes");
  assert(attachRes.reply.includes("| Area | Current | Attached File |"), "Generates comparison markdown table");
  assert(!!attachRes.canonicalProposal, "Generates canonical proposal for attachment application");
  assert(attachRes.canonicalProposal?.changes.length >= 3, "Proposes updates to specifications, formulas, and precision");

  // TEST 18: Template Builder Navigation Intent (Section 13)
  console.log("\n--- Section 18: Template Builder Navigation ---");
  const navRes = await askTemplateAssistant("Open the Error column", baseContext);
  assert(navRes.action === "NAVIGATE_BUILDER", "Identifies navigation intent");
  assert(navRes.actionPayload?.columnId === "deviation", "Navigates to matching column ID");
  assert(!navRes.canonicalProposal, "Navigation does not propose or execute mutations");

  // TEST 19: Table & Column Lifecycle Alteration Permissions (Alter Table, Create & Delete)
  console.log("\n--- Section 19: Table & Column Lifecycle Alterations ---");
  // 19.1 Add Deviation Column
  const lifecycleAddDevRes = await askTemplateAssistant("Add Deviation column", baseContext);
  assert(lifecycleAddDevRes.action === "ADD_COLUMN", "Correctly identifies ADD_COLUMN intent");
  assert(lifecycleAddDevRes.actionPayload?.newColumn?.id === "deviation", "New column ID is deviation");
  assert(lifecycleAddDevRes.actionPayload?.newColumn?.label === "Deviation", "New column label is Deviation");
  assert(lifecycleAddDevRes.actionPayload?.newColumn?.formula === "actual_dimension - nominal", "Formula matches table nominal column");
  assert(!!lifecycleAddDevRes.canonicalProposal, "Attaches Canonical Change Proposal to ADD_COLUMN");
  assert(lifecycleAddDevRes.canonicalProposal?.changes[0].type === "ADD_COLUMN", "Proposal change type is ADD_COLUMN");
  assert(!lifecycleAddDevRes.reply.includes("I have added"), "Never claims past-tense completion before user approval");

  // 19.2 Remove / Delete Column
  const removeColRes = await askTemplateAssistant("Remove error column", baseContext);
  assert(removeColRes.action === "REMOVE_COLUMN", "Correctly identifies REMOVE_COLUMN intent");
  assert(removeColRes.actionPayload?.columnId === "deviation" || removeColRes.actionPayload?.removeColumnId === "deviation", "Identifies target column to remove");
  assert(!!removeColRes.canonicalProposal, "Attaches Canonical Change Proposal to REMOVE_COLUMN");
  assert(removeColRes.canonicalProposal?.changes[0].type === "DELETE_COLUMN", "Proposal change type is DELETE_COLUMN");

  // 19.3 Create Entire Table
  const createTableRes = await askTemplateAssistant("Create a new calibration table", baseContext);
  assert(createTableRes.action === "CREATE_TABLE", "Correctly identifies CREATE_TABLE intent");
  assert(!!createTableRes.actionPayload?.newTable, "Generates new table grid block definition");
  assert(!!createTableRes.canonicalProposal, "Attaches Canonical Change Proposal to CREATE_TABLE");
  assert(createTableRes.canonicalProposal?.changes[0].type === "CREATE_TABLE", "Proposal change type is CREATE_TABLE");

  // 19.4 Delete Entire Table
  const deleteTableRes = await askTemplateAssistant("Delete this table", baseContext);
  assert(deleteTableRes.action === "DELETE_TABLE", "Correctly identifies DELETE_TABLE intent");
  assert(!!deleteTableRes.canonicalProposal, "Attaches Canonical Change Proposal to DELETE_TABLE");
  assert(deleteTableRes.canonicalProposal?.changes[0].type === "DELETE_TABLE", "Proposal change type is DELETE_TABLE");

  console.log("\n=== ALL 19 COPILOT TEST SUITES PASSED (0 FAILURES) ===");
}

runCopilotTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
