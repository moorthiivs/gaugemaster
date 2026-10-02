import React, { useState, useRef, useEffect, useMemo } from "react";
import { TableGridBlock, CanvasColumnDef, CanvasBlock, CanvasRowData } from "@/types/template";
import {
  askTemplateAssistant,
  AssistantResponse,
  AssistantActionType,
  AssistantActionPayload,
} from "@/lib/geminiService";
import { auditCalibrationTable } from "@/lib/calibrationTableAuditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AssistantMarkdownRenderer } from "./AssistantMarkdownRenderer";
import {
  AssistantAttachment,
  CanonicalChangeProposal,
  CopilotMessage,
} from "@/types/assistant";
import { AiConnectionBadge } from "./AiConnectionBadge";
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
  Copy,
  Table as TableIcon,
  ArrowRight,
  SlidersHorizontal,
  CheckCheck,
  Paperclip,
  Pencil,
  Upload,
  RotateCcw,
  Minus,
  Square,
  Pause,
  GripHorizontal,
  PanelRightClose,
  PanelRight,
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
  onUpdateTableBlock?: (tableId: string, updatedFields: Partial<TableGridBlock>) => void;
  onAddTableColumn?: (tableId: string, newColumn: CanvasColumnDef) => void;
  onDeleteTableColumn?: (tableId: string, columnId: string) => void;
  onAddTableBlock?: (tableData?: Partial<TableGridBlock>) => void;
  onDeleteTableBlock?: (tableId: string) => void;
  onUpdateTableRows?: (tableId: string, updatedRows: CanvasRowData[]) => void;
  onRestoreTableState?: (
    tableId: string,
    previousState: {
      columns?: CanvasColumnDef[];
      tableSettings?: Partial<TableGridBlock>;
      rows?: CanvasRowData[];
    }
  ) => void;
  onOpenTrialRun?: () => void;
  onOpenTableAuditModal?: () => void;
  onOpenPreSaveModal?: () => void;
  onNavigateToColumn?: (columnId: string) => void;
  onNavigateToTable?: (tableId: string) => void;
  docked?: boolean;
  onToggleDock?: () => void;
}

