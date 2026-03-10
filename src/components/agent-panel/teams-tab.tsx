// Teams tab — list existing teams + create new ones via WS RPC.
// Lead: any active agent. Members: predefined agents only (shared context required).
import { useState, useEffect, useCallback } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { listTeams, createTeam, deleteTeam, type TeamData } from "@/api/team-api";
import { CustomSelect } from "./custom-select";

export function TeamsTab() {
  const wsCall   = useOfficeStore((s) => s.wsCall);
  const apiAgents = useOfficeStore((s) => s.apiAgents);

  const [teams, setTeams]         = useState<TeamData[]>([]);
  const [loading, setLoading]     = useState(false);
  const [view, setView]           = useState<"list" | "create">("list");
  const [error, setError]         = useState("");

  // Create form state
  const [name, setName]             = useState("");
  const [description, setDescription] = useState("");
  const [lead, setLead]             = useState("");
  const [members, setMembers]       = useState<string[]>([]);
  const [memberPick, setMemberPick] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Agent option lists ────────────────────────────────────────────────────
  const active = apiAgents.filter((a) => a.status === "active");
  const leadOptions = active.map((a) => ({ value: a.id, label: a.display_name || a.agent_key }));
  const memberOptions = active
    .filter((a) => a.agent_type === "predefined" && a.id !== lead && !members.includes(a.id))
    .map((a) => ({ value: a.id, label: a.display_name || a.agent_key }));

  const agentLabel = (id: string) => {
    const a = apiAgents.find((a) => a.id === id);
    return a ? (a.display_name || a.agent_key) : id.slice(0, 8);
  };

  // ── Load teams ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!wsCall) return;
    setLoading(true);
    setTeams(await listTeams(wsCall));
    setLoading(false);
  }, [wsCall]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddMember = (agentId: string) => {
    if (agentId) { setMembers((prev) => [...prev, agentId]); setMemberPick(""); }
  };

  const resetForm = () => {
    setName(""); setDescription(""); setLead(""); setMembers([]); setMemberPick(""); setError("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !lead || !wsCall) return;
    setSubmitting(true);
    setError("");
    const res = await createTeam(wsCall, {
      name: name.trim(),
      lead,
      members,
      description: description.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) { resetForm(); setView("list"); load(); }
    else { setError(res.error ?? "Failed to create team"); }
  };

  const handleDelete = async (teamId: string) => {
    if (!wsCall) return;
    await deleteTeam(wsCall, teamId);
    load();
  };

  // ── Create form ───────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => { setView("list"); resetForm(); }} className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Back
          </button>
          <h3 className="text-white font-semibold text-base">Create Team</h3>
        </div>

        <div className="flex flex-col gap-3 max-w-lg">
          {/* Name */}
          <div>
            <label className={lbl}>Team Name *</label>
            <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Research Team" />
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description</label>
            <input className={inp} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional…" />
          </div>

          {/* Lead agent */}
          <div>
            <label className={lbl}>Lead Agent *</label>
            <CustomSelect value={lead} onChange={setLead} options={leadOptions} placeholder="Select lead agent…" />
            <p className="text-gray-600 text-xs mt-1">Receives user requests and coordinates the team</p>
          </div>

          {/* Members */}
          <div>
            <label className={lbl}>Members <span className="text-gray-600 font-normal normal-case">(predefined agents only)</span></label>
            <CustomSelect
              value={memberPick}
              onChange={handleAddMember}
              options={memberOptions}
              placeholder={lead ? "Add member…" : "Select a lead first"}
              disabled={!lead}
            />
            {members.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {members.map((id) => (
                  <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1a1a2e] border border-[#2a2a3a] text-xs text-white/80">
                    {agentLabel(id)}
                    <button onClick={() => setMembers((prev) => prev.filter((m) => m !== id))} className="text-white/30 hover:text-white/80 transition-colors ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setView("list"); resetForm(); }} className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || !lead || submitting}
              className="px-5 py-2 rounded text-sm font-semibold bg-[#00ADD8] hover:bg-[#007D9C] text-white transition-colors disabled:opacity-40"
            >
              {submitting ? "Creating…" : "Create Team"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2a] flex-shrink-0">
        <p className="text-white/50 text-sm">
          {loading ? "Loading…" : `${teams.length} team${teams.length !== 1 ? "s" : ""}`}
        </p>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          disabled={!wsCall}
          className="px-4 py-1.5 rounded text-sm font-medium bg-[#00ADD8] hover:bg-[#007D9C] text-white transition-colors disabled:opacity-40"
        >
          + Create Team
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!loading && teams.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-white/40 text-sm">No teams yet</p>
            <p className="text-white/25 text-xs">Create a team to let agents collaborate and delegate tasks</p>
          </div>
        )}

        {teams.length > 0 && (
          <div className="flex flex-col gap-2">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[#0a0a0f] border border-[#1e1e2a] hover:border-[#2a2a3a] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{team.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Lead: {team.lead_display_name || team.lead_agent_key}
                    {(team.member_count ?? 0) > 0 && <> · {team.member_count} member{team.member_count !== 1 ? "s" : ""}</>}
                  </p>
                  {team.description && <p className="text-white/30 text-xs mt-0.5 truncate">{team.description}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  team.status === "active" ? "border-green-500/30 text-green-400" : "border-white/10 text-white/30"
                }`}>
                  {team.status}
                </span>
                <button
                  onClick={() => handleDelete(team.id)}
                  className="text-white/20 hover:text-red-400 transition-colors text-xs flex-shrink-0 px-1"
                  title="Delete team"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const lbl = "block text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase";
const inp = "w-full px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00ADD8]/60 transition-colors";
