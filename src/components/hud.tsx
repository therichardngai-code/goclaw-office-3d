import { useOfficeStore } from "@/stores/use-office-store";

export function HUD() {
  const connected = useOfficeStore((s) => s.connected);
  const snapshot = useOfficeStore((s) => s.snapshot);
  const toggleAgentPanel = useOfficeStore((s) => s.toggleAgentPanel);

  const agentCount = snapshot ? Object.keys(snapshot.agents).length : 0;
  const version = snapshot?.gateway.version ?? "-";
  const eventCount = snapshot?.gateway.eventCount ?? 0;

  return (
    <div className="fixed top-4 left-4 flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded">
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-green-500" : "bg-gray-500"
          }`}
        />
        <span className="text-white/80">
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>
      <button
        onClick={toggleAgentPanel}
        className="bg-black/50 px-3 py-1.5 rounded text-white/60 hover:text-white hover:bg-black/70 transition-colors"
      >
        {agentCount} agents
      </button>
      <div className="bg-black/50 px-3 py-1.5 rounded text-white/60">
        v{version}
      </div>
      <div className="bg-black/50 px-3 py-1.5 rounded text-white/60">
        {eventCount.toLocaleString()} events
      </div>
    </div>
  );
}
