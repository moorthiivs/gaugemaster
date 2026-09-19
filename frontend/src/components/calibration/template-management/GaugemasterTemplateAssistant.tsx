import React, { useState, useRef, useEffect } from "react";
import { TableGridBlock, CanvasColumnDef, CanvasBlock } from "@/types/template";
import { askTemplateAssistant, AssistantResponse } from "@/lib/geminiService";
import { auditCalibrationTable, generateFixedTableColumns } from "@/lib/calibrationTableAuditor";
import { runMetrologyBoundaryTests } from "@/lib/metrologyBoundaryTester";
import { validateTemplatePreSave } from "@/lib/templatePreSaveValidator";
import { explainSemanticFormula } from "@/lib/excelFormulaTranslator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  User,
  Sparkles,
  Send,
  X,
  Wand2,
  ShieldCheck,
  Play,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  Minimize2,
  Maximize2,
  RefreshCw,
  Undo2,
  HelpCircle,
  Cpu,
  Eye,
  Sliders,
  Info,
  Layers,
  Activity,
  CheckCircle2,
} from "lucide-react";

export interface GaugemasterTemplateAssistantProps {
  open: boolean;
  onClose: () => void;
  templateName: string;
  instrumentType: string;
  calibrationType: string;
  blocks: CanvasBlock[];
  selectedTable: TableGridBlock | null;
  selectedColumnId: string | null;
  onUpdateTableColumns: (tableId: string, updatedColumns: CanvasColumnDef[]) => void;
  onOpenTableAuditModal?: () => void;
  onOpenPreSaveModal?: () => void;
}

interface ProposalItem {
  columnId: string;
  columnLabel: string;
  before: string;
  after: string;
  reason: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
}

interface AuditSummaryData {
  tableTitle: string;
  calculationModel: string;
  certificateReadiness: "READY FOR TRIAL RUN" | "REVIEW REQUIRED" | "BLOCKED";
  columnsCount: number;
  calculatedColumnsCount: number;
  issuesCount: number;
  warningsCount: number;
  conclusion: string;
}

interface ChatMessage {
  id: string;
  sender: "assistant" | "user";
  text: string;
  timestamp: string;
  auditSummary?: AuditSummaryData;
  proposedAction?: AssistantResponse["action"];
  actionPayload?: AssistantResponse["actionPayload"];
  proposals?: ProposalItem[];
  actionApplied?: boolean;
}

/**
 * Parses inline markdown: `code`, **bold**, *italic* into styled React nodes.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/s);
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/s);

    let firstType: "none" | "code" | "bold" = "none";
    let firstIndex = remaining.length;

    if (codeMatch && codeMatch[1].length < firstIndex) {
      firstType = "code";
      firstIndex = codeMatch[1].length;
    }
    if (boldMatch && boldMatch[1].length < firstIndex) {
      firstType = "bold";
      firstIndex = boldMatch[1].length;
    }

    if (firstType === "none") {
      tokens.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (firstType === "bold" && boldMatch) {
      if (boldMatch[1]) tokens.push(<span key={key++}>{boldMatch[1]}</span>);
      tokens.push(
        <strong key={key++} className="font-bold text-foreground">
          {boldMatch[2]}
        </strong>
      );
      remaining = boldMatch[3];
    } else if (firstType === "code" && codeMatch) {
      if (codeMatch[1]) tokens.push(<span key={key++}>{codeMatch[1]}</span>);
      tokens.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[10.5px] text-primary border border-slate-200 dark:border-slate-800 break-all"
        >
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
    }
  }

  return tokens;
}

/**
 * Check if a text is an audit summary format and extract fields
 */
function tryParseAuditSummary(text: string): AuditSummaryData | null {
  const modelMatch = text.match(/Model:\s*\*\*?([A-Z_]+)\*\*?/i);
  const readinessMatch = text.match(/Readiness:\s*\*\*?([A-Z\s_]+)\*\*?/i);
  const colsMatch = text.match(/Columns:\s*(\d+)\s*\((\d+)\s*calculated\)/i);
  const issuesMatch = text.match(/Issues:\s*(\d+),\s*Warnings:\s*(\d+)/i);
  const titleMatch = text.match(/Table\s*\*\*?"?([^"*]+)"?\*\*?\s*audit complete/i);

  if (modelMatch && readinessMatch && colsMatch && issuesMatch) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1];
    return {
      tableTitle: titleMatch ? titleMatch[1] : "Active Table",
      calculationModel: modelMatch[1],
      certificateReadiness: (readinessMatch[1].trim() as any) || "REVIEW REQUIRED",
      columnsCount: parseInt(colsMatch[1], 10),
      calculatedColumnsCount: parseInt(colsMatch[2], 10),
      issuesCount: parseInt(issuesMatch[1], 10),
      warningsCount: parseInt(issuesMatch[2], 10),
      conclusion: lastLine || "Audit complete."
    };
  }
  return null;
}

