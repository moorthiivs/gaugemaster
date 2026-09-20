import React, { useState, useEffect, useRef } from "react";
import {
  Check,
  Copy,
  Info,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Table as TableIcon,
  CheckCircle2,
  XCircle,
  Calculator,
  Sigma,
  Workflow,
  Code2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Circle,
  FileSpreadsheet
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  onCopyFormula?: (formula: string) => void;
  onSelectSuggestion?: (suggestion: string) => void;
}

interface TableToken {
  type: "table";
  headers: string[];
  alignments: Array<"left" | "center" | "right">;
  rows: string[][];
}

interface CodeBlockToken {
  type: "code_block";
  language: string;
  code: string;
}

interface CalloutToken {
  type: "callout";
  variant: "note" | "warning" | "tip" | "important" | "caution";
  title?: string;
  content: string;
}

interface HeadingToken {
  type: "heading";
  level: 1 | 2 | 3 | 4;
  text: string;
}

interface ListToken {
  type: "list";
  ordered: boolean;
  items: string[];
}

interface DetailsToken {
  type: "details";
  title: string;
  content: string;
}

interface DividerToken {
  type: "divider";
}

interface ParagraphToken {
  type: "paragraph";
  text: string;
}

export type BlockToken =
  | TableToken
  | CodeBlockToken
  | CalloutToken
  | HeadingToken
  | ListToken
  | DetailsToken
  | DividerToken
  | ParagraphToken;

/**
 * Tokenize raw markdown string into safe structured blocks.
 */
