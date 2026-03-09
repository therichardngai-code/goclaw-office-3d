import { useState } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { RecruitTab } from "./recruit-tab";
import { ConnectionTab } from "./connection-tab";

type Tab = "recruit" | "connection";

export function AgentPanel() {
  const agentPanelOpen = useOfficeStore((s) => s.agentPanelOpen);
  const toggleAgentPanel = useOfficeStore((s) => s.toggleAgentPanel);
  const [tab, setTab] = useState<Tab>("recruit");
  const [successMsg, setSuccessMsg] = useState("");

  if (!agentPanelOpen) return null;

  const handleSuccess = () => {
    setSuccessMsg("Agent created successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleAgentPanel();
      }}
    >
      <div className="relative flex flex-col bg-[#12121a] rounded-xl border border-[#1e1e2a] w-[860px] h-[580px] shadow-2xl overflow-hidden">
        {/* Success toast */}
        {successMsg && (
          <div className="absolute top-0 inset-x-0 bg-green-600 text-white text-sm text-center py-2 z-10">
            {successMsg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e1e2a] flex-shrink-0">
          <svg
            className="w-5 h-5 text-[#e8352a] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
            />
          </svg>
          <h2 className="text-white font-semibold text-base flex-1">Agent Office</h2>

          <div className="flex gap-1">
            {(["recruit", "connection"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-[#e8352a] text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {t === "recruit" ? "Recruit" : "Connection"}
              </button>
            ))}
          </div>

          <button
            onClick={toggleAgentPanel}
            className="ml-2 w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0">
          {tab === "recruit" ? (
            <RecruitTab onSuccess={handleSuccess} />
          ) : (
            <ConnectionTab />
          )}
        </div>
      </div>
    </div>
  );
}
