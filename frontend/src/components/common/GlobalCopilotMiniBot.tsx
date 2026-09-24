import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Paperclip,
  RotateCcw,
  RotateCw,
  Plus,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  ExternalLink,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Edit2,
  Copy,
  Check,
  GripHorizontal,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useScreenContext } from '@/hooks/useScreenContext';
import {
  getDailyQuotaStatus,
  getUserConversations,
  getConversationMessages,
  deleteUserConversation,
  sendCopilotPrompt,
  DailyQuotaStatus,
  StoredConversation,
  StoredMessage,
} from '@/lib/aiGatewayClient';
import { httpClient } from '@/lib/httpClient';
import { AssistantMarkdownRenderer } from '@/components/calibration/template-management/AssistantMarkdownRenderer';

interface LocalChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  requestedModel?: string;
  isFallback?: boolean;
  suggestions?: string[];
  attachments?: Array<{ name: string; type?: string }>;
  error?: string;
}

export const GlobalCopilotMiniBot: React.FC = () => {
  const screenContextInfo = useScreenContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [configuredModel, setConfiguredModel] = useState<string>('');

  // Requirement 2: Enable/Disable setting listener from Settings Page
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem('gm_floating_copilot_enabled') !== 'false';
  });

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const res = await httpClient.get('/ai/status');
        if (res.data?.defaultModel) {
          setConfiguredModel(res.data.defaultModel);
        }
        if (res.data?.floatingBotEnabled !== undefined) {
          const val = res.data.floatingBotEnabled !== false && localStorage.getItem('gm_floating_copilot_enabled') !== 'false';
          setIsEnabled(val);
        }
      } catch {
        // Keep local state
      }
    };
    checkServerStatus();

    const handleToggleEvent = (e: any) => {
      if (typeof e.detail?.enabled === 'boolean') {
        setIsEnabled(e.detail.enabled);
      }
    };

    window.addEventListener('copilot:toggle-floating-bot', handleToggleEvent);
    return () => window.removeEventListener('copilot:toggle-floating-bot', handleToggleEvent);
  }, []);

  // Requirement 1: Manual Width & Height Resize State
  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    try {
      const saved = localStorage.getItem('gm_copilot_minibot_size');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.width && parsed.height) return parsed;
      }
    } catch {}
    return { width: 480, height: 610 };
  });

  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    direction: 'nw' | 'w' | 'n';
  } | null>(null);

  // Resize mouse handlers
  const handleStartResize = (e: React.MouseEvent, direction: 'nw' | 'w' | 'n') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
      direction,
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startY, startWidth, startHeight, direction } = resizeRef.current;
      const dx = startX - e.clientX; // Dragging left increases width
      const dy = startY - e.clientY; // Dragging up increases height

      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction === 'w' || direction === 'nw') {
        newWidth = Math.min(Math.max(380, startWidth + dx), window.innerWidth - 30);
      }
      if (direction === 'n' || direction === 'nw') {
        newHeight = Math.min(Math.max(420, startHeight + dy), window.innerHeight - 30);
      }

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      localStorage.setItem('gm_copilot_minibot_size', JSON.stringify(size));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, size]);

  // Conversation & Message State
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Requirement 4: Message edit & copy state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Quota state
  const [quota, setQuota] = useState<DailyQuotaStatus | null>(null);

  // Attachments
  const [attachments, setAttachments] = useState<Array<{ name: string; dataUrl?: string; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshQuota = useCallback(async () => {
    try {
      const data = await getDailyQuotaStatus();
      if (data) {
        setQuota(data);
      }
    } catch (err) {
      console.error('Failed to refresh daily quota:', err);
    }
  }, []);

  const loadUserConversations = useCallback(async () => {
    try {
      const convs = await getUserConversations();
      setConversations(convs);
    } catch (err) {
      console.error('Failed to load user conversations:', err);
    }
  }, []);

  // Load initial quota on mount
  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  // Refresh quota and conversations when opening
  useEffect(() => {
    if (isOpen) {
      refreshQuota();
      loadUserConversations();
    }
  }, [isOpen, screenContextInfo.screenContext, refreshQuota, loadUserConversations]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (scrollRef.current && !editingMessageId) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, editingMessageId]);

  const handleStartNewChat = () => {
    setConversationId(undefined);
    setMessages([]);
    setAttachments([]);
    setShowHistory(false);
    setEditingMessageId(null);
  };

  const handleSelectConversation = async (conv: StoredConversation) => {
    setConversationId(conv.id);
    setShowHistory(false);
    setLoading(true);
    setEditingMessageId(null);
    try {
      const storedMsgs = await getConversationMessages(conv.id);
      const mapped: LocalChatMessage[] = storedMsgs.map((m) => {
        let content = m.content;
        if (m.role === 'assistant') {
          try {
            let clean = m.content.trim();
            if (clean.includes('```json')) {
              const match = clean.match(/```json\s*([\s\S]*?)\s*```/);
              if (match && match[1]) clean = match[1].trim();
            } else if (clean.includes('```')) {
              const match = clean.match(/```\s*([\s\S]*?)\s*```/);
              if (match && match[1]) clean = match[1].trim();
            }
            const firstBrace = clean.indexOf('{');
            const lastBrace = clean.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              clean = clean.slice(firstBrace, lastBrace + 1).trim();
            }
            const parsed = JSON.parse(clean);
            if (parsed.reply) content = parsed.reply;
          } catch {}
        }
        return {
          id: m.id,
          role: m.role,
          content,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: m.model,
          suggestions: m.suggestions,
          attachments: m.attachments,
        };
      });
      setMessages(mapped);
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await deleteUserConversation(id);
    if (ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        handleStartNewChat();
      }
    }
  };

  const handleFileSelect = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            dataUrl: reader.result as string,
            type: file.type || 'application/octet-stream',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Requirement 4: Message Edit, Delete, Resend Handlers
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleDeleteMessage = (messageId: string) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    if (messages[idx]?.role === 'user' && messages[idx + 1]?.role === 'assistant') {
      setMessages((prev) => prev.filter((_, i) => i !== idx && i !== idx + 1));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  const handleStartEdit = (msg: LocalChatMessage) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEditAndResend = (messageId: string) => {
    const newText = editContent.trim();
    if (!newText) return;

    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    // Truncate history to before this turn and resend
    const truncated = messages.slice(0, idx);
    setMessages(truncated);
    setEditingMessageId(null);
    setEditContent('');
    handleSendMessage(newText);
  };

  const handleResend = (content: string) => {
    handleSendMessage(content);
  };

  const handleRegenerate = (assistantId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx <= 0) return;
    const prevMsg = messages[idx - 1];
    if (prevMsg && prevMsg.role === 'user') {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      handleSendMessage(prevMsg.content);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || input).trim();
    if (!content && attachments.length === 0) return;
    if (loading) return;

    if (quota && quota.isLimitReached) {
      return;
    }

    const userMessage: LocalChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: attachments.map((a) => ({ name: a.name, type: a.type })),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setLoading(true);

    try {
      const res = await sendCopilotPrompt({
        prompt: content,
        conversationId,
        screenContext: screenContextInfo.screenContext,
        entityId: screenContextInfo.entityId,
        attachments: currentAttachments,
        context: {
          screenTitle: screenContextInfo.screenTitle,
          badge: screenContextInfo.badge,
        },
      });

      if (res.conversationId && res.conversationId !== conversationId) {
        setConversationId(res.conversationId);
      }

      if (res.quota) {
        setQuota(res.quota);
      }

      let replyText = res.rawText;
      let suggestions: string[] = [];
      try {
        let cleanJsonStr = res.rawText.trim();
        if (cleanJsonStr.includes('```json')) {
          const match = cleanJsonStr.match(/```json\s*([\s\S]*?)\s*```/);
          if (match && match[1]) cleanJsonStr = match[1].trim();
        } else if (cleanJsonStr.includes('```')) {
          const match = cleanJsonStr.match(/```\s*([\s\S]*?)\s*```/);
          if (match && match[1]) cleanJsonStr = match[1].trim();
        }
        const firstBrace = cleanJsonStr.indexOf('{');
        const lastBrace = cleanJsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanJsonStr = cleanJsonStr.slice(firstBrace, lastBrace + 1).trim();
        }

        const parsed = JSON.parse(cleanJsonStr);
        if (parsed.reply) replyText = parsed.reply;
        if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions;
      } catch {
        // use raw text directly
      }

      const assistantMessage: LocalChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.modelUsed,
        requestedModel: res.requestedModel || configuredModel,
        isFallback: res.isFallback,
        suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const rawErrMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to connect to ISO 17025 Metrology Copilot.';

      const isKeyMissing = rawErrMsg.includes('Gemini API Key is not configured');
      const isPermissionDenied =
        rawErrMsg.toLowerCase().includes('denied access') ||
        rawErrMsg.toLowerCase().includes('permission_denied') ||
        rawErrMsg.toLowerCase().includes('permission error') ||
        rawErrMsg.toLowerCase().includes('authentication failed');
      const isQuotaError = err?.response?.status === 429;

      if (isQuotaError && err?.response?.data?.resetAt) {
        refreshQuota();
      }

      if (isKeyMissing || isPermissionDenied) {
        let helpfulGuidance = '';
        let fallbackSuggestions = [
          'How do I configure Gemini API Key in Settings?',
          'Explain ISO/IEC 17025 uncertainty budgeting',
          'What are the mandatory fields for calibration templates?',
        ];

        if (content.toLowerCase().includes('create') && content.toLowerCase().includes('template')) {
          helpfulGuidance = `### Standard ISO/IEC 17025 Template Creation Procedure:

1. **Initialize the Template**: Click the **+ Create New Template** button in the top action bar of the Template Catalog.
2. **Define Metrology Parameters**:
   - **Discipline & Instrument Type**: Set the gauge category (e.g. *Dimensional / Length* for Calipers, Micrometers, or Height Gauges).
   - **Unit & Resolution**: Set nominal units (e.g. \`mm\` or \`in\`) and decimal precision (e.g. 3 decimal places for \`0.001 mm\`).
   - **Tolerances**: Define symmetric or asymmetric upper/lower limits.
3. **Assemble Visual Canvas Blocks**:
   - **Data Table Grid**: Add measurement point rows with columns for *Nominal Spec*, *Readings*, *Deviation* (\`actual - nominal\`), and *Judgement* (PASS/FAIL).
   - **Environmental Defaults**: Specify standard ambient conditions (20°C ± 1°C, 50% ± 10% RH).
4. **Audit & Validate**:
   - Use the **AI Audit Table** tool to verify formula syntax and ISO 17025 boundary adherence.
5. **Save & Publish**: Click **Save Template** to activate the format for the Calibration Execution Wizard.`;
        } else if (content.toLowerCase().includes('micrometer') || content.toLowerCase().includes('caliper')) {
          helpfulGuidance = `### Calibration Recommendations for Micrometers & Calipers (ISO 3611 / IS 3651):

- **Reference Standards**: Use Grade 0 or Grade 1 Gauge Block Sets (Slip Gauges) calibrated with traceability to national standards.
- **Key Test Points**:
  - Test at 0%, 25%, 50%, 75%, and 100% of nominal range.
  - Test for flatness and parallelism of measuring faces using Optical Flats.
- **Receipt Condition**: Verify zero-setting error, ratchet stop operation, and spindle clamp functionality before recording values.
- **Repeatability**: Record 3 to 5 successive readings at the mid-point to calculate standard measurement uncertainty ($u_A$).`;
        } else {
          helpfulGuidance = `### ISO/IEC 17025 Metrology Suite Assistance:

You are currently on the **${screenContextInfo.screenTitle}** module.
- **Quality Assurance**: Gaugemaster enforces strict traceability, calibration intervals, and formula calculations.
- **Cloud AI Integration**: Once a valid Google Gemini API Key is configured under **Settings → AI & Copilot Configuration**, you will unlock continuous multi-turn analysis, automatic certificate extraction, drawing OCR, and dynamic formula generation.`;
        }

        const noteHeader = isPermissionDenied
          ? `> [!WARNING]\n> **Google Gemini API Key / Access Denied**\n> Google Cloud reported: *${rawErrMsg}*\n> Please verify or generate a new Gemini API Key in [Google AI Studio](https://aistudio.google.com/app/apikey) and update it under **Settings → AI & Copilot Configuration**.\n\n`
          : `> [!NOTE]\n> **Cloud Gemini API Key Not Configured**\n> An administrator can configure a company Gemini API key under **Settings → AI & Copilot Configuration** to enable full generative AI reasoning. \n\n`;

        const fallbackMessage: LocalChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `${noteHeader}${helpfulGuidance}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: 'Local Metrology Engine',
          suggestions: fallbackSuggestions,
        };
        setMessages((prev) => [...prev, fallbackMessage]);
      } else {
        const errorMessage: LocalChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Request Error**\n\n${rawErrMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          error: rawErrMsg,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Closed State: Floating Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 group">
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-500 text-primary-foreground font-semibold text-xs rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-white/20 dark:border-slate-700/50 backdrop-blur-md"
            title="Open Gaugemaster Metrology Copilot"
            aria-label="Open Gaugemaster Metrology Copilot"
          >
            <div className="relative">
              <Bot className="w-4 h-4 text-white animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-background" />
            </div>
            <span>Copilot</span>
            {quota && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded-full bg-white/20 dark:bg-black/30">
                {quota.remaining} left
              </span>
            )}
          </button>
        </div>
      )}

      {/* Requirement 3: Minimized State (Redesigned with TypeUI Fundamentals) */}
      {isOpen && isMinimized && (
        <div
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 z-50 h-12 px-3.5 rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-2xl border border-white/20 backdrop-blur-xl flex items-center justify-between gap-3 cursor-pointer hover:shadow-primary/20 hover:border-primary/40 transition-all select-none group min-w-[320px] max-w-[440px]"
          title="Click to expand Metrology Copilot"
        >
          {/* Left: Avatar + Full Legible Title + Screen Context Pill */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center shrink-0 shadow-xs relative">
              <Bot className="w-3.5 h-3.5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-slate-900" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-xs text-white tracking-tight whitespace-nowrap">
                Metrology Copilot
              </span>
              <span className="text-[10px] text-slate-300 font-normal px-2 py-0.5 rounded-full bg-white/10 whitespace-nowrap truncate max-w-[130px]">
                {screenContextInfo.screenTitle}
              </span>
            </div>
          </div>

          {/* Right: Quota badge + Expand + Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {quota && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap"
                title={`Daily Quota: ${quota.remaining}/${quota.dailyMessageLimit} left`}
              >
                {quota.remaining}/{quota.dailyMessageLimit}
              </span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              title="Expand Copilot"
              aria-label="Expand Copilot"
            >
              <ChevronUp className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="h-7 w-7 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              title="Close Copilot"
              aria-label="Close Copilot"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded Floating Mini-Bot Window with Requirement 1 Manual Resize */}
      {isOpen && !isMinimized && (
        <div
          style={{
            width: isMaximized ? Math.min(840, window.innerWidth - 32) : size.width,
            height: isMaximized ? Math.min(780, window.innerHeight - 32) : size.height,
          }}
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 bg-background/95 backdrop-blur-xl overflow-hidden transition-size duration-100 select-auto"
        >
          {/* Requirement 1: Resize Handles (Top, Left, Top-Left Corner) */}
          {!isMaximized && (
            <>
              {/* Top Edge Resize Handle */}
              <div
                onMouseDown={(e) => handleStartResize(e, 'n')}
                className="absolute top-0 left-6 right-6 h-2 cursor-ns-resize z-40 group flex items-center justify-center"
                title="Drag to resize height"
              >
                <div className="w-10 h-1 rounded-full bg-slate-300/40 dark:bg-slate-700/50 group-hover:bg-primary transition-colors" />
              </div>

              {/* Left Edge Resize Handle */}
              <div
                onMouseDown={(e) => handleStartResize(e, 'w')}
                className="absolute left-0 top-6 bottom-6 w-2 cursor-ew-resize z-40 group flex items-center justify-center"
                title="Drag to resize width"
              >
                <div className="h-10 w-1 rounded-full bg-slate-300/40 dark:bg-slate-700/50 group-hover:bg-primary transition-colors" />
              </div>

              {/* Top-Left Corner Resize Handle */}
              <div
                onMouseDown={(e) => handleStartResize(e, 'nw')}
                className="absolute top-0 left-0 w-5 h-5 cursor-nwse-resize z-50 group flex items-center justify-center p-1"
                title="Drag to resize width and height"
              >
                <div className="w-2.5 h-2.5 rounded-tl-sm border-t-2 border-l-2 border-slate-400/60 dark:border-slate-600 group-hover:border-primary transition-colors" />
              </div>
            </>
          )}

          {/* Header */}
          <div className="h-14 px-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0 select-none shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center shrink-0 shadow-md">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs tracking-tight truncate">Metrology Copilot</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-white/10 text-emerald-300 font-semibold">
                    ISO 17025
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-300 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate max-w-[170px]">{screenContextInfo.screenTitle}</span>
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Daily Quota Indicator */}
              {quota && (
                <div
                  className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    quota.isLimitReached
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : quota.remaining <= 10
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                  title={`Daily Free Quota: ${quota.messageCount}/${quota.dailyMessageLimit} used. Resets at ${new Date(quota.resetAt).toLocaleTimeString()}`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>{quota.remaining}/{quota.dailyMessageLimit}</span>
                </div>
              )}

              {/* History Toggle */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory((prev) => !prev)}
                className={`h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer rounded-lg ${
                  showHistory ? 'bg-white/20 text-white' : ''
                }`}
                title="Chat History"
              >
                <History className="w-3.5 h-3.5" />
              </Button>

              {/* New Chat */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleStartNewChat}
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer rounded-lg"
                title="Start New Chat"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>

              {/* Maximize / Standard Toggle */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsMaximized((prev) => !prev)}
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer rounded-lg"
                title={isMaximized ? 'Restore standard size' : 'Expand window'}
              >
                {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>

              {/* Minimize to Pill */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer rounded-lg"
                title="Minimize Copilot to Pill"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>

              {/* Close */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer rounded-lg"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 min-h-0 flex flex-col relative bg-slate-50/50 dark:bg-slate-950/30">
            {/* History Slide-over Drawer */}
            {showHistory && (
              <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur-md flex flex-col p-4 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <History className="w-4 h-4 text-primary" />
                    <span>Past Conversations</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(false)}
                    className="h-6 px-2 text-xs"
                  >
                    Close
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {conversations.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      <Bot className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p>No stored conversation sessions found.</p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                          conv.id === conversationId
                            ? 'bg-primary/10 border-primary text-primary font-medium'
                            : 'bg-card hover:bg-accent/50 border-border text-foreground'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="truncate font-medium">{conv.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className="capitalize">{conv.screenContext.replace(/_/g, ' ')}</span>
                            <span>•</span>
                            <span>{new Date(conv.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 rounded-md"
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Chat Thread */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 text-xs">
              {/* Screen Context Banner */}
              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/15 flex items-center justify-between text-[11px] text-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-semibold text-primary">{screenContextInfo.badge}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {configuredModel && (
                    <span
                      className="font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 text-[9.5px]"
                      title="Configured Primary Model in Settings -> AI & Copilot Configuration"
                    >
                      Primary: {configuredModel.replace('-preview', '')}
                    </span>
                  )}
                  <span>Screen: {screenContextInfo.screenTitle}</span>
                </div>
              </div>

              {/* Quota Exceeded Alert Banner */}
              {quota && quota.isLimitReached && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Daily Free Quota Exceeded (50/50 messages)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    You have utilized all free Copilot queries for today. Your quota automatically resets at{' '}
                    <strong>{new Date(quota.resetAt).toLocaleTimeString()}</strong>.
                  </p>
                </div>
              )}

              {/* Empty State with Suggested Prompts */}
              {messages.length === 0 && (
                <div className="py-4 space-y-3">
                  <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-2 text-center">
                    <Bot className="w-7 h-7 mx-auto text-primary" />
                    <h4 className="font-bold text-xs text-foreground">How can I assist your calibration workflow?</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      I understand ISO/IEC 17025 metrology standards, formulas, measurement uncertainties, and tolerance limits.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-primary" />
                      Suggested for {screenContextInfo.screenTitle}:
                    </span>
                    <div className="space-y-1.5">
                      {screenContextInfo.suggestedPrompts.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          className="w-full text-left p-2 rounded-lg bg-card hover:bg-primary/10 border border-border hover:border-primary/30 text-[11px] text-foreground transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <span className="truncate pr-2">{sug}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Message List */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-indigo-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-xl p-3 text-xs leading-relaxed space-y-2 relative ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-primary to-blue-600 text-primary-foreground font-medium rounded-br-xs shadow-xs'
                        : 'bg-card border border-border text-foreground rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {/* Assistant Header */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center justify-between pb-1 border-b border-border/50 text-[9.5px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-primary">
                            <Sparkles className="w-2.5 h-2.5" />
                            {msg.model ? `${msg.model}` : 'Gemini Cloud Copilot'}
                          </span>
                          {msg.isFallback && (
                            <span
                              className="text-[8.5px] px-1.5 py-0.2 rounded font-sans bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium cursor-help"
                              title={`Auto-Fallback: Your primary model (${msg.requestedModel || configuredModel || 'selected'}) hit Google free tier quota limit (429). The system automatically routed your request to ${msg.model} to ensure zero downtime.`}
                            >
                              Auto-Fallback
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground font-mono">{msg.timestamp}</span>
                      </div>
                    )}

                    {/* Requirement 4: User Message Content or Inline Edit Box */}
                    {msg.role === 'user' && editingMessageId === msg.id ? (
                      <div className="space-y-2 w-full min-w-[240px]">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          className="w-full text-xs p-2 rounded-lg bg-background text-foreground border border-white/40 focus:outline-hidden focus:ring-1 focus:ring-white resize-y"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
                            className="px-2 py-0.5 text-[11px] rounded bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditAndResend(msg.id)}
                            disabled={!editContent.trim()}
                            className="px-2.5 py-0.5 text-[11px] rounded bg-white text-primary font-semibold hover:bg-white/90 transition-colors cursor-pointer shadow-xs"
                          >
                            Save & Resend
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Content */
                      <div className="space-y-1.5 overflow-x-auto">
                        {msg.role === 'assistant' ? (
                          <AssistantMarkdownRenderer
                            content={msg.content}
                            onSelectSuggestion={(sug) => handleSendMessage(sug)}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    )}

                    {/* Proactive Suggestions */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="pt-2 border-t border-border/60 space-y-1">
                        <span className="text-[9.5px] font-semibold text-muted-foreground">Follow-up actions:</span>
                        <div className="flex flex-wrap gap-1">
                          {msg.suggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleSendMessage(sug)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10.5px] font-medium border border-primary/20 transition-all cursor-pointer text-left"
                            >
                              <span className="w-1 h-1 rounded-full bg-primary" />
                              <span>{sug}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Requirement 4: Message Action Toolbar (Edit, Delete, Resend, Copy) */}
                    <div
                      className={`flex items-center justify-between pt-1.5 border-t text-[10px] transition-opacity duration-150 ${
                        msg.role === 'user'
                          ? 'border-white/20 text-primary-foreground/90'
                          : 'border-border/60 text-muted-foreground'
                      }`}
                    >
                      <span className="font-mono text-[9px] opacity-75">{msg.timestamp}</span>

                      <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Copy Button */}
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="flex items-center gap-1 p-0.5 px-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                          title="Copy text"
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span className="hidden sm:inline">
                            {copiedMessageId === msg.id ? 'Copied' : 'Copy'}
                          </span>
                        </button>

                        {/* User Message Edit Button */}
                        {msg.role === 'user' && editingMessageId !== msg.id && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(msg)}
                            className="flex items-center gap-1 p-0.5 px-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title="Edit message"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        )}

                        {/* Resend / Retry Button */}
                        {msg.role === 'user' && (
                          <button
                            type="button"
                            onClick={() => handleResend(msg.content)}
                            className="flex items-center gap-1 p-0.5 px-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title="Resend prompt"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span className="hidden sm:inline">Resend</span>
                          </button>
                        )}

                        {/* Assistant Message Regenerate Button */}
                        {msg.role === 'assistant' && (
                          <button
                            type="button"
                            onClick={() => handleRegenerate(msg.id)}
                            className="flex items-center gap-1 p-0.5 px-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title="Regenerate response"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span className="hidden sm:inline">Regenerate</span>
                          </button>
                        )}

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="flex items-center gap-1 p-0.5 px-1.5 rounded hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-xl text-xs text-muted-foreground animate-pulse shadow-2xs">
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span>Metrology Copilot is analyzing specifications & standard formulas...</span>
                </div>
              )}
            </div>

            {/* Attachment Preview Chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 py-1.5 bg-card border-t border-border">
                {attachments.map((att, aIdx) => (
                  <div
                    key={aIdx}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-medium"
                  >
                    <Paperclip className="w-3 h-3 text-primary" />
                    <span className="truncate max-w-[120px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== aIdx))}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Input Area */}
            <div className="p-2.5 bg-card border-t border-border flex items-center gap-2 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".xlsx,.xls,.csv,.pdf,.docx,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFileSelect(e.target.files);
                  e.target.value = '';
                }}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || Boolean(quota?.isLimitReached)}
                className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer shrink-0 rounded-full"
                title="Attach Calibration Document, Certificate, or Drawing"
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              <div className="flex-1 relative flex items-center">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={loading || Boolean(quota?.isLimitReached)}
                  placeholder={
                    quota?.isLimitReached
                      ? 'Daily quota exhausted for today'
                      : `Ask Copilot about ${screenContextInfo.screenTitle}...`
                  }
                  className="h-9 text-xs pr-9 pl-3.5 rounded-full shadow-2xs focus-visible:ring-primary bg-background"
                />

                <Button
                  type="button"
                  size="icon"
                  disabled={(!input.trim() && attachments.length === 0) || loading || Boolean(quota?.isLimitReached)}
                  onClick={() => handleSendMessage()}
                  className="h-7 w-7 absolute right-1 cursor-pointer rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center justify-center"
                  title="Send Prompt"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