interface ProposalItem {
  columnId: string;
  columnLabel: string;
  before: string;
  after: string;
  reason: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | string;
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

export type ChatMessage = CopilotMessage;

interface HistoryEntry {
  tableId: string;
  description: string;
  messageId?: string;
  previousColumns?: CanvasColumnDef[];
  previousTableSettings?: Partial<TableGridBlock>;
  previousRows?: CanvasRowData[];
  createdTableId?: string;
  deletedTable?: TableGridBlock;
}

/**
 * Parses inline markdown: `code`, **bold**, *italic* into styled React nodes with copyable code snippets.
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
      const codeVal = codeMatch[2];
      tokens.push(
        <code
          key={key++}
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(codeVal);
            toast.success(`Copied "${codeVal}" to clipboard`);
          }}
          title="Click to copy formula"
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[10.5px] text-primary border border-slate-200 dark:border-slate-800 break-all cursor-pointer hover:border-primary transition-colors inline-flex items-center gap-1 group/code"
        >
          <span>{codeVal}</span>
          <Copy className="w-2.5 h-2.5 opacity-40 group-hover/code:opacity-100 transition-opacity shrink-0" />
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
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1];
    return {
      tableTitle: titleMatch ? titleMatch[1] : "Active Table",
      calculationModel: modelMatch[1],
      certificateReadiness: (readinessMatch[1].trim() as any) || "REVIEW REQUIRED",
      columnsCount: parseInt(colsMatch[1], 10),
      calculatedColumnsCount: parseInt(colsMatch[2], 10),
      issuesCount: parseInt(issuesMatch[1], 10),
      warningsCount: parseInt(issuesMatch[2], 10),
      conclusion: lastLine || "Audit complete.",
    };
  }
  return null;
}

/**
 * Renders human-readable formatted AI responses with cards, badges, and clean typography.
 */
const FormattedAssistantMessage: React.FC<{
  text: string;
  auditSummary?: AuditSummaryData;
  onCopyFormula?: (formula: string) => void;
  onSelectSuggestion?: (suggestion: string) => void;
}> = ({ text, auditSummary: initialSummary, onCopyFormula, onSelectSuggestion }) => {
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
          <Badge
            variant="secondary"
            className="font-mono text-[10px] font-bold bg-primary/10 text-primary border border-primary/20"
          >
            {auditSummary.calculationModel}
          </Badge>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-muted-foreground block text-[9px]">Columns</span>
            <span className="font-bold text-foreground">
              {auditSummary.columnsCount} ({auditSummary.calculatedColumnsCount} calc)
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-muted-foreground block text-[9px]">Issues</span>
            <span
              className={`font-bold ${
                auditSummary.issuesCount > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {auditSummary.issuesCount}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-muted-foreground block text-[9px]">Warnings</span>
            <span
              className={`font-bold ${
                auditSummary.warningsCount > 0 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {auditSummary.warningsCount}
            </span>
          </div>
        </div>

        {/* Conclusion Callout */}
        <div
          className={`p-2 rounded-lg text-[10.5px] flex items-center gap-1.5 ${
            auditSummary.issuesCount === 0 && auditSummary.warningsCount === 0
              ? "bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
              : auditSummary.issuesCount === 0
              ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
              : "bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
          }`}
        >
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

  return (
    <div className="space-y-2 text-xs leading-relaxed text-foreground">
      <AssistantMarkdownRenderer
        content={text}
        onCopyFormula={onCopyFormula}
        onSelectSuggestion={onSelectSuggestion}
      />
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
  onUpdateTableBlock,
  onAddTableColumn,
  onDeleteTableColumn,
  onAddTableBlock,
  onDeleteTableBlock,
  onUpdateTableRows,
  onOpenTrialRun,
  onOpenTableAuditModal,
  onOpenPreSaveModal,
  onNavigateToColumn,
  onNavigateToTable,
  onRestoreTableState,
  docked = false,
  onToggleDock,
}) => {
  const storageKey = `gm_copilot_chat_${templateName ? templateName.replace(/\s+/g, "_") : "default"}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: "initial",
        role: "assistant",
        sender: "assistant",
        content: `Hello! I am your **Gaugemaster Template Copilot**.\n\nI understand calibration specifications, Excel formulas, tolerance limits, and table structures. How can I assist you with **${
          templateName || "this template"
        }**?`,
        text: `Hello! I am your **Gaugemaster Template Copilot**.\n\nI understand calibration specifications, Excel formulas, tolerance limits, and table structures. How can I assist you with **${
          templateName || "this template"
        }**?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions: [
          "Audit & Validate formulas and measurement uncertainties",
          "Test Boundary Conditions against ISO/IEC 17025 standards",
          "Check and fix formula errors in this table",
          "Can I save this template?"
        ],
      },
    ];
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  const handleClearChat = () => {
    const fresh: ChatMessage = {
      id: `initial_${Date.now()}`,
      role: "assistant",
      sender: "assistant",
      content: `Hello! I am your **Gaugemaster Template Copilot**.\n\nConversation history has been reset. How can I assist you with **${
        templateName || "this template"
      }**?`,
      text: `Hello! I am your **Gaugemaster Template Copilot**.\n\nConversation history has been reset. How can I assist you with **${
        templateName || "this template"
      }**?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestions: [
        "Audit & Validate formulas and measurement uncertainties",
        "Test Boundary Conditions against ISO/IEC 17025 standards",
        "Check and fix formula errors in this table",
        "Can I save this template?"
      ],
    };
    setMessages([fresh]);
    setHistoryStack([]);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
    toast.info("Conversation reset");
  };

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingStage, setThinkingStage] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [expandedMode, setExpandedMode] = useState(false);
  const [historyStack, setHistoryStack] = useState<HistoryEntry[]>([]);
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Auto-resize textarea to fit content naturally up to max-height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    toast.info("AI response paused / stopped");
  };

  // Window dragging & custom positioning state
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  // Manual corner/edge expand/drag-resize state
  const [customSize, setCustomSize] = useState<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeDirectionRef = useRef<"se" | "e" | "s" | "w" | "sw">("se");
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startWidth: number; startHeight: number; startX: number; startY: number } | null>(null);

  const handleStartDrag = (clientX: number, clientY: number) => {
    if (docked || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: rect.left,
      startY: rect.top,
    };
    setIsDraggingWindow(true);
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (docked) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select, [role='button']")) {
      return;
    }
    handleStartDrag(e.clientX, e.clientY);
  };

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if (docked) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select, [role='button']")) {
      return;
    }
    if (e.touches.length > 0) {
      handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Window drag event listeners
  useEffect(() => {
    if (!isDraggingWindow) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !containerRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const w = containerRef.current.offsetWidth || 480;
      const maxX = Math.max(10, window.innerWidth - w - 10);
      const maxY = Math.max(10, window.innerHeight - 50);
      const newX = Math.min(Math.max(10, dragStartRef.current.startX + dx), maxX);
      const newY = Math.min(Math.max(10, dragStartRef.current.startY + dy), maxY);
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current || !containerRef.current || e.touches.length === 0) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.mouseX;
      const dy = touch.clientY - dragStartRef.current.mouseY;
      const w = containerRef.current.offsetWidth || 480;
      const maxX = Math.max(10, window.innerWidth - w - 10);
      const maxY = Math.max(10, window.innerHeight - 50);
      const newX = Math.min(Math.max(10, dragStartRef.current.startX + dx), maxX);
      const newY = Math.min(Math.max(10, dragStartRef.current.startY + dy), maxY);
      setPosition({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDraggingWindow(false);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDraggingWindow]);

  // Corner/edge expand/drag-resize handlers
  const handleStartResize = (e: React.MouseEvent, direction: "se" | "e" | "s" | "w" | "sw" = "se") => {
    if (docked || !containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const startPos = position || { x: rect.left, y: rect.top };
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startX: startPos.x,
      startY: startPos.y,
    };
    resizeDirectionRef.current = direction;
    if (!position) {
      setPosition(startPos);
    }
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const dx = e.clientX - resizeStartRef.current.mouseX;
      const dy = e.clientY - resizeStartRef.current.mouseY;
      const dir = resizeDirectionRef.current;

      let newW = resizeStartRef.current.startWidth;
      let newH = resizeStartRef.current.startHeight;

      // Width adjustment
      if (dir === "se" || dir === "e") {
        newW = Math.min(Math.max(380, resizeStartRef.current.startWidth + dx), window.innerWidth - 30);
      } else if (dir === "w" || dir === "sw") {
        newW = Math.min(Math.max(380, resizeStartRef.current.startWidth - dx), window.innerWidth - 30);
      }

      // Height adjustment
      if (dir === "se" || dir === "s" || dir === "sw") {
        newH = Math.min(Math.max(450, resizeStartRef.current.startHeight + dy), window.innerHeight - 30);
      }

      setCustomSize({ width: newW, height: newH });

      // For left-edge resize, anchor the right edge by shifting position.x
      if (dir === "w" || dir === "sw") {
        const rightEdge = resizeStartRef.current.startX + resizeStartRef.current.startWidth;
        const newX = Math.max(10, rightEdge - newW);
        setPosition(prev => prev ? { ...prev, x: newX } : prev);
      }
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing]);

  // Viewport bounds clamping when expandedMode changes
  useEffect(() => {
    if (position && !docked && containerRef.current) {
      const w = customSize?.width || (expandedMode ? Math.min(840, window.innerWidth - 30) : 490);
      const h = customSize?.height || (expandedMode ? Math.min(780, window.innerHeight - 30) : 670);
      const maxX = Math.max(10, window.innerWidth - w - 10);
      const maxY = Math.max(10, window.innerHeight - h - 10);
      const clampedX = Math.min(Math.max(10, position.x), maxX);
      const clampedY = Math.min(Math.max(10, position.y), maxY);
      if (clampedX !== position.x || clampedY !== position.y) {
        setPosition({ x: clampedX, y: clampedY });
      }
    }
  }, [expandedMode, customSize]);

  // Animated thinking stage cycling
  useEffect(() => {
    let timer: any;
    if (loading) {
      setThinkingStage(0);
      timer = setInterval(() => {
        setThinkingStage((prev) => (prev + 1) % 4);
      }, 900);
    }
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const currentColumns = selectedTable?.columns || [];
  const selectedCol = currentColumns.find((c) => c.id === selectedColumnId);

  // Dynamic suggestion pills based on current table state
  const suggestionPills = useMemo(() => {
    const list: Array<{ label: string; query: string; icon: any }> = [];
    
    // Core Quick Prompts matching design
    list.push({ label: "Audit this table", query: "Audit this table", icon: ShieldCheck });
    list.push({ label: "Fix formula", query: "Check and fix formula errors in this table", icon: Wand2 });
    list.push({ label: "Parse specification", query: "Parse specification Shaft Ø35.035 -0.02/-0.01", icon: FileSpreadsheet });
    list.push({ label: "Test boundaries", query: "Test 7-point boundaries", icon: Activity });

    if (!selectedTable) {
      list.push({ label: "Audit Template", query: "Audit entire template", icon: Cpu });
      list.push({ label: "Pre-Save Check", query: "Can I save this template?", icon: CheckCircle2 });
      return list;
    }

    const audit = auditCalibrationTable(selectedTable);
    const fixable = audit.columnAudits.filter(
      (c) => !!c.recommendedFormula && c.recommendedFormula !== c.currentFormula
    );

    if (fixable.length > 0) {
      list.push({
        label: `Auto-Fix ${fixable.length} Formula(s)`,
        query: "Fix all formulas in this table",
        icon: Wand2,
      });
    }

    // Check if table has deviation or average
    const hasDeviation = selectedTable.columns.some(
      (c) => /dev(iation)?/i.test(c.label || c.id)
    );
    if (!hasDeviation) {
      list.push({ label: "Add Deviation Column", query: "Add Deviation column", icon: Wand2 });
    }

    // Table lifecycle actions
    list.push({ label: "+ Create New Table", query: "Create a new calibration table", icon: TableIcon });

    // Pre-save gate
    list.push({ label: "Pre-Save Quality Gate", query: "Can I save this template?", icon: CheckCircle2 });

    return list;
  }, [selectedTable]);

  if (!open) return null;

  const pushToHistory = (entry: HistoryEntry) => {
    setHistoryStack((prev) => [...prev, entry]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const lastItem = historyStack[historyStack.length - 1];

    if (onDeleteTableBlock && (lastItem.createdTableId || /create|add.*table/i.test(lastItem.description))) {
      let targetId = lastItem.createdTableId;
      if (!targetId || targetId === "new_table") {
        // Fallback 1: Match by table title inside description
        const titleMatch = lastItem.description.match(/"([^"]+)"/);
        if (titleMatch) {
          const found = blocks.find((b) => b.type === "table_grid" && b.title === titleMatch[1]);
          if (found) targetId = found.id;
        }
        // Fallback 2: The most recently added table_grid block
        if (!targetId) {
          const lastTable = [...blocks].reverse().find((b) => b.type === "table_grid");
          if (lastTable) targetId = lastTable.id;
        }
      }
      if (targetId) {
        onDeleteTableBlock(targetId);
      }
    } else if (lastItem.deletedTable && onAddTableBlock) {
      onAddTableBlock(lastItem.deletedTable);
    } else if (onRestoreTableState) {
      onRestoreTableState(lastItem.tableId, {
        columns: lastItem.previousColumns,
        tableSettings: lastItem.previousTableSettings,
        rows: lastItem.previousRows,
      });
    } else {
      if (lastItem.previousColumns) {
        onUpdateTableColumns(lastItem.tableId, lastItem.previousColumns);
      }
      if (lastItem.previousTableSettings && onUpdateTableBlock) {
        onUpdateTableBlock(lastItem.tableId, lastItem.previousTableSettings);
      }
      if (lastItem.previousRows && onUpdateTableRows) {
        onUpdateTableRows(lastItem.tableId, lastItem.previousRows);
      }
    }

    setHistoryStack((prev) => prev.slice(0, prev.length - 1));

    if (lastItem.messageId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === lastItem.messageId ? { ...m, actionApplied: false } : m))
      );
    }

    const undoMsg: ChatMessage = {
      id: `undo_${Date.now()}`,
      role: "assistant",
      content: `↩️ Undid: **${lastItem.description}**. Previous table state restored.`,
      sender: "assistant",
      text: `↩️ Undid: **${lastItem.description}**. Previous table state restored.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, undoMsg]);
    toast.success(`Undid "${lastItem.description}"`);
  };