export function tokenizeMarkdown(text: string): BlockToken[] {
  if (!text) return [];

  const lines = text.split("\n");
  const tokens: BlockToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Fenced Code Block: ```lang ... ```
    if (line.trim().startsWith("```")) {
      const match = line.trim().match(/^```([a-zA-Z0-9_-]*)/);
      const language = match ? match[1] || "plaintext" : "plaintext";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({
        type: "code_block",
        language,
        code: codeLines.join("\n")
      });
      i++; // Skip closing fence
      continue;
    }

    // 2. Expandable Details Block: <details><summary>...</summary>...</details> or :::details
    if (line.trim().startsWith("<details>") || line.trim().startsWith(":::details")) {
      let title = "Technical Details";
      const summaryMatch = line.match(/<summary>(.*?)<\/summary>/i);
      if (summaryMatch) {
        title = summaryMatch[1];
      }
      const detailLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().includes("</details>") && !lines[i].trim().startsWith(":::")) {
        const dLine = lines[i];
        if (dLine.includes("<summary>")) {
          const m = dLine.match(/<summary>(.*?)<\/summary>/i);
          if (m) title = m[1];
        } else {
          detailLines.push(dLine);
        }
        i++;
      }
      tokens.push({
        type: "details",
        title,
        content: detailLines.join("\n").trim()
      });
      i++;
      continue;
    }

    // 3. Markdown Table: | Col 1 | Col 2 | ...
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // First line: headers
        const headerRow = tableLines[0];
        const headers = headerRow
          .slice(1, -1)
          .split("|")
          .map((h) => h.trim());

        // Second line: delimiter row (e.g., |:---|:---:|---:|)
        const delimiterRow = tableLines[1];
        const delimParts = delimiterRow.slice(1, -1).split("|");
        const alignments: Array<"left" | "center" | "right"> = delimParts.map((d) => {
          const trimmed = d.trim();
          if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
          if (trimmed.endsWith(":")) return "right";
          return "left";
        });

        // Rows: lines 2 onwards
        const rows: string[][] = [];
        for (let r = 2; r < tableLines.length; r++) {
          const rowCells = tableLines[r]
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
          rows.push(rowCells);
        }

        tokens.push({
          type: "table",
          headers,
          alignments,
          rows
        });
        continue;
      }
    }

    // 4. Horizontal Rules: ---, ***, ___
    if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
      tokens.push({ type: "divider" });
      i++;
      continue;
    }

    // 5. Headings: #, ##, ###, ####
    if (/^#{1,4}\s+/.test(line)) {
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length as 1 | 2 | 3 | 4;
        tokens.push({
          type: "heading",
          level,
          text: headingMatch[2].trim()
        });
        i++;
        continue;
      }
    }

    // 6. Blockquotes / Alerts: > [!NOTE], > [!WARNING], > ...
    if (line.trim().startsWith(">")) {
      const calloutLines: string[] = [];
      let variant: CalloutToken["variant"] = "note";
      let title: string | undefined;

      while (i < lines.length && lines[i].trim().startsWith(">")) {
        const rawContent = lines[i].trim().replace(/^>\s*/, "");
        if (rawContent.startsWith("[!NOTE]")) {
          variant = "note";
        } else if (rawContent.startsWith("[!WARNING]")) {
          variant = "warning";
        } else if (rawContent.startsWith("[!TIP]")) {
          variant = "tip";
        } else if (rawContent.startsWith("[!IMPORTANT]")) {
          variant = "important";
        } else if (rawContent.startsWith("[!CAUTION]")) {
          variant = "caution";
        } else {
          calloutLines.push(rawContent);
        }
        i++;
      }

      tokens.push({
        type: "callout",
        variant,
        title,
        content: calloutLines.join("\n").trim()
      });
      continue;
    }

    // 7. Lists: Bullet list (- or *) or Numbered list (1. 2.)
    if (/^(\s*[-*]|\s*\d+\.)\s+/.test(line)) {
      const isOrdered = /^\s*\d+\.\s+/.test(line);
      const listItems: string[] = [];

      while (i < lines.length && /^(\s*[-*]|\s*\d+\.)\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^(\s*[-*]|\s*\d+\.)\s+/, "").trim();
        listItems.push(itemText);
        i++;
      }

      tokens.push({
        type: "list",
        ordered: isOrdered,
        items: listItems
      });
      continue;
    }

    // 8. Empty line: skip
    if (!line.trim()) {
      i++;
      continue;
    }

    // 9. Normal paragraph: accumulate until empty line or special token
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("|") &&
      !/^#{1,4}\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith(">") &&
      !/^(\s*[-*]|\s*\d+\.)\s+/.test(lines[i]) &&
      !/^(\s*[-*_]\s*){3,}$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      tokens.push({
        type: "paragraph",
        text: paragraphLines.join("\n")
      });
    }
  }

  return tokens;
}

/**
 * Render inline markdown elements (bold, italic, inline code, highlights, math, links) into safe JSX.
 */
/**
 * Strip HTML tags from a string and return only the text content.
 */
function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

/**
 * Extract style properties from an HTML span tag and map them to React-safe CSS class names.
 * Returns { text, className } where text is the inner content and className has tailwind styling.
 */
function parseHtmlSpan(html: string): { text: string; className: string } | null {
  const match = html.match(/<span\s+style="([^"]*)"\s*>(.*?)<\/span>/i);
  if (!match) return null;

  const style = match[1].toLowerCase();
  const text = match[2].trim();
  const classes: string[] = ["font-medium"];

  if (style.includes("color:red") || style.includes("color: red") || style.includes("color:#f00") || style.includes("color:#ff0000")) {
    classes.push("text-rose-600 dark:text-rose-400");
  } else if (style.includes("color:green") || style.includes("color: green") || style.includes("color:#0f0") || style.includes("color:#00ff00") || style.includes("color:#008000")) {
    classes.push("text-emerald-600 dark:text-emerald-400");
  } else if (style.includes("color:orange") || style.includes("color: orange") || style.includes("color:#ffa500")) {
    classes.push("text-amber-600 dark:text-amber-400");
  } else if (style.includes("color:blue") || style.includes("color: blue")) {
    classes.push("text-blue-600 dark:text-blue-400");
  }

  if (style.includes("font-weight:bold") || style.includes("font-weight: bold") || style.includes("font-weight:700")) {
    classes.push("font-bold");
  }
  if (style.includes("font-style:italic") || style.includes("font-style: italic")) {
    classes.push("italic");
  }

  return { text, className: classes.join(" ") };
}

export function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match bold (**text**), italic (*text* or _text_), code (`text`), math ($text$), highlight (==text==), strikethrough (~~text~~), link ([label](url)), HTML span tags
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\$[^$]+\$|==[^=]+==|~~[^~]+~~|\[[^\]]+\]\([^)]+\)|<span\s+[^>]*>.*?<\/span>)/gi;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  let keyCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }

    const token = match[0];

    // HTML span tags — parse style and render as styled React element
    if (token.startsWith("<span") && token.includes("</span>")) {
      const parsed = parseHtmlSpan(token);
      if (parsed) {
        parts.push(
          <span key={`html_${keyCounter++}`} className={parsed.className}>
            {parsed.text}
          </span>
        );
      } else {
        // Fallback: strip tags, show text
        parts.push(stripHtmlTags(token));
      }
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`b_${keyCounter++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={`i_${keyCounter++}`} className="italic text-foreground/90">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const codeContent = token.slice(1, -1);
      parts.push(
        <code
          key={`c_${keyCounter++}`}
          className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-primary border border-slate-200 dark:border-slate-700/80 font-medium"
        >
          {codeContent}
        </code>
      );
    } else if (token.startsWith("$") && token.endsWith("$")) {
      const formulaContent = token.slice(1, -1);
      parts.push(
        <span
          key={`f_${keyCounter++}`}
          className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold inline-flex items-center gap-1"
        >
          <Sigma className="w-2.5 h-2.5" />
          {formulaContent}
        </span>
      );
    } else if (token.startsWith("==") && token.endsWith("==")) {
      parts.push(
        <mark
          key={`m_${keyCounter++}`}
          className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-medium"
        >
          {token.slice(2, -2)}
        </mark>
      );
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      parts.push(
        <del key={`d_${keyCounter++}`} className="line-through text-muted-foreground">
          {token.slice(2, -2)}
        </del>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const labelMatch = token.match(/\[(.*?)\]\((.*?)\)/);
      if (labelMatch) {
        parts.push(
          <a
            key={`a_${keyCounter++}`}
            href={labelMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 font-medium inline-flex items-center gap-0.5"
          >
            {labelMatch[1]}
            <ExternalLink className="w-2.5 h-2.5 inline-block" />
          </a>
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(token);
    }

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts;
}

/**
 * Automatically repairs and sanitizes common LLM Mermaid syntax mistakes:
 * 1. Node labels with special characters (|colons|, math pipes |Error|, <, >, -) wrapped in quotes
 * 2. Edge labels containing <, >, <=, >= converted to HTML entities (&le;, &ge;, &lt;, &gt;) or quoted
 * 3. Normalizes "graph TD" to "flowchart TD" for better error tolerance and modern features
 */
function sanitizeMermaidCode(rawCode: string): string {
  let lines = rawCode.trim().split("\n");

  return lines
    .map((line) => {
      let l = line;

      // 1. Edge labels: replace <= with &le;, >= with &ge;, < with &lt;, > with &gt; inside |...|
      l = l.replace(/(\|)([^|]+)(\|)/g, (_match, p1, label, p3) => {
        let cleanLabel = label
          .replace(/<=/g, "&le; ")
          .replace(/>=/g, "&ge; ")
          .replace(/<(?!=)/g, "&lt; ")
          .replace(/>(?!=)/g, "&gt; ")
          .trim();
        return `${p1}${cleanLabel}${p3}`;
      });

      // 2. Decision nodes { ... }:
      // If inside { ... } there are pipes like |Error|, replace pipes with abs(...) or wrap in quotes
      l = l.replace(/([A-Za-z0-9_]+)\{([^{}"]*)\}/g, (_match, id, inner) => {
        // Replace |X| with abs(X) inside node label
        let sanitized = inner.replace(/\|([^|]+)\|/g, "abs($1)").trim();
        return `${id}{"${sanitized}"}`;
      });

      // 3. Rectangular nodes [ ... ]:
      // If inside [ ... ] there are colons or special characters, wrap in quotes if not already quoted
      l = l.replace(/([A-Za-z0-9_]+)\[([^\[\]"]*[:|][^\[\]"]*)\]/g, '$1["$2"]');

      return l;
    })
    .join("\n");
}

/**
 * Visual Diagram Renderer for Mermaid and Flowchart definitions.
 * Provides interactive zoom, SVG rendering, and Diagram/Source Code tabs.
 */
const DiagramView: React.FC<{ code: string }> = ({ code }) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"diagram" | "code">("diagram");
  const [zoom, setZoom] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderMermaid() {
      if (typeof window === "undefined") return;

      try {
        const mermaidModule = await import("mermaid");
        const mermaid = (mermaidModule.default || mermaidModule) as any;

        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "neutral",
          securityLevel: "loose",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          flowchart: {
            curve: "basis",
            useMaxWidth: true,
            htmlLabels: true
          }
        });

        const cleanCode = code.trim();
        let svg: string | null = null;

        // Tier 1: Try rendering sanitized code (repairs unquoted pipes, <=, >=, etc.)
        const sanitized = sanitizeMermaidCode(cleanCode);
        try {
          const uniqueId = `mermaid_${Math.random().toString(36).substring(2, 9)}`;
          const res = await mermaid.render(uniqueId, sanitized);
          svg = res.svg;
        } catch {
          // Tier 2: Try rendering original cleanCode
          try {
            const fallbackId = `mermaid_fb_${Math.random().toString(36).substring(2, 9)}`;
            const res = await mermaid.render(fallbackId, cleanCode);
            svg = res.svg;
          } catch {
            // Tier 3: Aggressive fallback: convert graph -> flowchart and diamond braces to box quotes
            try {
              const aggressiveId = `mermaid_ag_${Math.random().toString(36).substring(2, 9)}`;
              const aggressiveCode = sanitized
                .replace(/^graph\s+/gm, "flowchart ")
                .replace(/\{"?(.*?)"?\}/g, '["$1"]');
              const res = await mermaid.render(aggressiveId, aggressiveCode);
              svg = res.svg;
            } catch (finalErr: any) {
              if (isMounted) {
                setRenderError(finalErr?.message || "Could not render diagram syntax");
                setSvgContent(null);
              }
              return;
            }
          }
        }

        if (isMounted && svg) {
          setSvgContent(svg);
          setRenderError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setRenderError(err?.message || "Could not render diagram syntax");
          setSvgContent(null);
        }
      }
    }

    renderMermaid();

    return () => {
      isMounted = false;
    };
  }, [code]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Mermaid code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.6));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xs">
      {/* Diagram Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px]">
        <div className="flex items-center gap-2">
          <Workflow className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-foreground">Visual Diagram</span>
          <Badge variant="outline" className="text-[9px] font-mono py-0 px-1.5 bg-primary/10 text-primary border-primary/20">
            MERMAID
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls (only in diagram mode) */}
          {activeTab === "diagram" && svgContent && (
            <div className="flex items-center gap-0.5 mr-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 px-1 py-0.5 text-[10px]">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:text-primary transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="font-mono text-[9px] px-1 text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 hover:text-primary transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 hover:text-primary transition-colors cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* View Tab Toggle */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 rounded p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setActiveTab("diagram")}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                activeTab === "diagram"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Diagram
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("code")}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                activeTab === "code"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Code
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyCode}
            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Diagram Body */}
      {activeTab === "diagram" ? (
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/60 overflow-x-auto min-h-[140px] flex items-center justify-center">
          {svgContent ? (
            <div
              ref={containerRef}
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s ease-out" }}
              className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : renderError ? (
            <div className="text-center py-6 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Diagram syntax preview
              </div>
              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                Viewing source representation below.
              </p>
              <pre className="mt-2 text-left p-2.5 rounded bg-slate-900 text-slate-100 text-[10.5px] font-mono overflow-x-auto max-w-lg mx-auto">
                <code>{code}</code>
              </pre>
            </div>
          ) : (
            <div className="py-8 flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              Rendering diagram...
            </div>
          )}
        </div>
      ) : (
        <pre className="p-3 bg-slate-950 text-slate-100 text-[11px] font-mono leading-relaxed overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};

/**
 * Intelligent Metrology Cell Formatter.
 * Auto-detects and visually highlights PASS/FAIL verdicts, numerical values, and tolerances.
 */
const SmartTableCell: React.FC<{
  content: string;
  align: "left" | "center" | "right";
}> = ({ content, align }) => {
  const trimmed = content.trim();

  // Strip HTML tags to get plain text for verdict detection
  // This handles cases where the AI returns e.g. <span style="color:red; font-weight:bold;">FAIL</span>
  const plainText = stripHtmlTags(trimmed);
  const upper = plainText.toUpperCase();

  // Use cleaned display text (without HTML tags) for verdict badges
  const displayText = plainText || trimmed;

  // 1. Pass Verdict
  if (
    upper === "PASS" ||
    upper === "PASSED" ||
    upper === "OK" ||
    upper === "APPROVED" ||
    upper === "ACCEPTED" ||
    upper === "WITHIN LIMITS" ||
    upper === "VALID"
  ) {
    return (
      <td className="p-2 px-3 text-center border-r border-slate-100 dark:border-slate-800/80 last:border-r-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          {displayText}
        </span>
      </td>
    );
  }

  // 2. Fail Verdict
  if (
    upper === "FAIL" ||
    upper === "FAILED" ||
    upper === "REJECTED" ||
    upper === "OUT OF SPEC" ||
    upper === "ERROR" ||
    upper === "INVALID"
  ) {
    return (
      <td className="p-2 px-3 text-center border-r border-slate-100 dark:border-slate-800/80 last:border-r-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-100/90 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700 shadow-2xs">
          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          {displayText}
        </span>
      </td>
    );
  }

  // 3. Warning / Review Verdict
  if (upper === "WARN" || upper === "WARNING" || upper === "REVIEW" || upper === "PENDING" || upper === "INVESTIGATE") {
    return (
      <td className="p-2 px-3 text-center border-r border-slate-100 dark:border-slate-800/80 last:border-r-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs">
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          {displayText}
        </span>
      </td>
    );
  }

  // 4. Calculated / Formula Column
  if (upper === "CALCULATED" || upper === "CALC" || upper === "FORMULA") {
    return (
      <td className="p-2 px-3 text-center border-r border-slate-100 dark:border-slate-800/80 last:border-r-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-violet-100/90 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-300 dark:border-violet-700 shadow-2xs">
          <Calculator className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400" />
          {displayText}
        </span>
      </td>
    );
  }

  // 5. Numeric formatting: pure numbers or numbers with decimals
  const isNumeric = /^-?\d+(\.\d+)?$/.test(plainText);
  const isNegative = isNumeric && plainText.startsWith("-");

  // 6. Tolerance format (e.g. ±0.010 or +0.02/-0.01)
  const isTolerance = /^[±+-]\s*\d+(\.\d+)?/.test(plainText);

  return (
    <td
      className={`p-1.5 px-3 leading-normal border-r border-slate-100 dark:border-slate-800/80 last:border-r-0 text-foreground ${
        align === "center"
          ? "text-center"
          : align === "right" || isNumeric
          ? `text-right font-mono text-[11px] ${
              isNegative ? "text-rose-600 dark:text-rose-400 font-semibold" : "font-medium"
            }`
          : isTolerance
          ? "text-right font-mono text-[11px] text-primary font-semibold"
          : "text-left text-[11.5px]"
      }`}
    >
      {renderInlineMarkdown(content)}
    </td>
  );
};

/**
 * Enterprise ChatGPT/Claude-Grade Metrology Table.
 * Includes header stats, TSV Excel export, and smart cell formatting.
 */
const TableView: React.FC<{ token: TableToken }> = ({ token }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyTSV = () => {
    const tsvContent = [
      token.headers.join("\t"),
      ...token.rows.map((row) => row.join("\t"))
    ].join("\n");

    navigator.clipboard.writeText(tsvContent);
    setCopied(true);
    toast.success("Table copied as TSV (Ready to paste in Excel / Google Sheets)!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyMarkdown = () => {
    const md = [
      `| ${token.headers.join(" | ")} |`,
      `| ${token.alignments.map((a) => (a === "center" ? ":---:" : a === "right" ? "---:" : ":---")).join(" | ")} |`,
      ...token.rows.map((r) => `| ${r.join(" | ")} |`)
    ].join("\n");

    navigator.clipboard.writeText(md);
    toast.success("Table copied as Markdown!");
  };

  return (
    <div className="my-3 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xs">
      {/* Table Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px]">
        <div className="flex items-center gap-2">
          <TableIcon className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-foreground">Metrology Data Table</span>
          <Badge variant="secondary" className="text-[9px] font-mono py-0 px-1.5">
            {token.rows.length} rows • {token.headers.length} cols
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyTSV}
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer gap-1"
            title="Copy as TSV for Excel or Sheets"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <FileSpreadsheet className="w-3 h-3 text-emerald-600" />}
            {copied ? "Copied" : "Copy for Excel"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyMarkdown}
            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            title="Copy as raw Markdown table"
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/75 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-muted-foreground">
              {token.headers.map((h, idx) => {
                const align = token.alignments[idx] || "left";
                return (
                  <th
                    key={idx}
                    className={`p-2.5 px-3 font-bold text-foreground text-[10px] uppercase tracking-wider border-r border-slate-200 dark:border-slate-800 last:border-r-0 ${
                      align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {renderInlineMarkdown(h)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
            {token.rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={`transition-colors ${
                  rIdx % 2 === 1
                    ? "bg-slate-50/60 dark:bg-slate-900/40 hover:bg-primary/5 dark:hover:bg-primary/10"
                    : "hover:bg-primary/5 dark:hover:bg-primary/10"
                }`}
              >
                {row.map((cell, cIdx) => {
                  const align = token.alignments[cIdx] || "left";
                  return <SmartTableCell key={cIdx} content={cell} align={align} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Interactive Code Block with Language Tag, Line Numbers, and Quick Formula Insert.
 */
const CodeBlockView: React.FC<{
  language: string;
  code: string;
  onCopyFormula?: (formula: string) => void;
}> = ({ language, code, onCopyFormula }) => {
  const [copied, setCopied] = useState(false);

  // If this code block is a Mermaid diagram, render it as a visual diagram!
  const isMermaid =
    language.toLowerCase() === "mermaid" ||
    language.toLowerCase() === "diagram" ||
    code.trim().startsWith("graph ") ||
    code.trim().startsWith("flowchart ") ||
    code.trim().startsWith("sequenceDiagram");

  if (isMermaid) {
    return <DiagramView code={code} />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const isFormula = language.toLowerCase() === "formula" || language.toLowerCase() === "excel";
  const handleApply = () => {
    if (onCopyFormula) {
      onCopyFormula(code);
      toast.success("Formula inserted into template builder!");
    } else {
      handleCopy();
    }
  };

  const cleanLang = language ? language.toUpperCase() : "CODE";
  const lines = code.split("\n");

  return (
    <div className="my-2.5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 shadow-xs">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          {isFormula ? (
            <Calculator className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Code2 className="w-3.5 h-3.5 text-primary" />
          )}
          <span className="font-semibold uppercase tracking-wider">{cleanLang}</span>
          <span className="text-slate-500">• {lines.length} lines</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isFormula && onCopyFormula && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleApply}
              className="h-5 px-2 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50 gap-1 cursor-pointer font-semibold"
            >
              <CheckCircle2 className="w-3 h-3" />
              Apply Formula
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-5 px-1.5 text-[10px] text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Code Body */}
      <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-slate-200 scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Callout / Alert Box (GitHub & Claude Style).
 */
const CalloutView: React.FC<{ token: CalloutToken }> = ({ token }) => {
  const getStyle = () => {
    switch (token.variant) {
      case "warning":
      case "caution":
        return {
          icon: AlertTriangle,
          label: "WARNING",
          border: "border-amber-300 dark:border-amber-800/80",
          bg: "bg-gradient-to-r from-amber-50/90 to-amber-50/40 dark:from-amber-950/40 dark:to-amber-950/20",
          text: "text-amber-950 dark:text-amber-200",
          iconColor: "text-amber-600 dark:text-amber-400",
          badgeBg: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
        };
      case "important":
        return {
          icon: ShieldAlert,
          label: "IMPORTANT",
          border: "border-purple-300 dark:border-purple-800/80",
          bg: "bg-gradient-to-r from-purple-50/90 to-purple-50/40 dark:from-purple-950/40 dark:to-purple-950/20",
          text: "text-purple-950 dark:text-purple-200",
          iconColor: "text-purple-600 dark:text-purple-400",
          badgeBg: "bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300"
        };
      case "tip":
        return {
          icon: Lightbulb,
          label: "PRO TIP",
          border: "border-emerald-300 dark:border-emerald-800/80",
          bg: "bg-gradient-to-r from-emerald-50/90 to-emerald-50/40 dark:from-emerald-950/40 dark:to-emerald-950/20",
          text: "text-emerald-950 dark:text-emerald-200",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badgeBg: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"
        };
      default:
        return {
          icon: Info,
          label: "NOTE",
          border: "border-blue-300 dark:border-blue-800/80",
          bg: "bg-gradient-to-r from-blue-50/90 to-blue-50/40 dark:from-blue-950/40 dark:to-blue-950/20",
          text: "text-blue-950 dark:text-blue-200",
          iconColor: "text-blue-600 dark:text-blue-400",
          badgeBg: "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300"
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;

  return (
    <div className={`my-2.5 p-3 rounded-xl border ${style.border} ${style.bg} ${style.text} shadow-2xs text-[11.5px] leading-relaxed space-y-1`}>
      <div className="flex items-center gap-1.5 font-bold text-[10px] tracking-wider uppercase">
        <Icon className={`w-3.5 h-3.5 ${style.iconColor} shrink-0`} />
        <span className={`px-1.5 py-0.2 rounded font-mono ${style.badgeBg}`}>{style.label}</span>
      </div>
      <div className="pl-5 whitespace-pre-wrap">{renderInlineMarkdown(token.content)}</div>
    </div>
  );
};

/**
 * Expandable Details Collapsible Section.
 */
const DetailsView: React.FC<{
  token: DetailsToken;
  onCopyFormula?: (formula: string) => void;
  onSelectSuggestion?: (suggestion: string) => void;
}> = ({ token, onCopyFormula, onSelectSuggestion }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-2.5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/70 shadow-2xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-2.5 px-3 text-left font-medium text-[11.5px] text-foreground hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
      >
        <span className="flex items-center gap-2 font-bold">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          {token.title}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="p-3 pt-2 text-[11px] text-foreground border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 leading-relaxed space-y-2">
          <AssistantMarkdownRenderer
            content={token.content}
            onCopyFormula={onCopyFormula}
            onSelectSuggestion={onSelectSuggestion}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Master ChatGPT/Claude-Style Assistant Markdown Renderer.
 */
export const AssistantMarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
  onCopyFormula,
  onSelectSuggestion
}) => {
  if (!content) return null;

  // Safety guard: If content is a raw JSON string (e.g. from an API response that was passed unwrapped)
  let cleanContent = content;
  const trimmed = cleanContent.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"reply"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.reply && typeof parsed.reply === "string") {
        cleanContent = parsed.reply;
      }
    } catch {
      // Regex extraction if JSON.parse fails due to unescaped backslashes or characters
      const m = trimmed.match(/"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:action|actionPayload|canonicalProposal)"/) ||
                trimmed.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (m && m[1]) {
        cleanContent = m[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
    }
  }

  const tokens = tokenizeMarkdown(cleanContent);

  return (
    <div className={`space-y-2.5 text-xs text-foreground leading-relaxed ${className}`}>
      {tokens.map((tok, idx) => {
        switch (tok.type) {
          case "heading": {
            if (tok.level === 1) {
              return (
                <h2
                  key={idx}
                  className="text-sm font-bold text-foreground mt-3.5 mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span>{renderInlineMarkdown(tok.text)}</span>
                </h2>
              );
            }
            if (tok.level === 2) {
              return (
                <h3
                  key={idx}
                  className="text-xs font-bold text-foreground mt-3 mb-1 flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 ring-2 ring-primary/20" />
                  <span>{renderInlineMarkdown(tok.text)}</span>
                </h3>
              );
            }
            return (
              <h4 key={idx} className="text-[11.5px] font-bold text-foreground/90 mt-2 mb-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-sm bg-muted-foreground/60 shrink-0" />
                <span>{renderInlineMarkdown(tok.text)}</span>
              </h4>
            );
          }

          case "divider":
            return <hr key={idx} className="my-3 border-t border-slate-200 dark:border-slate-800" />;

          case "table":
            return <TableView key={idx} token={tok} />;

          case "code_block":
            return (
              <CodeBlockView
                key={idx}
                language={tok.language}
                code={tok.code}
                onCopyFormula={onCopyFormula}
              />
            );

          case "callout":
            return <CalloutView key={idx} token={tok} />;

          case "details":
            return (
              <DetailsView
                key={idx}
                token={tok}
                onCopyFormula={onCopyFormula}
                onSelectSuggestion={onSelectSuggestion}
              />
            );

          case "list": {
            if (tok.ordered) {
              return (
                <ol key={idx} className="my-2 space-y-1.5 text-[11.5px]">
                  {tok.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-start gap-2 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-primary/10 text-primary border border-primary/25 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {itemIdx + 1}
                      </span>
                      <div className="flex-1">{renderInlineMarkdown(item)}</div>
                    </li>
                  ))}
                </ol>
              );
            }

            return (
              <ul key={idx} className="my-2 space-y-1.5 text-[11.5px]">
                {tok.items.map((item, itemIdx) => {
                  // 1. Task list item: - [x] or - [ ]
                  const checklistMatch = item.match(/^\[([ xX])\]\s*(.*)$/);
                  if (checklistMatch) {
                    const isChecked = checklistMatch[1].toLowerCase() === "x";
                    const taskText = checklistMatch[2];
                    const cleanText = taskText.replace(/[*`_]/g, "").trim();

                    return (
                      <li key={itemIdx} className="leading-relaxed list-none">
                        <button
                          type="button"
                          onClick={() => onSelectSuggestion?.(cleanText)}
                          disabled={!onSelectSuggestion}
                          className={`w-full text-left flex items-start gap-2 p-2 rounded-lg transition-all border ${
                            onSelectSuggestion
                              ? "cursor-pointer bg-slate-50 hover:bg-primary/10 border-slate-200/90 dark:bg-slate-900/60 dark:border-slate-800 hover:border-primary/40 active:scale-[0.99] group/task shadow-2xs"
                              : "border-transparent"
                          }`}
                          title={onSelectSuggestion ? `Click to run: "${cleanText}"` : undefined}
                        >
                          {isChecked ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <Circle
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 transition-colors ${
                                onSelectSuggestion
                                  ? "text-slate-400 group-hover/task:text-primary"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            />
                          )}
                          <span
                            className={`flex-1 text-[11px] ${
                              isChecked ? "text-foreground font-medium" : "text-foreground"
                            } ${onSelectSuggestion ? "group-hover/task:text-primary transition-colors" : ""}`}
                          >
                            {renderInlineMarkdown(taskText)}
                          </span>
                          {onSelectSuggestion && (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover/task:text-primary group-hover/task:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                          )}
                        </button>
                      </li>
                    );
                  }

                  // 2. Bullet item with full markdown formatting (bold, italic, code, links)
                  return (
                    <li key={itemIdx} className="flex items-start gap-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      <div className="flex-1">{renderInlineMarkdown(item)}</div>
                    </li>
                  );
                })}
              </ul>
            );
          }

          case "paragraph":
          default:
            return (
              <p key={idx} className="text-[11.5px] leading-relaxed whitespace-pre-wrap">
                {renderInlineMarkdown(tok.text)}
              </p>
            );
        }
      })}
    </div>
  );
};
