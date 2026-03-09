import { CHAR_MODELS, STATE_HEX } from "./constants";

// Deterministic character index from agent ID
export function charIdx(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % CHAR_MODELS.length;
}

// Get state color as hex number
export function stateHex(s: string): number {
  return STATE_HEX[s] ?? 0x666688;
}

// Convert number to hex color string
export function hex6(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

// Capitalize first letter
export function cap(s: string): string {
  return s && s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

// Smallest signed angle between two angles (radians)
export function shortestAngle(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Map agent state to animation category
//   idle     → agent waiting
//   working  → agent thinking / calling tools
//   talking  → agent responding (with speech) or receiving a task
//   victory  → task just completed (caller manages transition back to idle)
//   walking  → kept for wander locomotion override (not a GoClaw state)
export function toAnimState(
  agentState: string,
  hasSpeechBubble: boolean
): "idle" | "working" | "talking" | "victory" {
  if (agentState === "idle" || agentState === "error") return "idle";
  if (agentState === "receiving") return "talking";
  if (agentState === "responding" && hasSpeechBubble) return "talking";
  return "working"; // thinking, tool_calling, responding (no speech yet)
}

// Deterministic wall theme for a platform key
export function wallTheme(key: string): "arcade" | "market" {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2 === 0 ? "arcade" : "market";
}

// Normalize channel type — substring match, ported from Go bridge.go
export function normalizeChannelType(ch: string): string {
  const lower = ch.toLowerCase();
  for (const typ of ["telegram", "discord", "whatsapp", "feishu", "zalo_personal", "zalo", "direct"]) {
    if (lower.includes(typ)) return typ;
  }
  return ch;
}

// Resolve platform key for an agent
export function resolvePlatform(
  agent: { id: string; name?: string; state: string; currentChannel?: string } | null,
  teams: Record<string, { leadId?: string; members?: string[] }>
): string {
  if (!agent) return "idle";

  // Teams store agent_key strings (from WS lead_agent_key / agent_key fields).
  // Merged snapshot agents use UUID as id but agent_key as name — match by name.
  const agentKey = agent.name ?? agent.id;

  for (const [tid, team] of Object.entries(teams)) {
    if (team.leadId === agentKey || team.members?.includes(agentKey)) {
      return `team:${tid}`;
    }
  }

  // Only show channel platform while agent is actively processing
  if (agent.state !== "idle" && agent.state !== "error") {
    const ch = agent.currentChannel;
    if (ch) return ch;
  }

  return "idle";
}
