import { httpClient } from './httpClient';

export interface DailyQuotaStatus {
  quotaDate: string;
  messageCount: number;
  dailyMessageLimit: number;
  remaining: number;
  tokensUsed: number;
  dailyTokenLimit: number;
  resetAt: string;
  isLimitReached: boolean;
}

export interface StoredConversation {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  screenContext: string;
  entityId?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  actionPayload?: any;
  attachments?: any[];
  suggestions?: string[];
  createdAt: string;
}

export interface CopilotSendPayload {
  prompt: string;
  conversationId?: string;
  screenContext?: string;
  entityId?: string;
  context?: any;
  attachments?: any[];
  history?: any[];
}

export interface CopilotResponsePayload {
  rawText: string;
  modelUsed?: string;
  requestedModel?: string;
  isFallback?: boolean;
  conversationId: string;
  timestamp: string;
  quota?: DailyQuotaStatus;
}

/**
 * Retrieves the current daily message & token quota for the user.
 */
export async function getDailyQuotaStatus(): Promise<DailyQuotaStatus | null> {
  try {
    const res = await httpClient.get<DailyQuotaStatus>('/ai/quota');
    return res.data;
  } catch (err) {
    console.warn('Failed to fetch daily quota status:', err);
    return null;
  }
}

/**
 * Retrieves list of past conversations for the user, optionally filtered by screenContext.
 */
export async function getUserConversations(screenContext?: string): Promise<StoredConversation[]> {
  try {
    const res = await httpClient.get<StoredConversation[]>('/ai/conversations', {
      params: screenContext ? { screenContext } : undefined,
    });
    return res.data || [];
  } catch (err) {
    console.warn('Failed to fetch user conversations:', err);
    return [];
  }
}

/**
 * Retrieves messages for a specific conversation session.
 */
export async function getConversationMessages(conversationId: string): Promise<StoredMessage[]> {
  try {
    const res = await httpClient.get<StoredMessage[]>(`/ai/conversations/${conversationId}/messages`);
    return res.data || [];
  } catch (err) {
    console.warn('Failed to fetch conversation messages:', err);
    return [];
  }
}

/**
 * Deletes a conversation session and its history.
 */
export async function deleteUserConversation(conversationId: string): Promise<boolean> {
  try {
    await httpClient.delete(`/ai/conversations/${conversationId}`);
    return true;
  } catch (err) {
    console.warn('Failed to delete conversation:', err);
    return false;
  }
}

/**
 * Sends a prompt to the ISO 17025 Metrology Copilot via backend gateway.
 */
export async function sendCopilotPrompt(payload: CopilotSendPayload): Promise<CopilotResponsePayload> {
  const res = await httpClient.post<CopilotResponsePayload>('/ai/copilot', payload);
  return res.data;
}
