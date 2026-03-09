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
    const liveAgent = live[api.id];
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
  for (const [id, agent] of Object.entries(live)) {
    if (!merged[id] && !loserIds.has(id)) {
      merged[id] = { ...agent, characterIndex: charIdx(agent.name) };
    }
  }

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

  setToken: (t: string) => void;
  setConnected: (c: boolean) => void;
  setSnapshot: (s: OfficeSnapshot) => void;
  setApiAgents: (agents: AgentRecord[]) => void;
  setMachine: (m: OfficeStateMachine) => void;
  addLocalNotification: (n: Notification) => void;
  clearLocalNotifications: () => void;
  toggleNotificationPanel: () => void;
  toggleAgentPanel: () => void;
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
  setApiAgents: (apiAgents) => {
    const { snapshot, machine } = get();
    // Seed the state machine so WS-only agents are enriched with REST data
    if (machine) machine.seedAgents(apiAgents);
    set({ apiAgents, mergedSnapshot: applyMerge(snapshot, apiAgents) });
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
}));
