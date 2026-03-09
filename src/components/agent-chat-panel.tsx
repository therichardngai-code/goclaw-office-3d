import { useState, useEffect, useRef, useCallback } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { streamChat, type ChatMessage } from "@/api/chat-api";
import { hex6, stateHex } from "@/scene/utils";

// Persists chat history across panel close/reopen — keyed by agent ID
const chatHistoryCache = new Map<string, ChatMessage[]>();

export function AgentChatPanel() {
  const agent = useOfficeStore((s) => s.selectedAgent);
  const setSelectedAgent = useOfficeStore((s) => s.setSelectedAgent);
  // Re-read agent from live snapshot so status dot stays current
  const liveAgent = useOfficeStore((s) =>
    agent ? (s.mergedSnapshot?.agents[agent.id] ?? agent) : null
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState("");
  const [minimized, setMinimized] = useState(false);

  const cancelRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore cached history when agent changes; cancel any in-flight stream
  useEffect(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setMessages(agent ? (chatHistoryCache.get(agent.id) ?? []) : []);
    setInput("");
    setError("");
    setStreaming(false);
    setStreamingContent("");
    setMinimized(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [agent?.id]);

  // Persist history to cache whenever messages change
  useEffect(() => {
    if (agent && messages.length > 0) {
      chatHistoryCache.set(agent.id, messages);
    }
  }, [agent, messages]);

  // Auto-scroll to bottom on new messages/tokens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = useCallback(() => {
    if (!agent || !input.trim() || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setError("");
    setStreaming(true);
    setStreamingContent("");

    cancelRef.current = streamChat(
      agent.name,
      nextHistory,
      (token) => setStreamingContent((prev) => prev + token),
      (fullContent) => {
        setMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
        setStreamingContent("");
        setStreaming(false);
        cancelRef.current = null;
      },
      (err) => {
        setError(err);
        setStreaming(false);
        setStreamingContent("");
        cancelRef.current = null;
      }
    );
  }, [agent, input, messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") setSelectedAgent(null);
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
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#2a2a3a] rounded-t-xl cursor-default select-none">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors"
          style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
        />
        <span className="flex-1 text-sm font-semibold text-white truncate">{displayName}</span>
        <span className="text-xs text-white/30 italic mr-1">{liveAgent.state}</span>
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
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0" style={{ maxHeight: "360px" }}>
            {messages.length === 0 && !streaming && (
              <p className="text-white/25 text-xs italic text-center mt-6">
                Start a conversation with {displayName}
              </p>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[#e8352a]/80 text-white rounded-br-sm"
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
                  {streamingContent || (
                    <span className="text-white/30 italic">Thinking…</span>
                  )}
                  <span className="inline-block w-0.5 h-3.5 bg-white/60 ml-0.5 align-middle animate-pulse" />
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-xs px-1">{error}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 px-3 py-3 border-t border-[#2a2a3a]">
            <input
              ref={inputRef}
              className="flex-1 px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#e8352a]/60 transition-colors"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
            />
            <button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-[#e8352a] hover:bg-[#c42d22] text-white transition-colors disabled:opacity-40"
            >
              →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
