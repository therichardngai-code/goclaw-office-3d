// Session history list — shown inside the chat panel when the user clicks the
// history button. Each row represents one past (or current) chat session.
// Clicking a row switches the active session and reloads its messages.
import type { StoredSession } from "@/api/chat-ws";

interface Props {
  sessions: StoredSession[];
  activeKey: string;
  onSelect: (key: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` ${time}`;
}

export function ChatHistoryPanel({ sessions, activeKey, onSelect }: Props) {
  if (sessions.length === 0) {
    return (
      <p className="text-white/25 text-xs italic text-center mt-8">
        No previous sessions
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {sessions.map((s, i) => {
        const isActive = s.key === activeKey;
        return (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
              isActive
                ? "bg-[#00ADD8]/15 border border-[#00ADD8]/30 text-white"
                : "hover:bg-white/5 text-white/60 hover:text-white border border-transparent"
            }`}
          >
            {/* index badge */}
            <span className="text-[10px] text-white/25 w-4 text-right flex-shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{formatDate(s.startedAt)}</p>
              {isActive && (
                <p className="text-[10px] text-[#00ADD8]/60 mt-0.5">Active session</p>
              )}
            </div>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ADD8] flex-shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
