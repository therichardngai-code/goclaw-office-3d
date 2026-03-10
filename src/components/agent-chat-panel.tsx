import { useState, useEffect, useRef, useCallback } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { hex6, stateHex } from "@/scene/utils";
import {
  getOrCreateSessionKey, loadChatHistory, clearSessionKey,
  switchToSession, getSessionList, type StoredSession,
} from "@/api/chat-ws";
import { ChatHistoryPanel } from "@/components/agent-panel/chat-history-panel";
import type { ChatMessage } from "@/api/chat-api";

export function AgentChatPanel() {
  const agent = useOfficeStore((s) => s.selectedAgent);
  const setSelectedAgent = useOfficeStore((s) => s.setSelectedAgent);
  // Re-read agent from live snapshot so status dot stays current
  const liveAgent = useOfficeStore((s) =>
    agent ? (s.mergedSnapshot?.agents[agent.id] ?? agent) : null
  );
  // WS call fn (null when disconnected)
  const wsCall = useOfficeStore((s) => s.wsCall);
  // WS→chat bridge slots
  const incomingChatChunk    = useOfficeStore((s) => s.incomingChatChunk);
  const setIncomingChatChunk = useOfficeStore((s) => s.setIncomingChatChunk);
  const incomingChatMessage  = useOfficeStore((s) => s.incomingChatMessage);
  const setIncomingChatMessage = useOfficeStore((s) => s.setIncomingChatMessage);
  const incomingChatError    = useOfficeStore((s) => s.incomingChatError);
  const setIncomingChatError = useOfficeStore((s) => s.setIncomingChatError);

  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [input, setInput]                     = useState("");
  const [streaming, setStreaming]             = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [error, setError]                     = useState("");
  const [minimized, setMinimized]             = useState(false);
  const [historyOpen, setHistoryOpen]         = useState(false);
  const [sessionList, setSessionList]         = useState<StoredSession[]>([]);

  // Accumulate chunk tokens without per-token re-renders
  const streamingRef   = useRef("");
  const sessionKeyRef  = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // ── Load history when agent / wsCall changes ──────────────────────────────
  useEffect(() => {
    if (!agent) {
      setMessages([]); setInput(""); setError("");
      setStreaming(false); setStreamingContent("");
      streamingRef.current = "";
      setMinimized(false); setHistoryOpen(false); setSessionList([]);
      return;
    }

    const key = getOrCreateSessionKey(agent.id);
    sessionKeyRef.current = key;
    setSessionList(getSessionList(agent.id));
    setMessages([]); setError("");
    setStreaming(false); setStreamingContent("");
    streamingRef.current = "";
    setMinimized(false); setHistoryOpen(false);

    if (!wsCall) return;

    setHistoryLoading(true);
    loadChatHistory(wsCall, agent.id, key).then((msgs) => {
      setMessages(msgs);
      setHistoryLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }, [agent?.id, wsCall]);

  // Auto-scroll to bottom on new messages / streaming tokens
  useEffect(() => {
    if (!historyOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, historyOpen]);

  // ── WS bridge: chunk tokens ───────────────────────────────────────────────
  useEffect(() => {
    if (!incomingChatChunk || !agent) return;
    if (incomingChatChunk.agentKey !== agent.name) return;
    streamingRef.current += incomingChatChunk.content;
    setStreamingContent(streamingRef.current);
    setStreaming(true);
    setIncomingChatChunk(null);
  }, [incomingChatChunk, agent?.name, setIncomingChatChunk]);

  // ── WS bridge: run.completed ──────────────────────────────────────────────
  useEffect(() => {
    if (!incomingChatMessage || !agent) return;
    if (incomingChatMessage.agentKey !== agent.name) return;

    const finalContent = incomingChatMessage.content || streamingRef.current;
    if (finalContent) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === finalContent) return prev;
        return [...prev, { role: "assistant", content: finalContent }];
      });
    }
    streamingRef.current = "";
    setStreamingContent("");
    setStreaming(false);
    setIncomingChatMessage(null);
  }, [incomingChatMessage, agent?.name, setIncomingChatMessage]);

  // ── WS bridge: run.failed ─────────────────────────────────────────────────
  useEffect(() => {
    if (!incomingChatError || !agent) return;
    if (incomingChatError.agentKey !== agent.name) return;
    setError(incomingChatError.error);
    streamingRef.current = "";
    setStreamingContent("");
    setStreaming(false);
    setIncomingChatError(null);
  }, [incomingChatError, agent?.name, setIncomingChatError]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!agent || !input.trim() || streaming || !wsCall) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput(""); setError("");
    setStreaming(true);
    streamingRef.current = "";
    setStreamingContent("");

    wsCall("chat.send", {
      agentId: agent.id,
      sessionKey: sessionKeyRef.current,
      message: userMsg.content,
      stream: true,
    }).catch((err: unknown) => {
      setError(String(err));
      setStreaming(false);
    });
  }, [agent, input, streaming, wsCall]);

  // ── New session ───────────────────────────────────────────────────────────
  const handleNewSession = useCallback(() => {
    if (!agent) return;
    clearSessionKey(agent.id);
    const key = getOrCreateSessionKey(agent.id);
    sessionKeyRef.current = key;
    setSessionList(getSessionList(agent.id));
    setMessages([]); setError("");
    streamingRef.current = "";
    setStreamingContent("");
    setStreaming(false);
    setHistoryOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [agent]);

  // ── Switch to a past session ──────────────────────────────────────────────
  const handleSelectSession = useCallback(async (key: string) => {
    if (!agent || !wsCall) return;
    switchToSession(agent.id, key);
    sessionKeyRef.current = key;
    setHistoryOpen(false);
    setMessages([]); setError("");
    streamingRef.current = "";
    setStreamingContent("");
    setStreaming(false);
    setHistoryLoading(true);
    const msgs = await loadChatHistory(wsCall, agent.id, key);
    setMessages(msgs);
    setHistoryLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [agent, wsCall]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") {
      if (historyOpen) { setHistoryOpen(false); return; }
      setSelectedAgent(null);
    }
  };

  if (!agent || !liveAgent) return null;

  const statusColor = hex6(stateHex(liveAgent.state));
  const displayName = liveAgent.displayName || liveAgent.name;

  return (
    <div
      className="fixed bottom-6 right-6 w-[380px] flex flex-col rounded-xl border border-[#2a2a3a] bg-[#0e0e1a]/95 backdrop-blur shadow-2xl z-50"
      style={{ maxHeight: minimized ? "auto" : "520px" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#2a2a3a] rounded-t-xl select-none">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors"
          style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
        />
        <span className="flex-1 text-sm font-semibold text-white truncate">{displayName}</span>
        <span className="text-xs text-white/30 italic">{liveAgent.state}</span>
        {/* History button */}
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          className={`px-1 transition-colors text-xs leading-none ${
            historyOpen ? "text-[#00ADD8]" : "text-white/30 hover:text-white/70"
          }`}
          title="Chat history"
        >
          ☰
        </button>
        {/* New session button */}
        <button
          onClick={handleNewSession}
          className="text-white/30 hover:text-white/70 px-1 transition-colors text-xs leading-none"
          title="New conversation"
        >
          ✦
        </button>
        <button
          onClick={() => setMinimized((m) => !m)}
          className="text-white/40 hover:text-white/80 px-1 transition-colors text-base leading-none"
          title={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? "▲" : "▼"}
        </button>
        <button
          onClick={() => setSelectedAgent(null)}
          className="text-white/40 hover:text-white/80 px-1 transition-colors text-base leading-none"
          title="Close"
        >
          ✕
        </button>
      </div>

      {!minimized && (
        <>
          {/* Body — either session history list or message thread */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0" style={{ maxHeight: "360px" }}>

            {historyOpen ? (
              /* ── Session list ── */
              <>
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                  Previous Sessions ({sessionList.length})
                </p>
                <ChatHistoryPanel
                  sessions={sessionList}
                  activeKey={sessionKeyRef.current}
                  onSelect={handleSelectSession}
                />
              </>
            ) : (
              /* ── Message thread ── */
              <>
                {historyLoading && (
                  <p className="text-white/25 text-xs italic text-center mt-6">Loading history…</p>
                )}
                {!historyLoading && messages.length === 0 && !streaming && (
                  <p className="text-white/25 text-xs italic text-center mt-6">
                    Start a conversation with {displayName}
                  </p>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-[#00ADD8]/80 text-white rounded-br-sm"
                          : "bg-[#1a1a2e] text-white/90 border border-[#2a2a3a] rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {/* Streaming bubble */}
                {streaming && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg rounded-bl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-[#1a1a2e] text-white/90 border border-[#2a2a3a]">
                      {streamingContent || <span className="text-white/30 italic">Thinking…</span>}
                      <span className="inline-block w-0.5 h-3.5 bg-white/60 ml-0.5 align-middle animate-pulse" />
                    </div>
                  </div>
                )}

                {error && <p className="text-red-400 text-xs px-1">{error}</p>}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input — hidden while history panel is open */}
          {!historyOpen && (
            <div className="flex gap-2 px-3 py-3 border-t border-[#2a2a3a]">
              <input
                ref={inputRef}
                className="flex-1 px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00ADD8]/60 transition-colors"
                placeholder={!wsCall ? "Connecting…" : "Type a message…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming || !wsCall}
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim() || !wsCall}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-[#00ADD8] hover:bg-[#007D9C] text-white transition-colors disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
