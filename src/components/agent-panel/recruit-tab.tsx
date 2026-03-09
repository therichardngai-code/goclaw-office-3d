import { useState } from "react";
import { AGENT_PRESETS, type AgentPreset } from "@/data/agent-presets";
import { CharacterPreview } from "./character-preview";
import { AgentCreateForm } from "./agent-create-form";
import { useOfficeStore } from "@/stores/use-office-store";

// Open agent uses character-male-c (has talking anim, feels versatile)
const OPEN_CHAR_INDEX = 8;

interface Props {
  onSuccess: () => void;
}

export function RecruitTab({ onSuccess }: Props) {
  const snapshot = useOfficeStore((s) => s.mergedSnapshot);
  const isStandalone = snapshot?.gateway.mode === "standalone";
  const [subTab, setSubTab] = useState<"predefined" | "open">("predefined");
  const [selected, setSelected] = useState<AgentPreset | null>(null);

  if (isStandalone) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <p className="text-gray-300 text-sm font-medium mb-2">Standalone Mode</p>
          <p className="text-gray-500 text-xs leading-relaxed">
            Agent creation is not available in standalone mode.
            Add agents to your <code className="text-gray-400 bg-[#1a1a24] px-1 py-0.5 rounded">config.json</code> and restart GoClaw.
          </p>
        </div>
      </div>
    );
  }

  const inCreateMode = selected !== null || subTab === "open";

  const handleCancel = () => {
    if (subTab === "open") {
      setSubTab("predefined");
    } else {
      setSelected(null);
    }
  };

  const preset = subTab === "open" ? undefined : (selected ?? undefined);
  const charIndex = preset?.characterIndex ?? OPEN_CHAR_INDEX;
  const charLabel = preset?.label ?? "Open Agent";

  // Split view: character left + form right
  if (inCreateMode) {
    return (
      <div className="flex h-full">
        {/* Left: character preview */}
        <div className="w-[220px] flex-shrink-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0f] border-r border-[#1e1e2a] py-6 px-4">
          <CharacterPreview characterIndex={charIndex} width={180} height={250} />
          <p className="text-white font-semibold text-sm text-center">{charLabel}</p>
          {preset && (
            <p className="text-gray-500 text-xs text-center leading-relaxed line-clamp-3">
              {preset.prompt.slice(0, 80)}…
            </p>
          )}
        </div>

        {/* Right: form */}
        <div className="flex-1 flex flex-col p-6 gap-1 min-h-0">
          <h3 className="text-white font-semibold text-base mb-3">
            {preset ? `Recruit — ${charLabel}` : "Custom Agent"}
          </h3>
          <AgentCreateForm
            preset={preset}
            onSuccess={onSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex gap-0 px-6 border-b border-[#1e1e2a]">
        {(["predefined", "open"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              subTab === t
                ? "text-white border-[#e8352a]"
                : "text-gray-400 border-transparent hover:text-white/80"
            }`}
          >
            {t === "predefined" ? "Predefined" : "Open Agent"}
          </button>
        ))}
      </div>

      {/* Predefined card grid — 4 columns */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {AGENT_PRESETS.map((p) => (
            <button
              key={p.suggestedKey}
              onClick={() => setSelected(p)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2a] hover:border-[#e8352a]/60 hover:bg-[#130808] transition-all group"
            >
              <div className="pointer-events-none">
                <CharacterPreview
                  characterIndex={p.characterIndex}
                  width={90}
                  height={110}
                />
              </div>
              <span className="text-xs font-semibold text-white/70 group-hover:text-white transition-colors">
                {p.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