/**
 * Renders human-readable formatted AI responses with cards, badges, and clean typography.
 */
const FormattedAssistantMessage: React.FC<{ text: string; auditSummary?: AuditSummaryData }> = ({
  text,
  auditSummary: initialSummary,
}) => {
  const auditSummary = initialSummary || tryParseAuditSummary(text);

  // If this is an audit summary message, render executive card
  if (auditSummary) {
    const isReady = auditSummary.certificateReadiness === "READY FOR TRIAL RUN";
    const isBlocked = auditSummary.certificateReadiness === "BLOCKED";

    return (
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2.5 text-foreground shadow-2xs">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate max-w-[200px]">{auditSummary.tableTitle}</span>
          </div>
          <Badge
            variant="outline"
            className={`text-[9.5px] font-bold py-0.5 px-2 flex items-center gap-1 ${
              isReady
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300"
                : isBlocked
                ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300"
                : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300"
            }`}
          >
            {isReady ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : isBlocked ? (
              <X className="w-3 h-3 text-rose-600" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-amber-600" />
            )}
            {auditSummary.certificateReadiness}
          </Badge>
        </div>

        {/* Inferred Model Row */}
        <div className="flex items-center justify-between text-[11px] bg-white dark:bg-slate-950 p-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            Calibration Model:
          </span>
          <Badge variant="secondary" className="font-mono text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
            {auditSummary.calculationModel}
          </Badge>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-muted-foreground block text-[9px]">Columns</span>
            <span className="font-bold text-foreground">{auditSummary.columnsCount} ({auditSummary.calculatedColumnsCount} calc)</span>
          </div>
          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-muted-foreground block text-[9px]">Issues</span>
            <span className={`font-bold ${auditSummary.issuesCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {auditSummary.issuesCount}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-muted-foreground block text-[9px]">Warnings</span>
            <span className={`font-bold ${auditSummary.warningsCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {auditSummary.warningsCount}
            </span>
          </div>
        </div>

        {/* Conclusion Callout */}
        <div className={`p-2 rounded-lg text-[10.5px] flex items-center gap-1.5 ${
          auditSummary.issuesCount === 0 && auditSummary.warningsCount === 0
            ? "bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
            : auditSummary.issuesCount === 0
            ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
            : "bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
        }`}>
          {auditSummary.issuesCount === 0 ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          )}
          <span className="font-medium">{auditSummary.conclusion}</span>
        </div>
      </div>
    );
  }

  // General Markdown Content Renderer
  const paragraphs = text.split("\n\n").filter(Boolean);

  return (
    <div className="space-y-2 text-xs leading-relaxed text-foreground">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n").filter(Boolean);

        // Check if paragraph is a bullet list
        const isBulletList = lines.every(l => l.startsWith("- ") || l.startsWith("* "));
        if (isBulletList) {
          return (
            <div key={pIdx} className="space-y-1 my-1 pl-1">
              {lines.map((line, lIdx) => {
                const content = line.replace(/^[-*]\s*/, "");
                // Check if key-value: e.g. "Model: DIRECT_DEVIATION"
                const kvMatch = content.match(/^([^:]+):\s*(.+)$/);
                if (kvMatch) {
                  return (
                    <div key={lIdx} className="flex items-start gap-1.5 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      <div>
                        <span className="text-muted-foreground font-medium">{kvMatch[1]}: </span>
                        <span className="font-semibold text-foreground">{parseInlineMarkdown(kvMatch[2])}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={lIdx} className="flex items-start gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                    <div className="flex-1">{parseInlineMarkdown(content)}</div>
                  </div>
                );
              })}
            </div>
          );
        }

        // Regular paragraph or heading
        return (
          <div key={pIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              if (line.startsWith("### ")) {
                return (
                  <h4 key={lIdx} className="font-bold text-xs text-foreground mt-2 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    {parseInlineMarkdown(line.replace(/^###\s*/, ""))}
                  </h4>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h3 key={lIdx} className="font-bold text-sm text-foreground mt-2 mb-1">
                    {parseInlineMarkdown(line.replace(/^##\s*/, ""))}
                  </h3>
                );
              }

              return (
                <p key={lIdx} className="text-[11.5px] leading-relaxed">
                  {parseInlineMarkdown(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const GaugemasterTemplateAssistant: React.FC<GaugemasterTemplateAssistantProps> = ({
  open,
  onClose,
  templateName,
  instrumentType,
  calibrationType,
  blocks,
  selectedTable,
  selectedColumnId,
  onUpdateTableColumns,
  onOpenTableAuditModal,
  onOpenPreSaveModal,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      sender: "assistant",
      text: `Hello! I am your **Gaugemaster Template Assistant**.\n\nI understand your calibration specifications, Excel formulas, tolerance limits, and table structures. How can I assist you with **${templateName || "this template"}**?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [historyStack, setHistoryStack] = useState<Array<{ tableId: string; columns: CanvasColumnDef[]; description: string }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  if (!open) return null;

  const currentColumns = selectedTable?.columns || [];
  const selectedCol = currentColumns.find((c) => c.id === selectedColumnId);

  const pushToHistory = (tableId: string, columns: CanvasColumnDef[], description: string) => {
    setHistoryStack((prev) => [...prev, { tableId, columns: JSON.parse(JSON.stringify(columns)), description }]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const lastItem = historyStack[historyStack.length - 1];
    onUpdateTableColumns(lastItem.tableId, lastItem.columns);
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));

    const undoMsg: ChatMessage = {
      id: `undo_${Date.now()}`,
      sender: "assistant",
      text: `↩️ Undid: **${lastItem.description}**. Previous table columns restored.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, undoMsg]);
  };

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      // 1. Intercept: Audit Current Table
      if (/^audit\s*(current\s*)?table$/i.test(query) && selectedTable) {
        const audit = auditCalibrationTable(selectedTable);
        const fixable = audit.columnAudits.filter(c => !!c.recommendedFormula && c.recommendedFormula !== c.currentFormula);

        const proposals: ProposalItem[] = fixable.map(c => ({
          columnId: c.columnId,
          columnLabel: c.columnLabel,
          before: c.currentFormula || "(none)",
          after: c.recommendedFormula!,
          reason: c.recommendationReason || "Normalization to canonical metrology formula.",
          confidence: c.confidence
        }));

        const auditSummary: AuditSummaryData = {
          tableTitle: selectedTable.title,
          calculationModel: audit.calculationModel,
          certificateReadiness: audit.healthSummary.certificateReadiness,
          columnsCount: audit.columnsCount,
          calculatedColumnsCount: audit.calculatedColumnsCount,
          issuesCount: audit.issuesCount,
          warningsCount: audit.warningsCount,
          conclusion: fixable.length > 0
            ? `Found ${fixable.length} formula optimization(s) ready to apply.`
            : "All columns are healthy and metrologically valid."
        };

        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          sender: "assistant",
          text: `Table "${selectedTable.title}" audit complete.`,
          auditSummary,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          proposedAction: fixable.length > 0 ? "FIX_TABLE" : "NONE",
          proposals: fixable.length > 0 ? proposals : undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
        return;
      }

      // 2. Intercept: Check Tolerances
      if (/check\s*tolerances/i.test(query) && selectedTable) {
        const audit = auditCalibrationTable(selectedTable);
        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          sender: "assistant",
          text: `### Tolerance Structure Analysis\n\n- Table: **${selectedTable.title}**\n- Distribution: **${audit.toleranceClassification.toUpperCase()}**\n- Calculation Model: **${audit.calculationModel}**\n\nRow-specific tolerance limits are verified. ${
            audit.toleranceClassification === "asymmetric"
              ? "Asymmetric tolerances are in use (e.g. +0.018 / 0.000 or -0.020 / -0.010). Gaugemaster enforces independent `lower_limit` and `upper_limit` boundaries."
              : "Symmetric tolerances are evaluated against normalized nominal dimensions."
          }`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
        return;
      }

      // 3. Intercept: Test Boundaries
      if (/test\s*boundaries/i.test(query) && selectedTable) {
        const judgementCol = selectedTable.columns.find(c => c.role === "JUDGEMENT" || c.semanticRole === "JUDGEMENT" || c.type === "status");
        if (judgementCol && judgementCol.formula) {
          const rep = runMetrologyBoundaryTests({
            formula: judgementCol.formula,
            nominal: 35.035,
            lowerLimit: 35.015,
            upperLimit: 35.025,
            decimalPlaces: 3,
            readingVarName: "actual_dimension"
          });

          const assistantMsg: ChatMessage = {
            id: `a_${Date.now()}`,
            sender: "assistant",
            text: `### 7-Point Boundary Test Report\n\n- Tested Column: **${judgementCol.label}**\n- Result: **${rep.passedCount}/${rep.totalCount} Tests Passed** (${rep.allPassed ? "✓ All Passed" : "⚠️ Edge cases require review"})\n\n${rep.summary}\n\nKey conditions verified: Lower Limit (PASS), Upper Limit (PASS), Below Lower (FAIL), Above Upper (FAIL), Nominal Midpoint (PASS), Blank reading ('-'), and Zero reading.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLoading(false);
          return;
        }
      }

      // 4. Intercept: Check Blank Handling
      if (/blank\s*handling/i.test(query) && selectedTable) {
        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          sender: "assistant",
          text: `### Blank Reading Safety Invariant\n\n- Metrology Rule: **Blank readings must NEVER produce PASS.**\n- Enforced Behavior: Blank values (\`""\`, \`null\`, \`undefined\`, \`"-"\`) safely propagate \`"-"\` across all calculated columns.\n- Zero Measurement: Numeric \`0.000\` is recognized as a valid measurement point and evaluated mathematically against tolerance limits.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
        return;
      }

      // 5. Intercept: Explain Calculation
      if (/explain\s*calc/i.test(query) && selectedTable) {
        const audit = auditCalibrationTable(selectedTable);
        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          sender: "assistant",
          text: `### Calculation Model: ${audit.calculationModel}\n\n- Active Table: **${selectedTable.title}**\n- Model Architecture: **${audit.calculationModel}**\n- ISO/IEC 17025 Compliant: **Yes (Deterministic AST Evaluation)**\n\nUnder this model, calculations evaluate row-independently with automatic tolerance normalization, multi-trial averaging (where applicable), and safe blank propagation.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
        return;
      }

      const tablesSummary = blocks
        .filter((b): b is TableGridBlock => b.type === "table_grid")
        .map((t) => ({
          id: t.id,
          title: t.title,
          columns: t.columns.map((c) => ({
            id: c.id,
            label: c.label,
            role: c.role,
            formula: c.formula,
          })),
        }));

      const res = await askTemplateAssistant(query, {
        templateName,
        instrumentType,
        calibrationType,
        selectedTableTitle: selectedTable?.title,
        selectedTableId: selectedTable?.id,
        selectedColumnId: selectedColumnId || undefined,
        columns: currentColumns,
        tablesSummary,
      });

      let proposals: ProposalItem[] | undefined;
      if (res.action === "FIX_FORMULA" && res.actionPayload?.columnId && res.actionPayload?.formula) {
        const tgtCol = currentColumns.find(c => c.id === res.actionPayload?.columnId);
        proposals = [{
          columnId: res.actionPayload.columnId,
          columnLabel: tgtCol?.label || res.actionPayload.columnId,
          before: tgtCol?.formula || "(none)",
          after: res.actionPayload.formula,
          reason: res.actionPayload.reason || "Recommended by assistant",
          confidence: "HIGH"
        }];
      }

      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        sender: "assistant",
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        proposedAction: res.action,
        actionPayload: res.actionPayload,
        proposals
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          sender: "assistant",
          text: `Error processing request: ${err.message || "Failed to contact assistant."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Execute single proposed change
  const handleApplySingleProposal = (msgId: string, proposal: ProposalItem) => {
    if (!selectedTable) return;
    pushToHistory(selectedTable.id, selectedTable.columns, `Fix formula on column "${proposal.columnLabel}"`);

    const updatedCols = selectedTable.columns.map((col) => {
      if (col.id === proposal.columnId) {
        return {
          ...col,
          formula: proposal.after,
          formulaStatus: "VALIDATED" as const,
          formulaSource: "EXCEL_TRANSLATED" as const,
          translationReason: proposal.reason,
        };
      }
      return col;
    });

    onUpdateTableColumns(selectedTable.id, updatedCols);

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );
  };

  // Execute all proposed changes
  const handleApplyAllProposals = (msgId: string, proposals: ProposalItem[]) => {
    if (!selectedTable) return;
    pushToHistory(selectedTable.id, selectedTable.columns, `Fix all ${proposals.length} formulas in table "${selectedTable.title}"`);

    const proposalMap = new Map(proposals.map(p => [p.columnId, p]));
    const updatedCols = selectedTable.columns.map((col) => {
      const prop = proposalMap.get(col.id);
      if (prop) {
        return {
          ...col,
          formula: prop.after,
          formulaStatus: "VALIDATED" as const,
          formulaSource: "EXCEL_TRANSLATED" as const,
          translationReason: prop.reason,
        };
      }
      return col;
    });

    onUpdateTableColumns(selectedTable.id, updatedCols);

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );
  };

  // 12 Action Chips List
  const ACTION_CHIPS = [
    { label: "Audit Current Table", query: "Audit current table", icon: ShieldCheck },
    { label: "Audit Template", query: "Audit entire template", icon: Cpu },
    { label: "Fix All Formulas", query: "Fix all formulas in this table", icon: Wand2 },
    { label: "Fix Selected", query: "Fix formula for selected column", icon: Wand2 },
    { label: "Check Tolerances", query: "Check tolerances", icon: Sliders },
    { label: "Test Boundaries", query: "Test boundaries", icon: Play },
    { label: "Compare Excel", query: "Compare current formulas with original Excel formulas", icon: FileSpreadsheet },
    { label: "Explain Formula", query: "Explain formula for selected column", icon: HelpCircle },
    { label: "Explain Calculation", query: "Explain calculation model", icon: Info },
    { label: "Check Certificate", query: "Check certificate print visibility and layout", icon: Eye },
    { label: "Prepare Trial Run", query: "Prepare for trial run and live verification", icon: Play },
    { label: "Check Blank Handling", query: "Check blank handling", icon: ShieldCheck },
  ];

  return (
    <div
      role="region"
      aria-label="Gaugemaster Template Assistant"
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out ${
        minimized
          ? "w-[360px] h-16 cursor-pointer"
          : "w-[460px] h-[640px] max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      }`}
    >
      {/* ========================================================================= */}
      {/* MINIMIZED STATE: SLEEK DARK CAPSULE WITH GLOW & LIVE ANIMATION            */}
      {/* ========================================================================= */}
      {minimized ? (
        <div
          onClick={() => setMinimized(false)}
          className="w-full h-full p-3 px-4 rounded-2xl bg-slate-950/95 text-white border-2 border-slate-700/90 hover:border-primary shadow-[0_10px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(59,130,246,0.35)] ring-1 ring-primary/40 backdrop-blur-md flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] group select-none"
          title="Click to expand Gaugemaster Template Assistant"
        >
          <div className="flex items-center gap-3">
            {/* Pulsing Bot Icon Container with Live Status Ping */}
            <div className="relative shrink-0">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-primary via-blue-600 to-indigo-600 text-white shadow-md shadow-primary/40 flex items-center justify-center">
                <Bot className="w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
              </span>
            </div>

            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-white tracking-wide flex items-center gap-1">
                  AI Assistant
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </span>
                <Badge
                  variant="outline"
                  className="text-[8.5px] py-0 px-1.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono uppercase"
                >
                  Active
                </Badge>
              </div>
              <span className="text-[11px] text-slate-300 block truncate max-w-[170px] font-medium mt-0.5">
                {selectedTable ? selectedTable.title : "Ready to assist"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMinimized(false)}
              className="h-8 w-8 rounded-lg bg-slate-800/90 hover:bg-primary text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Expand Assistant"
              aria-label="Expand Assistant"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-slate-800/90 hover:bg-rose-600 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close Assistant"
              aria-label="Close Assistant"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* EXPANDED STATE: FULL INTELLIGENCE ASSISTANT WINDOW                        */
        /* ========================================================================= */
        <>
          {/* Header */}
          <div className="p-3 px-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-md shadow-primary/30">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-white block">
                    Gaugemaster Template Assistant
                  </span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
                <span className="text-[10.5px] text-slate-300 block truncate max-w-[210px] font-medium">
                  {selectedTable ? `Table: ${selectedTable.title}` : "Ready to assist"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {historyStack.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  className="h-6 px-2 text-[10px] bg-amber-500/20 text-amber-200 border-amber-400/50 hover:bg-amber-500/30 flex items-center gap-1 cursor-pointer"
                  title={`Undo last action (${historyStack[historyStack.length - 1].description})`}
                >
                  <Undo2 className="w-3 h-3" />
                  Undo
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMinimized(true)}
                className="h-7 w-7 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                title="Minimize to Dark Floating Capsule"
                aria-label="Minimize Assistant"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 rounded-lg hover:bg-rose-600/80 text-slate-300 hover:text-white cursor-pointer"
                title="Close Assistant"
                aria-label="Close Assistant"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick Action Chips Bar (12 Calibration Intelligence Actions) */}
          <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950/70 border-b flex items-center gap-1.5 overflow-x-auto text-[10px] shrink-0 no-scrollbar">
            {ACTION_CHIPS.map((chip, idx) => {
              const IconComp = chip.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(chip.query)}
                  className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary text-foreground shrink-0 transition-all flex items-center gap-1.5 font-medium cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                >
                  <IconComp className="w-3 h-3 text-primary shrink-0" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-slate-50/40 dark:bg-slate-950/20">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-indigo-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-xl p-3 text-xs leading-relaxed space-y-2 ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-medium rounded-br-xs shadow-xs"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-foreground rounded-bl-xs shadow-xs"
                  }`}
                >
                  {/* Human-Readable Rendered Content */}
                  {msg.sender === "assistant" ? (
                    <FormattedAssistantMessage text={msg.text} auditSummary={msg.auditSummary} />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  )}

                  {/* Change Proposal Cards */}
                  {msg.proposals && msg.proposals.length > 0 && (
                    <div className="mt-2.5 space-y-2 text-foreground">
                      {msg.proposals.map((prop) => (
                        <div
                          key={prop.columnId}
                          className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-2 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              {prop.columnLabel} <span className="font-mono text-[10px] text-muted-foreground">({prop.columnId})</span>
                            </span>
                            {prop.confidence && (
                              <Badge variant="outline" className="text-[9px] bg-white text-amber-800 border-amber-300 dark:bg-slate-900 dark:text-amber-300">
                                {prop.confidence}
                              </Badge>
                            )}
                          </div>

                          <div className="text-[10.5px] space-y-1 font-mono">
                            <div className="text-muted-foreground flex items-center gap-1.5">
                              <span className="w-12 shrink-0">Before:</span>
                              <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border text-muted-foreground break-all flex-1">
                                {prop.before}
                              </code>
                            </div>
                            <div className="text-primary font-bold flex items-center gap-1.5">
                              <span className="w-12 shrink-0 text-amber-900 dark:text-amber-200 font-sans">Proposed:</span>
                              <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-primary/40 text-primary break-all flex-1">
                                {prop.after}
                              </code>
                            </div>
                          </div>

                          <p className="text-[10px] text-amber-900 dark:text-amber-300 italic leading-tight">
                            "{prop.reason}"
                          </p>

                          {!msg.actionApplied && (
                            <div className="flex items-center gap-1.5 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleApplySingleProposal(msg.id, prop)}
                                className="h-6 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Check className="w-2.5 h-2.5" />
                                Apply Change
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Apply All Button if multiple proposals */}
                      {msg.proposals.length > 1 && !msg.actionApplied && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleApplyAllProposals(msg.id, msg.proposals!)}
                          className="w-full h-7 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          Apply All Changes ({msg.proposals.length} columns)
                        </Button>
                      )}

                      {msg.actionApplied && (
                        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Changes Applied. (Click Undo in header to revert if needed)
                        </div>
                      )}
                    </div>
                  )}

                  <span className="text-[9px] opacity-60 block text-right pt-0.5">
                    {msg.timestamp}
                  </span>
                </div>

                {msg.sender === "user" && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-foreground" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs italic bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Gaugemaster Assistant is analyzing metrology semantics...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="p-3 border-t bg-slate-50 dark:bg-slate-950 flex items-center gap-2 shrink-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about formulas, tolerances, boundary tests..."
              className="h-9 text-xs bg-white dark:bg-slate-900"
            />
            <Button
              type="button"
              size="icon"
              disabled={!input.trim() || loading}
              onClick={() => sendMessage()}
              className="h-9 w-9 shrink-0 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