  // Attachment Handlers (Sections 6, 7 & 8)
  const handleFileSelect = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      const lowerName = file.name.toLowerCase();
      let category: AssistantAttachment["category"] = "document";
      let extractedFormulas: string[] = [];
      let parsedSheets: AssistantAttachment["parsedSheets"] = [];
      let textSummary = "";
      let dataUrl: string | undefined = undefined;

      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")) {
        category = "excel";
        try {
          const buffer = await file.arrayBuffer();
          if (lowerName.endsWith(".csv")) {
            const text = await file.text();
            textSummary = `CSV Content:\n${text.slice(0, 1500)}`;
            parsedSheets = [{ sheetName: "CSV", rowCount: text.split("\n").length, columnCount: 1 }];
          } else {
            const workbook = XLSX.read(buffer, { type: "array", cellFormula: true });
            parsedSheets = workbook.SheetNames.map((sn) => {
              const ws = workbook.Sheets[sn];
              const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
              Object.keys(ws).forEach((cellAddr) => {
                if (cellAddr.startsWith("!")) return;
                const cell = ws[cellAddr];
                if (cell && cell.f) {
                  extractedFormulas.push(`=${cell.f}`);
                }
              });
              return {
                sheetName: sn,
                rowCount: json.length,
                columnCount: json[0] ? (json[0] as any[]).length : 0,
              };
            });
            textSummary = `Excel file with ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}. Extracted ${extractedFormulas.length} formulas.`;
          }
        } catch (e) {
          textSummary = `Excel file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        }
      } else if (file.type.startsWith("image/")) {
        category = "image";
        dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      } else if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
        category = "calibration";
        try {
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
          textSummary = `PDF calibration document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        } catch {
          textSummary = `PDF calibration document: ${file.name}`;
        }
      } else {
        category = "document";
        textSummary = `Attached document: ${file.name}`;
      }

      const newAtt: AssistantAttachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        category,
        dataUrl,
        textSummary,
        extractedFormulas,
        parsedSheets,
      };

      setAttachments((prev) => [...prev, newAtt]);
      toast.success(`Attached ${file.name}`);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      handleFileSelect(e.clipboardData.files);
    }
  };

  // Message Editing Handlers (Section 5)
  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text || msg.content || "");
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!editingText.trim()) return;
    const msgIdx = messages.findIndex((m) => m.id === msgId);
    if (msgIdx === -1) return;

    // Truncate subsequent responses to avoid stale conversation history
    const updatedMessages = messages.slice(0, msgIdx);
    setMessages(updatedMessages);
    const textToSubmit = editingText.trim();
    setEditingMessageId(null);
    setEditingText("");

    await sendMessage(textToSubmit);
  };

  const handleCopyMessage = (text: string, msgId?: string) => {
    navigator.clipboard.writeText(text);
    if (msgId) {
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
    toast.success("Copied to clipboard");
  };

  const handleFormulaApplyFromMarkdown = (formula: string) => {
    if (selectedColumnId && onUpdateTableColumns) {
      const updated = currentColumns.map((col) =>
        col.id === selectedColumnId ? { ...col, formula, formulaStatus: "VALIDATED" as const } : col
      );
      const tableId = selectedTable?.id || "active_table";
      onUpdateTableColumns(tableId, updated);
      toast.success(`Formula applied to column: ${selectedColumnId}`);
    } else {
      navigator.clipboard.writeText(formula);
      toast.success("Formula copied to clipboard!");
    }
  };

  const handleRetry = async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user" || m.role === "user");
    if (lastUserMsg) {
      await sendMessage(lastUserMsg.text || lastUserMsg.content);
    }
  };

  // Canonical Change Proposal Handler (Section 10)
  const handleApplyCanonicalProposal = (msgId: string, proposal: CanonicalChangeProposal) => {
    // 1. If proposal creates a new table
    const createTableChange = proposal.changes.find((c) => c.type === "CREATE_TABLE");
    if (createTableChange) {
      if (onAddTableBlock) {
        const created = onAddTableBlock(createTableChange.tableBlock);
        const createdId = (created as any)?.id || createTableChange.tableBlock?.id || createTableChange.targetId;
        pushToHistory({
          tableId: createdId || "new_table",
          createdTableId: createdId,
          description: proposal.summary,
          messageId: msgId,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
        );
        toast.success(`Applied: ${proposal.summary}`);
        const confirmMsg: ChatMessage = {
          id: `applied_${Date.now()}`,
          role: "assistant",
          sender: "assistant",
          content: `✅ Successfully applied: **${proposal.summary}**.\n\nA new calibration table has been added to your template designer.`,
          text: `✅ Successfully applied: **${proposal.summary}**.\n\nA new calibration table has been added to your template designer.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, confirmMsg]);
        return;
      }
    }

    // 2. If proposal deletes a table
    const deleteTableChange = proposal.changes.find((c) => c.type === "DELETE_TABLE");
    if (deleteTableChange) {
      const targetTableId = deleteTableChange.targetId || selectedTable?.id;
      if (targetTableId && onDeleteTableBlock) {
        pushToHistory({
          tableId: targetTableId,
          description: proposal.summary,
        });
        onDeleteTableBlock(targetTableId);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
        );
        toast.success(`Applied: ${proposal.summary}`);
        const confirmMsg: ChatMessage = {
          id: `applied_${Date.now()}`,
          role: "assistant",
          sender: "assistant",
          content: `✅ Successfully applied: **${proposal.summary}**.\n\nThe calibration table has been removed from your template.`,
          text: `✅ Successfully applied: **${proposal.summary}**.\n\nThe calibration table has been removed from your template.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, confirmMsg]);
        return;
      }
    }

    if (!selectedTable) {
      toast.error("No active table selected");
      return;
    }

    pushToHistory({
      tableId: selectedTable.id,
      description: proposal.summary,
      messageId: msgId,
      previousColumns: selectedTable.columns ? JSON.parse(JSON.stringify(selectedTable.columns)) : undefined,
      previousTableSettings: {
        orientation: selectedTable.orientation,
        decimal_places: selectedTable.decimal_places,
        tolerance: selectedTable.tolerance,
        unit: selectedTable.unit,
      },
      previousRows: selectedTable.rows ? JSON.parse(JSON.stringify(selectedTable.rows)) : undefined,
    });

    let updatedCols = [...(selectedTable.columns || [])];
    let colsChanged = false;

    for (const ch of proposal.changes) {
      if (ch.type === "UPDATE_COLUMN_FORMULA" && ch.targetId && ch.after) {
        updatedCols = updatedCols.map((c) =>
          c.id.toLowerCase() === ch.targetId!.toLowerCase() ? { ...c, formula: ch.after, formulaStatus: "VALIDATED" as const } : c
        );
        colsChanged = true;
      } else if (ch.type === "UPDATE_TABLE_SETTINGS" && ch.after && onUpdateTableBlock) {
        onUpdateTableBlock(selectedTable.id, ch.after);
      } else if (ch.type === "ADD_COLUMN" && ch.columnDef) {
        const colDef = ch.columnDef;
        const exists = updatedCols.some((c) => c.id.toLowerCase() === colDef.id.toLowerCase());
        if (!exists) {
          updatedCols.push(colDef);
          colsChanged = true;
        }
      } else if (ch.type === "DELETE_COLUMN" && ch.targetId) {
        const targetIdLower = ch.targetId.toLowerCase();
        updatedCols = updatedCols.filter(
          (c) => c.id.toLowerCase() !== targetIdLower && c.label.toLowerCase() !== targetIdLower
        );
        colsChanged = true;
      }
    }

    if (colsChanged) {
      onUpdateTableColumns(selectedTable.id, updatedCols);
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );

    toast.success(`Applied: ${proposal.summary}`);

    const confirmMsg: ChatMessage = {
      id: `applied_${Date.now()}`,
      role: "assistant",
      sender: "assistant",
      content: `✅ Successfully applied: **${proposal.summary}** to table **${selectedTable.title}**.\n\nAll changes have been safely applied to the visual template. You can click **Undo** at any time to rollback.`,
      text: `✅ Successfully applied: **${proposal.summary}** to table **${selectedTable.title}**.\n\nAll changes have been safely applied to the visual template. You can click **Undo** at any time to rollback.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  const handleRejectProposal = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionRejected: true } : m))
    );
    toast.info("Proposal cancelled");
  };

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    if (/^\s*(undo|revert|rollback)\s*$/i.test(query)) {
      if (historyStack.length > 0) {
        handleUndo();
        if (!textToSend) setInput("");
        return;
      } else {
        const noUndoMsg: ChatMessage = {
          id: `undo_empty_${Date.now()}`,
          role: "assistant",
          sender: "assistant",
          content: "Nothing to undo. There are no recent actions on the undo stack.",
          text: "Nothing to undo. There are no recent actions on the undo stack.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, noUndoMsg]);
        if (!textToSend) setInput("");
        return;
      }
    }

    const activeAttachments = [...attachments];

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      sender: "user",
      content: query,
      text: query,
      attachments: activeAttachments.length > 0 ? activeAttachments : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) {
      setInput("");
      setAttachments([]);
    }
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Build conversation turns for context
      const contextMessages = messages.concat(userMsg).map((m) => ({
        role: (m.sender === "user" || m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content || m.text || "",
      }));

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

      const latestPendingProposal = [...messages]
        .reverse()
        .find((m) => m.changeProposal && !m.actionApplied && !m.actionRejected)?.changeProposal || null;

      const res = await askTemplateAssistant(query, {
        templateName,
        instrumentType,
        calibrationType,
        selectedTableTitle: selectedTable?.title,
        selectedTableId: selectedTable?.id,
        selectedColumnId: selectedColumnId || undefined,
        selectedTableBlock: selectedTable || undefined,
        blocks,
        columns: currentColumns,
        tablesSummary,
        messages: contextMessages,
        attachments: activeAttachments.length > 0 ? activeAttachments : undefined,
        pendingProposal: latestPendingProposal,
      });

      if (res.action === "NAVIGATE_BUILDER" && res.actionPayload?.columnId) {
        if (onNavigateToColumn) onNavigateToColumn(res.actionPayload.columnId);
        toast.info(`Selected column: ${res.actionPayload.columnId}`);
      }

      let proposals: ProposalItem[] | undefined;
      if (res.action === "FIX_FORMULA" && res.actionPayload?.columnId && res.actionPayload?.formula) {
        const tgtCol = currentColumns.find((c) => c.id === res.actionPayload?.columnId);
        proposals = [
          {
            columnId: res.actionPayload.columnId,
            columnLabel: tgtCol?.label || res.actionPayload.columnId,
            before: tgtCol?.formula || "(none)",
            after: res.actionPayload.formula,
            reason: res.actionPayload.reason || "Recommended by assistant",
            confidence: res.actionPayload.confidence || "HIGH",
          },
        ];
      } else if (res.action === "FIX_TABLE" && res.actionPayload?.columnUpdates) {
        proposals = res.actionPayload.columnUpdates.map((cu) => ({
          columnId: cu.columnId,
          columnLabel: cu.columnLabel || cu.columnId,
          before: cu.before || "(none)",
          after: cu.after,
          reason: cu.reason || "Canonical metrology formula alignment.",
          confidence: "HIGH",
        }));
      }

      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        sender: "assistant",
        content: res.reply,
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        proposedAction: res.action,
        actionPayload: res.actionPayload,
        changeProposal: res.canonicalProposal,
        proposals,
        suggestions: res.suggestions,
        engineSource: res.engineSource || "cloud_gemini",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          role: "assistant",
          sender: "assistant",
          content: `Error processing request: ${err.message || "Failed to process request."}`,
          text: `Error processing request: ${err.message || "Failed to process request."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 1. Execute single proposed formula change
  const handleApplySingleProposal = (msgId: string, proposal: ProposalItem) => {
    if (!selectedTable) return;
    pushToHistory({
      tableId: selectedTable.id,
      description: `Fix formula on column "${proposal.columnLabel}"`,
      messageId: msgId,
      previousColumns: JSON.parse(JSON.stringify(selectedTable.columns)),
    });

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
    toast.success(`Applied formula to "${proposal.columnLabel}"`);
  };

  // 2. Execute all proposed formula changes
  const handleApplyAllProposals = (msgId: string, proposals: ProposalItem[]) => {
    if (!selectedTable) return;
    pushToHistory({
      tableId: selectedTable.id,
      description: `Fix all ${proposals.length} formulas in "${selectedTable.title}"`,
      messageId: msgId,
      previousColumns: JSON.parse(JSON.stringify(selectedTable.columns)),
    });

    const proposalMap = new Map(proposals.map((p) => [p.columnId, p]));
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
    toast.success(`Applied all ${proposals.length} formula fixes`);
  };

  // 3. Execute Table Settings Update (Orientation, Decimal Places, Tolerance, Unit)
  const handleApplyTableSettings = (msgId: string, settings: NonNullable<AssistantActionPayload["tableSettings"]>) => {
    if (!selectedTable || !onUpdateTableBlock) return;
    pushToHistory({
      tableId: selectedTable.id,
      description: `Update table settings (${Object.keys(settings).join(", ")})`,
      messageId: msgId,
      previousTableSettings: {
        orientation: selectedTable.orientation,
        decimal_places: selectedTable.decimal_places,
        tolerance: selectedTable.tolerance,
        unit: selectedTable.unit,
      },
    });

    onUpdateTableBlock(selectedTable.id, settings);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );
    toast.success("Applied table settings update");
  };

  // 4. Execute Add Column
  const handleApplyAddColumn = (msgId: string, newCol: CanvasColumnDef) => {
    if (!selectedTable) return;
    pushToHistory({
      tableId: selectedTable.id,
      description: `Add column "${newCol.label}"`,
      messageId: msgId,
      previousColumns: JSON.parse(JSON.stringify(selectedTable.columns)),
    });

    if (onAddTableColumn) {
      onAddTableColumn(selectedTable.id, newCol);
    } else {
      onUpdateTableColumns(selectedTable.id, [...(selectedTable.columns || []), newCol]);
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );
    toast.success(`Added column "${newCol.label}" to table`);
  };

  // 4b. Execute Remove Column
  const handleApplyDeleteColumn = (msgId: string, columnId: string) => {
    if (!selectedTable) return;
    pushToHistory({
      tableId: selectedTable.id,
      description: `Remove column "${columnId}"`,
      messageId: msgId,
      previousColumns: JSON.parse(JSON.stringify(selectedTable.columns)),
    });

    if (onDeleteTableColumn) {
      onDeleteTableColumn(selectedTable.id, columnId);
    } else {
      const updatedCols = (selectedTable.columns || []).filter(
        (c) => c.id.toLowerCase() !== columnId.toLowerCase() && c.label.toLowerCase() !== columnId.toLowerCase()
      );
      onUpdateTableColumns(selectedTable.id, updatedCols);
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );
    toast.success(`Removed column "${columnId}" from table`);
  };

  // 4c. Execute Create Table
  const handleApplyCreateTable = (msgId: string, newTable?: Partial<TableGridBlock>) => {
    if (!onAddTableBlock) return;
    const created = onAddTableBlock(newTable);
    pushToHistory({
      tableId: (created as any)?.id || "new_table",
      createdTableId: (created as any)?.id,
      description: `Create table "${newTable?.title || "New Table"}"`,
      messageId: msgId,
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );
    toast.success(`Created table "${newTable?.title || "New Table"}"`);
  };

  // 4d. Execute Delete Table
  const handleApplyDeleteTable = (msgId: string, tableId?: string) => {
    const targetTableId = tableId || selectedTable?.id;
    if (!targetTableId || !onDeleteTableBlock) return;

    // Resolve the target table (check selectedTable, top-level table blocks, and split-row children)
    let targetTable: TableGridBlock | null = selectedTable?.id === targetTableId ? selectedTable : null;
    if (!targetTable) {
      for (const b of blocks) {
        if (b.type === "table_grid" && b.id === targetTableId) {
          targetTable = b;
          break;
        }
        if (b.type === "split_row" && b.children) {
          const childTable = b.children.find(
            (c): c is TableGridBlock => c.type === "table_grid" && c.id === targetTableId
          );
          if (childTable) {
            targetTable = childTable;
            break;
          }
        }
      }
    }

    pushToHistory({
      tableId: targetTableId,
      description: `Delete table "${targetTable?.title || targetTableId}"`,
      messageId: msgId,
      deletedTable: targetTable ? JSON.parse(JSON.stringify(targetTable)) : undefined,
    });

    onDeleteTableBlock(targetTableId);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );
    toast.info(`Deleted table`);
  };

  // 5. Execute Parsed Specification -> Update Table Rows
  const handleApplyParsedSpec = (msgId: string, spec: NonNullable<AssistantActionPayload["parsedSpec"]>) => {
    if (!selectedTable || !onUpdateTableRows) return;
    pushToHistory({
      tableId: selectedTable.id,
      description: `Apply specification "${spec.specificationText}"`,
      messageId: msgId,
      previousRows: JSON.parse(JSON.stringify(selectedTable.rows)),
      previousTableSettings: spec.decimalPrecision ? { decimal_places: selectedTable.decimal_places } : undefined,
    });

    const updatedRows = selectedTable.rows.map((row) => ({
      ...row,
      nominal: spec.nominal,
      lowerTolerance: spec.lowerTolerance,
      upperTolerance: spec.upperTolerance,
      lowerLimit: spec.lowerLimit,
      upperLimit: spec.upperLimit,
      unit: spec.unit,
    }));

    onUpdateTableRows(selectedTable.id, updatedRows);

    if (onUpdateTableBlock && spec.decimalPrecision) {
      onUpdateTableBlock(selectedTable.id, { decimal_places: spec.decimalPrecision });
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionApplied: true } : m))
    );
    toast.success(`Applied specification "${spec.specificationText}" to rows`);
  };

  const thinkingMessages = [
    "Analyzing column AST and metrology semantics...",
    "Validating against ISO/IEC 17025 boundary invariants...",
    "Checking deterministic calculation engine rules...",
    "Synthesizing authoritative recommendation...",
  ];

  const getContainerStyle = (): React.CSSProperties | undefined => {
    if (docked) return undefined;
    const style: React.CSSProperties = {};
    if (position) {
      style.left = `${position.x}px`;
      style.top = `${position.y}px`;
      style.right = "auto";
      style.bottom = "auto";
    }
    if (!minimized && customSize) {
      style.width = `${customSize.width}px`;
      style.height = `${customSize.height}px`;
    }
    if (isDraggingWindow || isResizing) {
      style.transition = "none";
      style.userSelect = "none";
    }
    return style;
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Gaugemaster Template Assistant"
      style={getContainerStyle()}
      className={
        docked
          ? "w-full h-full flex flex-col bg-slate-50/70 dark:bg-slate-950/40 border-l border-border/80 rounded-none overflow-hidden relative shadow-md"
          : `fixed z-50 ${
              !position ? "bottom-4 right-4" : ""
            } ${
              minimized
                ? "w-[360px] h-16 cursor-pointer transition-all duration-200"
                : expandedMode && !customSize
                ? "w-[840px] max-w-[95vw] h-[780px] max-h-[92vh] flex flex-col bg-card text-foreground border border-border/90 rounded-2xl shadow-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all duration-200"
                : !customSize
                ? "w-[490px] max-w-[92vw] h-[670px] max-h-[88vh] flex flex-col bg-card text-foreground border border-border/90 rounded-2xl shadow-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all duration-200"
                : "flex flex-col bg-card text-foreground border border-border/90 rounded-2xl shadow-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
            }`
      }
    >
      {/* ========================================================================= */}
      {/* MINIMIZED STATE: SLEEK DARK CAPSULE WITH GLOW & LIVE ANIMATION            */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MINIMIZED STATE: SLEEK CAPSULE WITH LIVE STATUS                            */}
      {/* ========================================================================= */}
      {minimized && !docked ? (
        <div
          onClick={() => setMinimized(false)}
          onMouseDown={handleHeaderMouseDown}
          onTouchStart={handleHeaderTouchStart}
          className="w-full h-full p-3 px-4 rounded-2xl bg-card text-foreground border border-border/80 hover:border-primary/50 shadow-xl backdrop-blur-md flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 group select-none cursor-grab active:cursor-grabbing"
          title="Drag to move, or click to restore Template Copilot"
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="overflow-hidden">
              <span className="font-semibold text-xs text-foreground tracking-tight flex items-center gap-1">
                Template Copilot
              </span>
              <span className="text-[10.5px] text-muted-foreground block truncate max-w-[170px]">
                {selectedTable?.title || "Calibration Intelligence"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMinimized(false)}
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Restore Copilot"
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Close Copilot"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* EXPANDED STATE: FULL INTELLIGENCE ASSISTANT WINDOW                        */
        /* ========================================================================= */
        <>
          {/* Header (Claude/ChatGPT Minimalist Clean Title Bar) */}
          <div
            onMouseDown={handleHeaderMouseDown}
            onTouchStart={handleHeaderTouchStart}
            className={`px-4 py-2.5 bg-background/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between shrink-0 shadow-2xs ${
              !docked ? "cursor-grab active:cursor-grabbing select-none" : ""
            }`}
          >
            {/* Left: AI Identity & Active Context */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-primary/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-xs text-foreground tracking-tight truncate">
                    Template Copilot
                  </span>
                  <AiConnectionBadge compact className="ml-0.5" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 font-medium truncate">
                  <TableIcon className="w-3 h-3 text-primary/80 shrink-0" />
                  <span className="truncate max-w-[190px] sm:max-w-[280px]">
                    {selectedTable?.title || templateName || "Calibration Template Intelligence"}
                  </span>
                </div>
              </div>
              {!docked && (
                <div
                  className="hidden sm:flex items-center ml-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                  title="Click and drag anywhere on header to move"
                >
                  <GripHorizontal className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {/* Right: Window & Session Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {historyStack.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  className="h-7 px-2 text-[10.5px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20 flex items-center gap-1 cursor-pointer rounded-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-1"
                  title={`Undo last action (${historyStack[historyStack.length - 1].description})`}
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Undo</span>
                </Button>
              )}

              {/* Clear / New Conversation Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClearChat}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                title="New Chat / Clear Conversation"
                aria-label="New Chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>

              {/* Dock / Undock Toggle */}
              {onToggleDock && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleDock}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  title={docked ? "Float Assistant" : "Dock to Side Panel"}
                  aria-label={docked ? "Float Assistant" : "Dock to Side Panel"}
                >
                  {docked ? (
                    <PanelRight className="w-3.5 h-3.5" />
                  ) : (
                    <PanelRightClose className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}

              {/* Minimize (when floating) */}
              {!docked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMinimized(true);
                  }}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  title="Minimize"
                  aria-label="Minimize"
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
              )}

              {/* Maximize / Restore (when floating) */}
              {!docked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomSize(null);
                    setExpandedMode(!expandedMode);
                  }}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  title={expandedMode ? "Restore Down" : "Maximize"}
                  aria-label={expandedMode ? "Restore Down" : "Maximize"}
                >
                  {expandedMode ? (
                    <Copy className="w-3 h-3" />
                  ) : (
                    <Square className="w-3 h-3" />
                  )}
                </Button>
              )}

              {/* Close Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
                title="Close Copilot"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={scrollRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 text-xs bg-slate-50/70 dark:bg-slate-950/40 relative selection:bg-primary/20 scroll-smooth"
          >
            {isDragging && (
              <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl flex flex-col items-center justify-center p-6 pointer-events-none">
                <Upload className="w-8 h-8 text-primary animate-bounce mb-2" />
                <p className="font-semibold text-xs text-foreground">Drop calibration files here</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Excel (.xlsx), Technical Drawing (.png), PDF, Word</p>
              </div>
            )}

            {/* Empty State / Welcome Hero (ChatGPT & Claude Style) */}
            {messages.length <= 1 ? (
              <div className="py-8 px-2 flex flex-col items-center text-center space-y-5 max-w-lg mx-auto">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary via-indigo-600 to-violet-600 text-white border border-primary/20 flex items-center justify-center shadow-md">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-background"></span>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground tracking-tight">
                    Gaugemaster Template Copilot
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Authoritative ISO/IEC 17025 metrology intelligence, automated formula AST validation, and calibration template authoring.
                  </p>
                  {selectedTable && (
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium shadow-2xs">
                        <TableIcon className="w-3.5 h-3.5" />
                        <span>Ready to assist with "{selectedTable.title || "Active Table"}"</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* 4 Interactive Starter Prompt Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-1 text-left">
                  <button
                    type="button"
                    onClick={() => sendMessage("Audit this table")}
                    className="p-3.5 rounded-2xl border border-border/80 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary bg-card hover:bg-muted/40 text-left transition-all cursor-pointer group shadow-2xs hover:shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <span>Audit Table Formulas</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal pl-8">
                      Validate AVG, error deviations, and PASS/FAIL tolerances
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage("Check and fix formula errors in this table")}
                    className="p-3.5 rounded-2xl border border-border/80 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary bg-card hover:bg-muted/40 text-left transition-all cursor-pointer group shadow-2xs hover:shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Wand2 className="w-3.5 h-3.5" />
                      </div>
                      <span>Fix Calculation Errors</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal pl-8">
                      Diagnose formula syntax issues and automatically repair them
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage("Parse specification Shaft Ø35.035 -0.02/-0.01")}
                    className="p-3.5 rounded-2xl border border-border/80 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary bg-card hover:bg-muted/40 text-left transition-all cursor-pointer group shadow-2xs hover:shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </div>
                      <span>Parse Engineering Spec</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal pl-8">
                      Extract nominals, bilateral limits, and decimal precision
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage("Can I save this template?")}
                    className="p-3.5 rounded-2xl border border-border/80 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary bg-card hover:bg-muted/40 text-left transition-all cursor-pointer group shadow-2xs hover:shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span>Pre-Save Quality Gate</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal pl-8">
                      Run 12-point calibration certification readiness check
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              /* Conversation Stream */
              messages
                .filter((msg) => !msg.id.startsWith("initial"))
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 group relative ${
                      msg.sender === "user" || msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Assistant Message (Claude / ChatGPT Unboxed Natural Canvas Flow) */}
                    {(msg.sender === "assistant" || msg.role === "assistant") ? (
                      <div className="flex items-start gap-2.5 max-w-[96%] w-full">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary via-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <Sparkles className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Assistant Header: Model Source & Timestamp */}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-medium">
                              {msg.engineSource === "cloud_gemini" ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[10.5px] font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  Gemini Cloud AI
                                </span>
                              ) : msg.engineSource === "local_deterministic" ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10.5px] font-semibold">
                                  <Cpu className="w-3 h-3 text-muted-foreground" />
                                  Local Metrology Engine
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25 text-[10.5px] font-semibold">
                                  <Sparkles className="w-3 h-3 text-primary" />
                                  Template Copilot
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono opacity-70">{msg.timestamp}</span>
                          </div>

                      {/* Main Markdown Body */}
                      <div className="text-foreground leading-relaxed text-xs">
                        <FormattedAssistantMessage
                          text={msg.content || msg.text || ""}
                          auditSummary={msg.auditSummary}
                          onCopyFormula={handleFormulaApplyFromMarkdown}
                          onSelectSuggestion={(sug) => sendMessage(sug)}
                        />
                      </div>

                      {/* ========================================================================= */}
                      {/* CANONICAL CHANGE PROPOSAL ARTIFACT (Section 10)                           */}
                      {/* ========================================================================= */}
                      {msg.changeProposal && (
                        <div className="mt-3 rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs overflow-hidden">
                          <div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/60 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>{msg.changeProposal.summary}</span>
                            </div>
                            <Badge variant="outline" className="text-[9px] font-mono bg-background border-border/80">
                              {msg.changeProposal.intent}
                            </Badge>
                          </div>

                          <div className="p-3 space-y-2.5">
                            {/* Quality & Validation Badge */}
                            <div className="flex flex-wrap items-center gap-2 text-[10px] px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/60 text-muted-foreground">
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <Check className="w-3 h-3" /> Formula AST Validated
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <ShieldCheck className="w-3 h-3" /> ISO 17025 Metrology Gate Passed
                              </span>
                            </div>

                            {/* Comparison Table Format */}
                            <div className="overflow-x-auto rounded-lg border border-border/70 bg-background shadow-2xs">
                              <table className="w-full text-[10.5px] text-left border-collapse">
                                <thead>
                                  <tr className="bg-muted/50 text-muted-foreground border-b border-border/70 font-semibold">
                                    <th className="py-2 px-3">Area</th>
                                    <th className="py-2 px-3">Current Template</th>
                                    <th className="py-2 px-3">Proposed Update</th>
                                    <th className="py-2 px-2.5 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                  {msg.changeProposal.changes.map((ch, chIdx) => (
                                    <tr key={chIdx} className="hover:bg-muted/30 transition-colors">
                                      <td className="py-2 px-3 font-medium text-foreground">
                                        {ch.columnDef?.label || ch.targetId || ch.type.replace(/_/g, " ")}
                                      </td>
                                      <td className="py-2 px-3 font-mono text-muted-foreground truncate max-w-[120px]">
                                        {ch.before !== undefined ? String(ch.before) : "—"}
                                      </td>
                                      <td className="py-2 px-3 font-mono text-primary font-semibold truncate max-w-[140px]">
                                        {ch.after !== undefined ? String(ch.after) : ch.columnDef?.formula || "Mapped"}
                                      </td>
                                      <td className="py-2 px-2.5 text-center">
                                        <span className="inline-block px-2 py-0.5 rounded text-[9.5px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                          {ch.type === "UPDATE_COLUMN_FORMULA" ? "Validated" : ch.type === "UPDATE_TABLE_SETTINGS" ? "Updated" : "Match"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Information Callout Box */}
                            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-foreground flex items-start gap-2 leading-relaxed">
                              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <span>
                                  {msg.changeProposal.summary ||
                                    `The proposed changes modify ${msg.changeProposal.changes.length} element(s). All specifications and formulas will be automatically mapped to your Visual Canvas.`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Confirmation Actions */}
                          <div className="px-3.5 py-2.5 bg-muted/20 border-t border-border/60 flex items-center justify-between">
                            {!msg.actionApplied && !msg.actionRejected ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleApplyCanonicalProposal(msg.id, msg.changeProposal!)}
                                  className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center gap-1.5 cursor-pointer shadow-xs rounded-lg"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Apply Changes
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    toast.info(`Reviewing ${msg.changeProposal!.changes.length} proposed changes against canvas.`);
                                  }}
                                  className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
                                >
                                  Review Details
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRejectProposal(msg.id)}
                                  className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : msg.actionApplied ? (
                              <div className="flex items-center justify-between w-full text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <CheckCheck className="w-4 h-4" /> Changes Applied to Template
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleUndo}
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 rounded-md"
                                >
                                  <Undo2 className="w-3 h-3" /> Undo
                                </Button>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">Proposal cancelled</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 1: FORMULA CHANGES                                   */}
                      {/* ========================================================================= */}
                      {!msg.changeProposal && msg.proposals && msg.proposals.length > 0 && (
                        <div className="mt-3 space-y-2 text-foreground">
                          {msg.proposals.map((prop) => (
                            <div
                              key={prop.columnId}
                              className="p-3 rounded-xl border border-amber-300/70 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/20 space-y-2 shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  {prop.columnLabel}{" "}
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    ({prop.columnId})
                                  </span>
                                </span>
                                {prop.confidence && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] bg-background text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                  >
                                    {prop.confidence}
                                  </Badge>
                                )}
                              </div>

                              <div className="text-xs space-y-1 font-mono">
                                <div className="text-muted-foreground flex items-center gap-1.5">
                                  <span className="w-12 shrink-0 font-sans text-[11px]">Before:</span>
                                  <code className="bg-background px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground break-all flex-1">
                                    {prop.before}
                                  </code>
                                </div>
                                <div className="text-primary font-bold flex items-center gap-1.5">
                                  <span className="w-12 shrink-0 text-amber-900 dark:text-amber-200 font-sans text-[11px]">
                                    Proposed:
                                  </span>
                                  <code className="bg-background px-1.5 py-0.5 rounded border border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200 break-all flex-1">
                                    {prop.after}
                                  </code>
                                </div>
                              </div>

                              <p className="text-[11px] text-amber-800 dark:text-amber-300 italic leading-tight">
                                "{prop.reason}"
                              </p>

                              {!msg.actionApplied && (
                                <div className="flex items-center gap-1.5 pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleApplySingleProposal(msg.id, prop)}
                                    className="h-6 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1 cursor-pointer rounded-lg shadow-2xs"
                                  >
                                    <Check className="w-3 h-3" />
                                    Apply Change
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}

                          {msg.proposals.length > 1 && !msg.actionApplied && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleApplyAllProposals(msg.id, msg.proposals!)}
                              className="w-full h-7 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                              Apply All Changes ({msg.proposals.length} columns)
                            </Button>
                          )}

                          {msg.actionApplied && (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Changes Applied. (Click Undo in header to revert if needed)
                            </div>
                          )}
                        </div>
                      )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 2: TABLE SETTINGS                                     */}
                      {/* ========================================================================= */}
                      {!msg.changeProposal &&
                        msg.proposedAction === "UPDATE_TABLE_SETTINGS" &&
                        msg.actionPayload?.tableSettings && (
                          <div className="mt-3 p-3 rounded-xl border border-border/80 bg-card space-y-2 text-foreground shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-primary" />
                                Table Settings Proposal
                              </span>
                              <Badge variant="outline" className="text-[9px] bg-background">
                                PROPOSED
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              {msg.actionPayload.tableSettings.orientation && (
                                <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                                  <span className="text-muted-foreground block text-[10px]">Orientation</span>
                                  <span className="font-semibold capitalize text-foreground">
                                    {msg.actionPayload.tableSettings.orientation}
                                  </span>
                                </div>
                              )}
                              {msg.actionPayload.tableSettings.decimal_places !== undefined && (
                                <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                                  <span className="text-muted-foreground block text-[10px]">Decimal Places</span>
                                  <span className="font-semibold text-foreground">
                                    {msg.actionPayload.tableSettings.decimal_places} decimals
                                  </span>
                                </div>
                              )}
                              {msg.actionPayload.tableSettings.tolerance !== undefined && (
                                <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                                  <span className="text-muted-foreground block text-[10px]">Tolerance</span>
                                  <span className="font-semibold text-foreground">
                                    ±{msg.actionPayload.tableSettings.tolerance}
                                  </span>
                                </div>
                              )}
                              {msg.actionPayload.tableSettings.unit && (
                                <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                                  <span className="text-muted-foreground block text-[10px]">Unit</span>
                                  <span className="font-semibold text-foreground">
                                    {msg.actionPayload.tableSettings.unit}
                                  </span>
                                </div>
                              )}
                            </div>

                            {!msg.actionApplied && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  handleApplyTableSettings(msg.id, msg.actionPayload!.tableSettings!)
                                }
                                className="w-full h-7 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Apply Table Settings
                              </Button>
                            )}

                            {msg.actionApplied && (
                              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Table Settings Applied.
                              </div>
                            )}
                          </div>
                        )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 3: ADD COLUMN                                        */}
                      {/* ========================================================================= */}
                      {!msg.changeProposal &&
                        msg.proposedAction === "ADD_COLUMN" &&
                        msg.actionPayload?.newColumn && (
                        <div className="mt-3 p-3 rounded-xl border border-border/80 bg-card space-y-2 text-foreground shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-primary" />
                              New Column Proposal: {msg.actionPayload.newColumn.label}
                            </span>
                            <Badge variant="outline" className="text-[9px] bg-background">
                              {msg.actionPayload.newColumn.type}
                            </Badge>
                          </div>

                          <div className="text-xs space-y-1 font-mono">
                            <div className="text-muted-foreground flex items-center gap-1.5">
                              <span className="w-16 shrink-0 font-sans text-[11px]">Role:</span>
                              <span className="font-semibold text-foreground font-sans">
                                {msg.actionPayload.newColumn.role || "CALCULATED"}
                              </span>
                            </div>
                            {msg.actionPayload.newColumn.formula && (
                              <div className="text-primary font-bold flex items-center gap-1.5">
                                <span className="w-16 shrink-0 font-sans text-muted-foreground text-[11px]">Formula:</span>
                                <code className="bg-background px-1.5 py-0.5 rounded border border-primary/40 text-primary break-all flex-1">
                                  {msg.actionPayload.newColumn.formula}
                                </code>
                              </div>
                            )}
                          </div>

                          {!msg.actionApplied && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                handleApplyAddColumn(msg.id, msg.actionPayload!.newColumn!)
                              }
                              className="w-full h-7 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Add Column to Table
                            </Button>
                          )}

                          {msg.actionApplied && (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Column Added to Table.
                            </div>
                          )}
                        </div>
                      )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 3B: REMOVE COLUMN                                    */}
                      {/* ========================================================================= */}
                      {!msg.changeProposal &&
                        msg.proposedAction === "REMOVE_COLUMN" &&
                        msg.actionPayload?.removeColumnId && (
                        <div className="mt-3 p-3 rounded-xl border border-destructive/40 bg-destructive/5 space-y-2 text-foreground shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs flex items-center gap-1.5 text-destructive">
                              <X className="w-3.5 h-3.5" />
                              Remove Column: {msg.actionPayload.removeColumnId}
                            </span>
                            <Badge variant="outline" className="text-[9px] bg-background text-destructive border-destructive/30">
                              ALTER TABLE
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Remove column <strong>"{msg.actionPayload.removeColumnId}"</strong> from table <strong>{selectedTable?.title || "Active Table"}</strong>.
                          </p>
                          {!msg.actionApplied && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleApplyDeleteColumn(msg.id, msg.actionPayload!.removeColumnId!)}
                              className="w-full h-7 text-xs font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Remove Column from Table
                            </Button>
                          )}
                          {msg.actionApplied && (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Column Removed.
                            </div>
                          )}
                        </div>
                      )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 3C: CREATE TABLE                                     */}
                      {/* ========================================================================= */}
                      {!msg.changeProposal && msg.proposedAction === "CREATE_TABLE" && (
                        <div className="mt-3 p-3 rounded-xl border border-border/80 bg-card space-y-2 text-foreground shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                              <TableIcon className="w-3.5 h-3.5 text-primary" />
                              Create New Table: {msg.actionPayload?.newTable?.title || "Calibration Table"}
                            </span>
                            <Badge variant="outline" className="text-[9px] bg-background">
                              NEW TABLE
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Ready to create a new calibration table with default ISO 17025 columns and formula structures.
                          </p>
                          {!msg.actionApplied && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleApplyCreateTable(msg.id, msg.actionPayload?.newTable)}
                              className="w-full h-7 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Create Table in Canvas
                            </Button>
                          )}
                          {msg.actionApplied && (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Table Created in Canvas.
                            </div>
                          )}
                        </div>
                      )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 3D: DELETE TABLE                                     */}
                      {/* ========================================================================= */}
                      {!msg.changeProposal && msg.proposedAction === "DELETE_TABLE" && (
                        <div className="mt-3 p-3 rounded-xl border border-destructive/40 bg-destructive/5 space-y-2 text-foreground shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs flex items-center gap-1.5 text-destructive">
                              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                              Delete Table: {selectedTable?.title || "Active Table"}
                            </span>
                            <Badge variant="outline" className="text-[9px] bg-background text-destructive border-destructive/30">
                              DELETE TABLE
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            This action will delete table <strong>"{selectedTable?.title || "Active Table"}"</strong> from the template.
                          </p>
                          {!msg.actionApplied && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleApplyDeleteTable(msg.id, msg.actionPayload?.deleteTableId)}
                              className="w-full h-7 text-xs font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Confirm Delete Table
                            </Button>
                          )}
                          {msg.actionApplied && (
                            <div className="p-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5" />
                              Table Deleted.
                            </div>
                          )}
                        </div>
                      )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 4: PARSED SPECIFICATION                              */}
                      {/* ========================================================================= */}
                      {msg.proposedAction === "PARSE_SPECIFICATION" && msg.actionPayload?.parsedSpec && (
                        <div className="mt-3 p-3 rounded-xl border border-border/80 bg-card space-y-2 text-foreground shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs flex items-center gap-1.5">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                              Parsed Metrology Specification
                            </span>
                            <Badge variant="outline" className="text-[9px] bg-background">
                              {msg.actionPayload.parsedSpec.decimalPrecision} DEC
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                              <span className="text-muted-foreground block text-[10px]">Nominal</span>
                              <span className="font-semibold text-foreground">
                                {msg.actionPayload.parsedSpec.nominal} {msg.actionPayload.parsedSpec.unit}
                              </span>
                            </div>
                            <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                              <span className="text-muted-foreground block text-[10px]">Tolerance Range</span>
                              <span className="font-semibold text-foreground">
                                {msg.actionPayload.parsedSpec.lowerTolerance >= 0 ? "+" : ""}
                                {msg.actionPayload.parsedSpec.lowerTolerance} /{" "}
                                {msg.actionPayload.parsedSpec.upperTolerance >= 0 ? "+" : ""}
                                {msg.actionPayload.parsedSpec.upperTolerance}
                              </span>
                            </div>
                            <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                              <span className="text-muted-foreground block text-[10px]">Lower Limit</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {msg.actionPayload.parsedSpec.lowerLimit} {msg.actionPayload.parsedSpec.unit}
                              </span>
                            </div>
                            <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                              <span className="text-muted-foreground block text-[10px]">Upper Limit</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {msg.actionPayload.parsedSpec.upperLimit} {msg.actionPayload.parsedSpec.unit}
                              </span>
                            </div>
                          </div>

                          {!msg.actionApplied && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                handleApplyParsedSpec(msg.id, msg.actionPayload!.parsedSpec!)
                              }
                              className="w-full h-7 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Apply Specification to Rows
                            </Button>
                          )}

                          {msg.actionApplied && (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Specification Applied to Rows.
                            </div>
                          )}
                        </div>
                      )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 5: VIRTUAL TRIAL RUN SIMULATION                      */}
                      {/* ========================================================================= */}
                      {msg.proposedAction === "SIMULATE_TRIAL_RUN" &&
                        msg.actionPayload?.simulationResult && (
                          <div className="mt-3 p-3 rounded-xl border border-border/80 bg-card space-y-2 text-foreground shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs flex items-center gap-1.5">
                                <Play className="w-3.5 h-3.5 text-primary" />
                                Virtual Reading Verdict
                              </span>
                              <Badge
                                className={`text-[10px] font-semibold ${
                                  msg.actionPayload.simulationResult.status === "PASS"
                                    ? "bg-emerald-600 text-white"
                                    : "bg-destructive text-destructive-foreground"
                                }`}
                              >
                                {msg.actionPayload.simulationResult.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
                              <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Nominal</span>
                                <span className="font-semibold">{msg.actionPayload.simulationResult.nominal}</span>
                              </div>
                              <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Reading</span>
                                <span className="font-semibold text-primary">
                                  {msg.actionPayload.simulationResult.reading}
                                </span>
                              </div>
                              <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Deviation</span>
                                <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                                  {msg.actionPayload.simulationResult.deviation}
                                </span>
                              </div>
                            </div>

                            {onOpenTrialRun && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={onOpenTrialRun}
                                className="w-full h-7 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Open Full Interactive Trial Run Modal
                              </Button>
                            )}
                          </div>
                        )}

                      {/* ========================================================================= */}
                      {/* CHANGE PROPOSAL CARD 6: PRE-SAVE QUALITY GATE                             */}
                      {/* ========================================================================= */}
                      {msg.proposedAction === "VALIDATE_PRE_SAVE" && msg.actionPayload?.preSaveAudit && (
                        <div className="mt-3 p-3 rounded-xl border border-border/80 bg-card space-y-2 text-foreground shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                              Pre-Save Quality Gate Results
                            </span>
                            <Badge
                              className={`text-[9.5px] font-semibold ${
                                msg.actionPayload.preSaveAudit.canSaveProduction
                                  ? "bg-emerald-600 text-white"
                                  : "bg-amber-600 text-white"
                              }`}
                            >
                              {msg.actionPayload.preSaveAudit.canSaveProduction
                                ? "READY FOR PRODUCTION"
                                : "REVIEW REQUIRED"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
                            <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                              <span className="text-muted-foreground block text-[9.5px]">Passed</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {msg.actionPayload.preSaveAudit.passedCount} /{" "}
                                {msg.actionPayload.preSaveAudit.totalChecks}
                              </span>
                            </div>
                            <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                              <span className="text-muted-foreground block text-[9.5px]">Warnings</span>
                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                {msg.actionPayload.preSaveAudit.warningCount}
                              </span>
                            </div>
                            <div className="p-2 bg-muted/40 rounded-lg border border-border/60">
                              <span className="text-muted-foreground block text-[9.5px]">Errors</span>
                              <span
                                className={`font-semibold ${
                                  msg.actionPayload.preSaveAudit.errorCount > 0
                                    ? "text-destructive"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {msg.actionPayload.preSaveAudit.errorCount}
                              </span>
                            </div>
                          </div>

                          {onOpenPreSaveModal && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={onOpenPreSaveModal}
                              className="w-full h-7 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer rounded-lg"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                              View Detailed 12-Point Quality Checklist
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Proactive Follow-up Recommendation Cards (Claude Style) */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="pt-2.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span>Recommended next steps</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {msg.suggestions.map((sug, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => sendMessage(sug)}
                                className="group/chip w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-card hover:bg-primary/5 text-foreground hover:text-primary border border-border/80 hover:border-primary/40 text-xs font-medium transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70 group-hover/chip:bg-primary shrink-0 transition-colors" />
                                  <span className="truncate">{sug}</span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover/chip:text-primary group-hover/chip:translate-x-0.5 transition-all shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Assistant Bottom Hover Action Toolbar */}
                      {msg.id !== "initial" && !msg.id.startsWith("initial") && (
                        <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-muted-foreground">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyMessage(msg.content || msg.text || "", msg.id)}
                            className="h-6 px-2 text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md gap-1 cursor-pointer"
                            title="Copy response"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500 text-[10.5px] font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10.5px]">Copy</span>
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRetry}
                            className="h-6 px-2 text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md gap-1 cursor-pointer"
                            title="Retry last query"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span className="text-[10.5px]">Retry</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* User Message (ChatGPT / Claude Caliber Right-Aligned Bubble) */
                  <div className="flex flex-col items-end max-w-[85%] sm:max-w-[78%] space-y-1 group">
                    {/* Attached files preview chips */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-end mb-1">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card text-[10.5px] font-medium border border-border/80 text-foreground shadow-2xs"
                          >
                            <Paperclip className="w-3 h-3 text-primary" />
                            <span className="truncate max-w-[130px]">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* User Bubble */}
                    <div className="px-4 py-2.5 rounded-2xl rounded-tr-xs bg-primary text-primary-foreground text-xs font-medium leading-relaxed shadow-xs relative select-text">
                      {editingMessageId === msg.id ? (
                        <div className="space-y-2 min-w-[240px] text-foreground">
                          <Textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="text-xs bg-background text-foreground border border-border rounded-lg p-2 min-h-[55px] focus-visible:ring-1 focus-visible:ring-primary"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSaveEdit(msg.id)}
                              className="h-6 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                            >
                              Update & Send
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content || msg.text}</div>
                      )}
                    </div>

                    {/* User Hover Toolbar */}
                    <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <span className="font-mono text-[9px]">{msg.timestamp}</span>
                      {editingMessageId !== msg.id && (
                        <>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(msg)}
                            className="hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-0.5"
                            title="Edit query"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                            <span>Edit</span>
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.content || msg.text || "", msg.id)}
                            className="hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-0.5"
                            title="Copy query"
                          >
                            {copiedMessageId === msg.id ? (
                              <span className="text-emerald-500 font-semibold">Copied</span>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )))}

            {/* Thinking / Streaming Indicator */}
            {loading && (
              <div className="flex items-start gap-2.5 max-w-[96%]">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-primary/15 via-primary/10 to-indigo-500/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="space-y-1.5 py-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="font-medium animate-pulse">
                      {thinkingMessages[thinkingStage]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 pl-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".xlsx,.xls,.csv,.pdf,.docx,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFileSelect(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Quick Action Suggestion Ribbon */}
          <div className="px-3.5 py-2 bg-background/85 backdrop-blur-xs border-t border-border/70 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
            {suggestionPills.map((chip, idx) => {
              const IconComp = chip.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(chip.query)}
                  className="px-3 py-1.5 rounded-full bg-card hover:bg-muted/70 text-foreground/90 hover:text-foreground border border-border/80 hover:border-primary/50 transition-all flex items-center gap-1.5 shrink-0 font-medium cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  <IconComp className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Signature ChatGPT / Claude Floating Input Dock */}
          <div className="p-3 bg-background/95 backdrop-blur-md border-t border-border/80 shrink-0 space-y-1.5">
            <div className="rounded-2xl border border-border/80 bg-card shadow-xs hover:border-border/90 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 focus-within:shadow-md transition-all duration-200 p-2.5 space-y-1.5">
              {/* Context Pill & Attached File Chips inside Input Card */}
              {(attachments.length > 0 || selectedTable) && (
                <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1 border-b border-border/40">
                  {selectedTable && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10.5px] font-semibold shadow-2xs">
                      <TableIcon className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate max-w-[190px]">{selectedTable.title || "Active Table"}</span>
                      <span className="text-[9.5px] font-mono opacity-70">
                        ({selectedTable.columns?.length || 0} cols)
                      </span>
                    </div>
                  )}
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted border border-border text-[10px] text-foreground font-medium shadow-2xs"
                    >
                      <Paperclip className="w-2.5 h-2.5 text-primary" />
                      <span className="truncate max-w-[120px]">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer ml-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                        title="Remove attachment"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Auto-expanding Textarea */}
              <div className="relative flex items-center px-1">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Message Copilot or ask about formulas, ISO 17025, tables..."
                  className="w-full bg-transparent resize-none overflow-y-auto text-xs sm:text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 leading-relaxed py-1 min-h-[32px] max-h-[140px]"
                />
              </div>

              {/* Bottom Controls Row inside Input Card */}
              <div className="flex items-center justify-between pt-1 px-1 border-t border-border/40 text-[11px]">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    title="Attach Excel, Drawing, PDF or Image"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground/60 hidden sm:inline select-none">
                    Shift + Enter for new line
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    disabled={!loading && !input.trim() && attachments.length === 0}
                    onClick={() => {
                      if (loading) {
                        handleStopGeneration();
                      } else {
                        sendMessage();
                      }
                    }}
                    className={`h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      loading
                        ? "bg-foreground text-background hover:bg-foreground/90 shadow-2xs active:scale-95"
                        : input.trim() || attachments.length > 0
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs active:scale-95"
                        : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                    }`}
                    aria-label={loading ? "Stop generating" : "Send message"}
                    title={loading ? "Stop generating" : "Send message"}
                  >
                    {loading ? (
                      <Square className="w-3 h-3 fill-current" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Disclaimer footer note */}
            <div className="text-center text-[10px] text-muted-foreground/60 select-none">
              Copilot can make mistakes. Verify critical metrology tolerances and ISO 17025 standards.
            </div>
          </div>

          {/* Edge & corner resize handles for width/height resizing */}
          {!docked && (
            <>
              {/* Right edge — width only */}
              <div
                onMouseDown={(e) => handleStartResize(e, "e")}
                className="absolute top-10 right-0 bottom-5 w-1.5 cursor-ew-resize z-20 group select-none hover:bg-primary/10 transition-colors"
                title="Drag to resize width"
              />
              {/* Left edge — width only */}
              <div
                onMouseDown={(e) => handleStartResize(e, "w")}
                className="absolute top-10 left-0 bottom-5 w-1.5 cursor-ew-resize z-20 group select-none hover:bg-primary/10 transition-colors"
                title="Drag to resize width"
              />
              {/* Bottom edge — height only */}
              <div
                onMouseDown={(e) => handleStartResize(e, "s")}
                className="absolute bottom-0 left-5 right-5 h-1.5 cursor-ns-resize z-20 group select-none hover:bg-primary/10 transition-colors"
                title="Drag to resize height"
              />
              {/* Bottom-right corner — full resize */}
              <div
                onMouseDown={(e) => handleStartResize(e, "se")}
                className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 z-20 group select-none"
                title="Drag to resize"
              >
                <svg className="w-3 h-3 opacity-30 group-hover:opacity-80 transition-opacity text-slate-400" viewBox="0 0 6 6" fill="currentColor">
                  <circle cx="5" cy="5" r="0.8" />
                  <circle cx="5" cy="2.5" r="0.8" />
                  <circle cx="2.5" cy="5" r="0.8" />
                </svg>
              </div>
              {/* Bottom-left corner — full resize */}
              <div
                onMouseDown={(e) => handleStartResize(e, "sw")}
                className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize z-20 group select-none"
                title="Drag to resize"
              >
                <svg className="w-3 h-3 opacity-30 group-hover:opacity-80 transition-opacity text-slate-400 rotate-90" viewBox="0 0 6 6" fill="currentColor">
                  <circle cx="5" cy="5" r="0.8" />
                  <circle cx="5" cy="2.5" r="0.8" />
                  <circle cx="2.5" cy="5" r="0.8" />
                </svg>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
