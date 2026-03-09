// Live WS event feed — mirrors goclaw ui/web "Realtime Events" page but inside the panel
import { useState, useEffect, useRef } from "react";
import { useEventStore, type WsEventEntry } from "@/stores/use-event-store";
import { EventJsonDetail } from "./json-highlight";

// Event type → left-border color + label color
function eventStyle(event: string): { border: string; badge: string; label: string } {
  if (event.startsWith("delegation."))   return { border: "border-l-blue-500",   badge: "bg-blue-500/15 text-blue-300",   label: "delegation" };
  if (event.startsWith("team.task."))    return { border: "border-l-amber-500",  badge: "bg-amber-500/15 text-amber-300", label: "task" };
  if (event === "team.message.sent")     return { border: "border-l-green-500",  badge: "bg-green-500/15 text-green-300", label: "message" };
  if (event === "agent")                 return { border: "border-l-purple-500", badge: "bg-purple-500/15 text-purple-300", label: "agent" };
  if (event.startsWith("agent_link."))  return { border: "border-l-cyan-500",   badge: "bg-cyan-500/15 text-cyan-300",   label: "link" };
  if (event.startsWith("team."))        return { border: "border-l-gray-500",   badge: "bg-gray-500/15 text-gray-300",   label: "team" };
  if (event.startsWith("agent."))       return { border: "border-l-indigo-500", badge: "bg-indigo-500/15 text-indigo-300", label: "agent" };
  if (event.startsWith("run."))         return { border: "border-l-green-400",  badge: "bg-green-400/15 text-green-200", label: "run" };
  return { border: "border-l-white/20", badge: "bg-white/10 text-white/50", label: "" };
}

function relTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function EventRow({ entry }: { entry: WsEventEntry }) {
  const [expanded, setExpanded] = useState(false);
  const style = eventStyle(entry.event);

  // Derive human-readable sub-label from payload
  const p = entry.payload as Record<string, unknown> | null;
  const subLabel = (() => {
    if (!p) return "";
    if (entry.event === "agent") return String(p.type ?? "");
    const src = String(p.source_display_name ?? p.source_agent_key ?? p.from_display_name ?? p.from_agent_key ?? "");
    const tgt = String(p.target_display_name ?? p.target_agent_key ?? p.to_display_name ?? p.to_agent_key ?? "");
    if (src && tgt) return `${src} → ${tgt}`;
    return String(p.team_name ?? p.subject ?? p.display_name ?? p.agent_key ?? "");
  })();

  return (
    <div
      className={`border-l-4 rounded-r overflow-hidden bg-[#10101c] hover:bg-[#14141f] transition-colors ${style.border}`}
    >
      <button
        type="button"
        className="w-full text-left px-2.5 py-2"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs ${style.badge}`}>
            {entry.event}
          </span>
          <span className="flex-1 truncate text-xs text-white/50">{subLabel}</span>
          <span className="shrink-0 text-xs text-white/25">{relTime(entry.timestamp)}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5">
          <EventJsonDetail
            eventName={entry.event}
            payload={entry.payload}
            onClose={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}

export function EventsTab() {
  const events = useEventStore((s) => s.events);
  const paused = useEventStore((s) => s.paused);
  const setPaused = useEventStore((s) => s.setPaused);
  const clear = useEventStore((s) => s.clear);
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (atBottom && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length, atBottom]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setAtBottom(scrollHeight - scrollTop - clientHeight < 40);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a3a]">
        <span className={`w-1.5 h-1.5 rounded-full ${paused ? "bg-gray-500" : "bg-green-500"}`} />
        <span className="text-xs text-white/40 flex-1">{events.length} events</span>
        <button
          onClick={() => setPaused(!paused)}
          className="text-xs text-white/40 hover:text-white/80 px-2 py-0.5 rounded border border-[#2a2a3a] hover:border-[#3a3a4a] transition-colors"
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={clear}
          className="text-xs text-white/40 hover:text-red-400 px-2 py-0.5 rounded border border-[#2a2a3a] hover:border-red-500/40 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Feed */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1"
      >
        {events.length === 0 ? (
          <p className="text-xs text-white/25 italic text-center mt-8">
            Waiting for events…
          </p>
        ) : (
          [...events].reverse().map((e) => <EventRow key={e.id} entry={e} />)
        )}
      </div>
    </div>
  );
}
