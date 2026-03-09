// WS-based chat: server-persisted sessions + history.
// Replaces the stateless HTTP /v1/chat/completions approach so chat history
// survives page refresh (stored in goclaw's DB, not just in-memory).
import type { ChatMessage } from "@/api/chat-api";

type WsCallFn = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

// ── Session key ───────────────────────────────────────────────────────────────
// Persisted per-agent in localStorage so the same session is resumed on refresh.
// Format mirrors goclaw ui/web: agent:{agentId}:ws-{userId}-{timestamp}

const SESSION_KEY_PREFIX = "goclaw:chat-session:";

export function getOrCreateSessionKey(agentId: string): string {
  const stored = localStorage.getItem(`${SESSION_KEY_PREFIX}${agentId}`);
  if (stored) return stored;
  const userId = localStorage.getItem("goclaw:userId") ?? "default";
  const key = `agent:${agentId}:ws-${userId}-${Date.now().toString(36)}`;
  localStorage.setItem(`${SESSION_KEY_PREFIX}${agentId}`, key);
  return key;
}

export function clearSessionKey(agentId: string): void {
  localStorage.removeItem(`${SESSION_KEY_PREFIX}${agentId}`);
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
