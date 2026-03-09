import { useState } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { CharacterPreview } from "./character-preview";
import { stateHex, hex6, cap } from "@/scene/utils";

export function ConnectionTab() {
  const snapshot = useOfficeStore((s) => s.mergedSnapshot);
  const agents = snapshot ? Object.values(snapshot.agents) : [];
  const [idx, setIdx] = useState(0);

  if (agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        No agents connected.
      </div>
    );
  }

  const safeIdx = Math.min(idx, agents.length - 1);
  const agent = agents[safeIdx]!;
  const stateColor = hex6(stateHex(agent.state));
  const displayName = agent.displayName || agent.name;

  const prev = () => setIdx((i) => (Math.min(i, agents.length - 1) - 1 + agents.length) % agents.length);
  const next = () => setIdx((i) => (Math.min(i, agents.length - 1) + 1) % agents.length);

  return (
    <div className="flex h-full">
      {/* Left: character + carousel */}
      <div className="w-[240px] flex-shrink-0 flex flex-col items-center justify-between bg-[#0a0a0f] border-r border-[#1e1e2a] py-6 px-4">
        <div className="pointer-events-none">
          <CharacterPreview characterIndex={agent.characterIndex} width={180} height={230} />
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-white font-semibold text-sm text-center">{displayName}</p>

          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            >
              ‹
            </button>

            {/* Dots — max 8; fallback to counter only */}
            {agents.length <= 8 ? (
              <div className="flex gap-1.5">
                {agents.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === safeIdx ? "bg-white" : "bg-gray-600 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            ) : (
              <span className="text-gray-400 text-xs">{safeIdx + 1} / {agents.length}</span>
            )}

            <button
              onClick={next}
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            >
              ›
            </button>
          </div>

          {agents.length <= 8 && (
            <p className="text-gray-600 text-xs">{safeIdx + 1} / {agents.length}</p>
          )}
        </div>
      </div>

      {/* Right: agent details */}
      <div className="flex-1 flex flex-col p-6 gap-4 min-h-0 overflow-y-auto">
        <h3 className="text-white font-semibold text-base">{displayName}</h3>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <InfoRow label="Key" value={agent.name} />
          <InfoRow label="Provider" value={agent.provider} />
          <InfoRow label="Model" value={agent.model} />
          <InfoRow label="Type" value={cap(agent.agentType ?? "open")} />
          <InfoRow label="Channel" value={agent.currentChannel ?? "—"} />

          <div>
            <p className="text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase">State</p>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stateColor }}
              />
              <span className="text-white text-sm">{cap(agent.state.replace("_", " "))}</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase">Health</p>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  agent.state === "error" ? "bg-red-500" : "bg-green-500"
                }`}
              />
              <span className="text-white text-sm">{agent.state === "error" ? "Error" : "OK"}</span>
            </div>
          </div>
        </div>

        {agent.speechBubble && (
          <div className="mt-1">
            <p className="text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase">Activity</p>
            <p className="text-white/70 text-xs leading-relaxed bg-[#0a0a0f] border border-[#1e1e2a] rounded p-3 line-clamp-4">
              {agent.speechBubble}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase">{label}</p>
      <p className="text-white text-sm truncate" title={value}>{value}</p>
    </div>
  );
}
