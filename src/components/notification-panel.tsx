import { useOfficeStore } from "@/stores/use-office-store";

const TYPE_COLORS: Record<string, string> = {
  delegation: "text-purple-400",
  team: "text-yellow-400",
  "run.started": "text-green-400",
  "run.completed": "text-green-400",
  "run.failed": "text-red-400",
  "tool.call": "text-orange-400",
  agent_link: "text-cyan-400",
  agent: "text-blue-400",
  handoff: "text-orange-400",
  system: "text-gray-400",
};

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationPanel() {
  const open = useOfficeStore((s) => s.notificationPanelOpen);
  const toggle = useOfficeStore((s) => s.toggleNotificationPanel);
  const snapshot = useOfficeStore((s) => s.snapshot);

  const notifications = snapshot?.notifications ?? [];

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 bg-black/50 hover:bg-black/70 px-3 py-1.5 rounded text-white/80 text-sm z-40"
      >
        {open ? "Close" : "Notifications"} ({notifications.length})
      </button>

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-[#12121a] border-l border-[#2a2a3a] transform transition-transform duration-300 z-50 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3a]">
          <h2 className="text-white font-semibold">Notifications</h2>
          <button
            onClick={toggle}
            className="text-gray-400 hover:text-white text-xl"
          >
            x
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-60px)]">
          {notifications.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">No notifications</div>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {[...notifications].reverse().map((n) => (
                <div key={n.id} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-medium ${
                        TYPE_COLORS[n.type] ?? "text-gray-400"
                      }`}
                    >
                      {n.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getRelativeTime(n.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 break-words">
                    {n.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
