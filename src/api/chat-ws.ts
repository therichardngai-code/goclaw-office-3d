// WS-based chat: server-persisted sessions + history.
// Replaces the stateless HTTP /v1/chat/completions approach so chat history
// survives page refresh (stored in goclaw's DB, not just in-memory).
import type { ChatMessage } from "@/api/chat-api";

type WsCallFn = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

// ── Active session key ────────────────────────────────────────────────────────
// Persisted per-agent in localStorage so the same session is resumed on refresh.
// Format mirrors goclaw ui/web: agent:{agentId}:ws-{userId}-{timestamp}

const SESSION_KEY_PREFIX  = "goclaw:chat-session:";
const SESSION_LIST_PREFIX = "goclaw:chat-sessions:";
const MAX_SESSIONS = 20;

// ── Session list ──────────────────────────────────────────────────────────────
// Ordered list (newest first) of all sessions created for an agent.
// Stored separately so clearing the active key doesn't lose history.

export interface StoredSession {
  key: string;
  startedAt: number; // ms timestamp
}

export function getSessionList(agentId: string): StoredSession[] {
  try {
    const raw = localStorage.getItem(`${SESSION_LIST_PREFIX}${agentId}`);
    return raw ? (JSON.parse(raw) as StoredSession[]) : [];
  } catch {
    return [];
  }
}

function saveSessionList(agentId: string, sessions: StoredSession[]): void {
  localStorage.setItem(`${SESSION_LIST_PREFIX}${agentId}`, JSON.stringify(sessions));
}

// Adds key to the session list if not already present. Called automatically by
// getOrCreateSessionKey so every session is tracked from first use.
export function recordSession(agentId: string, key: string): void {
  const sessions = getSessionList(agentId);
  if (sessions.some((s) => s.key === key)) return;
  saveSessionList(agentId, [{ key, startedAt: Date.now() }, ...sessions].slice(0, MAX_SESSIONS));
}

// ── Active key management ─────────────────────────────────────────────────────

export function getOrCreateSessionKey(agentId: string): string {
  const stored = localStorage.getItem(`${SESSION_KEY_PREFIX}${agentId}`);
  if (stored) {
    recordSession(agentId, stored); // ensure it's in the list (idempotent)
    return stored;
  }
  const userId = localStorage.getItem("goclaw:userId") ?? "default";
  const key = `agent:${agentId}:ws-${userId}-${Date.now().toString(36)}`;
  localStorage.setItem(`${SESSION_KEY_PREFIX}${agentId}`, key);
  recordSession(agentId, key);
  return key;
}

// Clears the active session pointer — session stays in the history list
// so it can still be loaded and resumed later.
export function clearSessionKey(agentId: string): void {
  localStorage.removeItem(`${SESSION_KEY_PREFIX}${agentId}`);
}

// Sets an existing session key as the currently active one (for session switching).
export function switchToSession(agentId: string, key: string): void {
  localStorage.setItem(`${SESSION_KEY_PREFIX}${agentId}`, key);
}

// ── History ───────────────────────────────────────────────────────────────────
// Loads message history for a session via the chat.history WS RPC.
// Returns only user/assistant messages — skips tool/system rows.

interface RawMessage {
  role: string;
  content?: string;
}

export async function loadChatHistory(
  wsCall: WsCallFn,
  agentId: string,
  sessionKey: string
): Promise<ChatMessage[]> {
  try {
    const res = await wsCall("chat.history", { agentId, sessionKey }) as { messages?: RawMessage[] };
    return (res.messages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }))
      .filter((m) => m.content.trim() !== "");
  } catch {
    return [];
  }
}
