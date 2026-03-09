import { useState } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import type { Notification } from "@/api/types";
import { EventJsonDetail } from "./notification-panel/json-highlight";
import { EventsTab } from "./notification-panel/events-tab";

const TYPE_COLORS: Record<string, string> = {
  delegation: "text-purple-400",
  team: "text-yellow-400",
  "team.task": "text-yellow-300",
  "team.message": "text-amber-400",
  "run.started": "text-green-400",
  "run.completed": "text-green-400",
  "run.failed": "text-red-400",
  "tool.call": "text-orange-400",
  "agent.summoning": "text-blue-300",
  agent_link: "text-cyan-400",
  agent: "text-blue-400",
  system: "text-gray-400",
};

function relTime(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationItem({ n }: { n: Notification }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!n.rawPayload;

  return (
    <div className="border-b border-[#2a2a3a] last:border-0">
      <button
        type="button"
        className={`w-full text-left p-3 ${hasDetail ? "hover:bg-white/[0.03] cursor-pointer" : "cursor-default"} transition-colors`}
        onClick={() => hasDetail && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium ${TYPE_COLORS[n.type] ?? "text-gray-400"}`}>
            {n.type}
          </span>
          <span className="text-xs text-gray-500">{relTime(n.timestamp)}</span>
              {hasDetail && (
            <span className="ml-auto text-xs text-white/20">{expanded ? "▲" : "▼"}</span>
          )}
        </div>
        <p className="text-sm text-white/80 break-words text-left">{n.message}</p>
      </button>
      {expanded && n.rawPayload != null && (
        <div className="px-3 pb-3">
          <EventJsonDetail
            eventName={n.rawEventName ?? n.type}
            payload={n.rawPayload}
            onClose={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}

type Tab = "notifications" | "events";

export function NotificationPanel() {
  const open = useOfficeStore((s) => s.notificationPanelOpen);
  const toggle = useOfficeStore((s) => s.toggleNotificationPanel);
  const snapshot = useOfficeStore((s) => s.snapshot);
  const [tab, setTab] = useState<Tab>("notifications");

  const notifications = snapshot?.notifications ?? [];

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 bg-black/50 hover:bg-black/70 px-3 py-1.5 rounded text-white/80 text-sm z-40 transition-colors"
      >
        {open ? "Close" : "Notifications"} ({notifications.length})
      </button>

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-[#12121a] border-l border-[#2a2a3a] flex flex-col transform transition-transform duration-300 z-50 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3a] shrink-0">
          <h2 className="text-white font-semibold">Live Feed</h2>
          <button onClick={toggle} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a3a] shrink-0">
          {(["notifications", "events"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors capitalize ${
                tab === t
                  ? "text-white border-b-2 border-[#00ADD8]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t === "notifications" ? `Notifications (${notifications.length})` : "Events"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {tab === "notifications" ? (
            <div className="h-full overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-gray-500 text-sm">No notifications</p>
              ) : (
                <div>
                  {[...notifications].reverse().map((n) => (
                    <NotificationItem key={n.id} n={n} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EventsTab />
          )}
        </div>
      </div>
    </>
  );
}
