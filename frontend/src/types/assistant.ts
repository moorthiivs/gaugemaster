/**
 * Gaugemaster Calibration Template Copilot Types
 * Canonical ChatGPT-style Assistant Models, Attachments, and Change Proposals
 */

import { CanvasColumnDef, TableGridBlock, CanvasRowData } from "./template";

export type AssistantAttachmentCategory =
  | "excel"
  | "document"
  | "image"
  | "calibration";

export interface AssistantAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  category: AssistantAttachmentCategory;
  dataUrl?: string;
  textSummary?: string;
  extractedFormulas?: string[];
  parsedSheets?: Array<{
    sheetName: string;
    rowCount: number;
    columnCount: number;
  }>;
}

export type ChangeProposalIntent =
  | "UPDATE_TEMPLATE"
  | "FIX_FORMULA"
  | "BATCH_COLUMNS"
  | "UPDATE_SETTINGS"
  | "APPLY_ATTACHMENT"
  | "ADD_COLUMN"
  | "DELETE_COLUMN"
  | "CREATE_TABLE"
  | "DELETE_TABLE";

export type ProposalChangeType =
  | "UPDATE_ROW"
  | "UPDATE_COLUMN_FORMULA"
  | "UPDATE_TABLE_SETTINGS"
  | "ADD_COLUMN"
  | "DELETE_COLUMN"
  | "BATCH_COLUMNS"
  | "CREATE_TABLE"
  | "DELETE_TABLE";

export interface SingleProposalChange {
  type: ProposalChangeType;
  targetId?: string;
  field?: string;
  before?: any;
  after?: any;
  description?: string;
  columnDef?: CanvasColumnDef;
  tableBlock?: Partial<TableGridBlock>;
}

export interface CanonicalChangeProposal {
  proposalId: string;
  intent: ChangeProposalIntent;
  requiresConfirmation: boolean;
  target: {
    templateId?: string;
    tableId: string;
    tableTitle?: string;
  };
  summary: string;
  changes: SingleProposalChange[];
  validation: {
    formulaValid: boolean;
    metrologyValid: boolean;
    boundaryTestsPassed?: boolean;
    validationMessage?: string;
  };
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  attachments?: AssistantAttachment[];
  status?: "sending" | "thinking" | "complete" | "error";
  changeProposal?: CanonicalChangeProposal | null;
  suggestions?: string[];
  sources?: string[];
  error?: string;
  metadata?: Record<string, any>;
  engineSource?: "cloud_gemini" | "local_deterministic";
  
  // Backward compatibility fields for existing UI components:
  sender?: "user" | "assistant";
  text?: string;
  proposals?: Array<{
    columnId: string;
    columnLabel: string;
    before: string;
    after: string;
    reason: string;
    confidence?: string;
  }>;
  auditSummary?: any;
  proposedAction?: string;
  actionPayload?: any;
  actionApplied?: boolean;
  actionRejected?: boolean;
}
