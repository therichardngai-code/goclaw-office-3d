import { create } from "zustand";
import { LOCAL_STORAGE_TOKEN_KEY } from "@/lib/constants";
import type { OfficeSnapshot, Notification, OfficeAgent } from "@/api/types";
import type { AgentRecord } from "@/api/agent-api";
import { charIdx } from "@/scene/utils";
import type { OfficeStateMachine } from "@/stores/office-state-machine";

// Build merged agents: all API agents (with correct characterIndex from key hash)
// overlaid with live SSE state for those that have fired events.
function buildMergedAgents(
  snapshot: OfficeSnapshot | null,
  apiAgents: AgentRecord[]
): Record<string, OfficeAgent> {
  const live = snapshot?.agents ?? {};
  const merged: Record<string, OfficeAgent> = {};

  // Deduplicate apiAgents by agent_key — owner users see all agents across all
  // users, so the same key can appear multiple times (e.g. stale "default"
  // agents created under wrong owner_id). Prefer the one that is live in SSE;
  // on tie, keep first.
  // Also track loser UUIDs so the fallback SSE loop below doesn't re-add them.
  const dedupedByKey = new Map<string, AgentRecord>();
  const loserIds = new Set<string>();
  for (const api of apiAgents) {
    const existing = dedupedByKey.get(api.agent_key);
    if (!existing) {
      dedupedByKey.set(api.agent_key, api);
    } else if (live[api.id] && !live[existing.id]) {
      // This one is SSE-live, the existing one is not — prefer this one
      loserIds.add(existing.id);
      dedupedByKey.set(api.agent_key, api);
    } else {
      loserIds.add(api.id);
    }
  }
  const dedupedAgents = Array.from(dedupedByKey.values());

  for (const api of dedupedAgents) {
    // Try UUID match first; fall back to name match (machine may key by agent_key
    // string instead of UUID when the agent was created via summoning event).
    const byId = live[api.id];
    const byName = Object.values(live).find((a) => a.name === api.agent_key);
    const liveAgent = byId ?? byName;
    console.log("[merge] agent", api.agent_key, api.id, "byId:", !!byId, "byName:", !!byName, "state:", liveAgent?.state, "channel:", liveAgent?.currentChannel);
    const ci = charIdx(api.agent_key);
    merged[api.id] = {
      id: api.id,
      name: api.agent_key,
      model: api.model,
      provider: api.provider,
      agentType: api.agent_type,
      displayName: api.display_name || api.agent_key,
      characterIndex: ci,
      state: liveAgent?.state ?? "idle",
      speechBubble: liveAgent?.speechBubble,
      currentRunId: liveAgent?.currentRunId,
      currentChannel: liveAgent?.currentChannel,
      lastActiveAt: liveAgent?.lastActiveAt ?? new Date(0).toISOString(),
    };
  }

  // Include SSE-only agents (not in API list — e.g. standalone mode agents).
  // Skip loser UUIDs: stale duplicates of the same agent_key that were not
  // selected by dedup above. Without this, the stale UUID re-enters as a
  // second character in the scene even though dedup already excluded it.
  // Also skip agents whose name (agent_key) is already covered by a REST-merged
  // entry — catches summoning-keyed agents (keyed by agent_key string, not UUID)
  // that would otherwise duplicate a UUID-keyed REST agent with the same name.
  const mergedNames = new Set(Object.values(merged).map((a) => a.name));
  for (const [id, agent] of Object.entries(live)) {
    const skip = merged[id] ? "already-merged" : loserIds.has(id) ? "loser" : mergedNames.has(agent.name) ? "name-dup" : null;
    if (skip) {
      console.log("[merge] SSE skip", id, agent.name, "reason:", skip);
    } else {
      merged[id] = { ...agent, characterIndex: charIdx(agent.name) };
      console.log("[merge] SSE added", id, agent.name, "state:", agent.state, "channel:", agent.currentChannel);
    }
  }

  console.log("[merge] final agents:", Object.entries(merged).map(([id, a]) => `${a.name}(${id.slice(0,8)}) state=${a.state} ch=${a.currentChannel}`));
  return merged;
}

function applyMerge(
  snapshot: OfficeSnapshot | null,
  apiAgents: AgentRecord[]
): OfficeSnapshot | null {
  if (!snapshot && apiAgents.length === 0) return null;
  const base = snapshot ?? {
    gateway: { version: "-", healthy: true, mode: "managed", uptime: 0, eventCount: 0, startedAt: new Date().toISOString() },
    agents: {}, teams: {}, activeDelegations: [], agentLinks: [], tasks: {}, notifications: [], updatedAt: new Date().toISOString(),
  } as unknown as OfficeSnapshot;
  return { ...base, agents: buildMergedAgents(snapshot, apiAgents) };
}

interface OfficeStore {
  token: string;
  connected: boolean;
  snapshot: OfficeSnapshot | null;
  mergedSnapshot: OfficeSnapshot | null;
  apiAgents: AgentRecord[];
  localNotifications: Notification[];
  notificationPanelOpen: boolean;
  agentPanelOpen: boolean;
  machine: OfficeStateMachine | null;
  selectedAgent: OfficeAgent | null;
  // Exposed WS call function — set by use-office-state when client connects
  wsCall: ((method: string, params?: Record<string, unknown>) => Promise<unknown>) | null;
  // WS→chat bridge: streaming chunk tokens (LLM output, high-frequency)
  incomingChatChunk: { agentKey: string; content: string } | null;
  // WS→chat bridge: run completed — content non-empty for announce runs, empty for interactive
  incomingChatMessage: { agentKey: string; content: string } | null;
  // WS→chat bridge: run failed error
  incomingChatError: { agentKey: string; error: string } | null;

  setToken: (t: string) => void;
  setConnected: (c: boolean) => void;
  setSnapshot: (s: OfficeSnapshot) => void;
  setApiAgents: (agents: AgentRecord[]) => void;
  removeApiAgent: (id: string) => void;
  setChannelInstances: (instances: { name: string; channel_type: string }[]) => void;
  setMachine: (m: OfficeStateMachine) => void;
  addLocalNotification: (n: Notification) => void;
  clearLocalNotifications: () => void;
  toggleNotificationPanel: () => void;
  toggleAgentPanel: () => void;
  setSelectedAgent: (agent: OfficeAgent | null) => void;
  setWsCall: (fn: ((method: string, params?: Record<string, unknown>) => Promise<unknown>) | null) => void;
  setIncomingChatChunk: (c: { agentKey: string; content: string } | null) => void;
  setIncomingChatMessage: (m: { agentKey: string; content: string } | null) => void;
  setIncomingChatError: (e: { agentKey: string; error: string } | null) => void;
}

const MAX_LOCAL_NOTIFICATIONS = 50;

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  token: localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY) ?? "",
  connected: false,
  snapshot: null,
  mergedSnapshot: null,
  apiAgents: [],
  localNotifications: [],
  notificationPanelOpen: false,
  agentPanelOpen: false,
  machine: null,
  selectedAgent: null,
  wsCall: null,
  incomingChatChunk: null,
  incomingChatMessage: null,
  incomingChatError: null,

  setToken: (token) => {
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, token);
    set({ token });
  },
  setConnected: (connected) => set({ connected }),
  setSnapshot: (snapshot) => {
    const { apiAgents } = get();
    set({ snapshot, mergedSnapshot: applyMerge(snapshot, apiAgents) });
  },
  setMachine: (machine) => set({ machine }),
  setChannelInstances: (instances) => {
    console.log("[store] seedChannels:", instances.map((i) => `${i.name}→${i.channel_type}`));
    const { machine } = get();
    if (machine) machine.seedChannels(instances);
  },
  setApiAgents: (apiAgents) => {
    const { snapshot, machine } = get();
    // Seed the state machine so WS-only agents are enriched with REST data
    if (machine) machine.seedAgents(apiAgents);
    set({ apiAgents, mergedSnapshot: applyMerge(snapshot, apiAgents) });
  },
  removeApiAgent: (id) => {
    const { machine, apiAgents } = get();
    const updated = apiAgents.filter((a) => a.id !== id);
    // Use machine.snapshot() (fresh — deletion already applied) not get().snapshot
    // (stale — debounced 150ms behind). Without this the SSE loop in applyMerge
    // re-adds the deleted agent for one cycle from the stale snapshot.agents.
    const freshSnapshot = machine?.snapshot() ?? null;
    set({ apiAgents: updated, mergedSnapshot: applyMerge(freshSnapshot, updated) });
  },
  addLocalNotification: (n) =>
    set((state) => ({
      localNotifications: [
        ...state.localNotifications.slice(-MAX_LOCAL_NOTIFICATIONS + 1),
        n,
      ],
    })),
  clearLocalNotifications: () => set({ localNotifications: [] }),
  toggleNotificationPanel: () =>
    set((state) => ({ notificationPanelOpen: !state.notificationPanelOpen })),
  toggleAgentPanel: () =>
    set((state) => ({ agentPanelOpen: !state.agentPanelOpen })),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setWsCall: (wsCall) => set({ wsCall }),
  setIncomingChatChunk: (incomingChatChunk) => set({ incomingChatChunk }),
  setIncomingChatMessage: (incomingChatMessage) => set({ incomingChatMessage }),
  setIncomingChatError: (incomingChatError) => set({ incomingChatError }),
}));
