// TypeScript port of Go's internal/office/bridge.go + state.go
// Processes raw WebSocket events and builds OfficeSnapshot in memory.

import type {
  OfficeAgent,
  OfficeTeam,
  OfficeDelegation,
  OfficeAgentLink,
  OfficeTask,
  Notification,
  OfficeSnapshot,
} from "@/api/types";
import { charIdx, normalizeChannelType } from "@/scene/utils";

const MAX_NOTIFICATIONS = 50;
const MAX_DELEGATIONS = 100;

export class OfficeStateMachine {
  private agents: Record<string, OfficeAgent> = {};
  private teams: Record<string, OfficeTeam> = {};
  private delegations: OfficeDelegation[] = [];
  private agentLinks: OfficeAgentLink[] = [];
  // channel instance name (lowercase) → channel type (e.g. "my-telegram-bot" → "telegram")
  private channelTypeMap = new Map<string, string>();
  private tasks: Record<string, OfficeTask> = {};
  private notifications: Notification[] = [];
  private eventCount = 0;
  private readonly startedAt = new Date().toISOString();

  // ── Seed ────────────────────────────────────────────────────────────────────

  // Seed channel instance name → channel type lookup from REST /v1/channels/instances
  seedChannels(instances: { name: string; channel_type: string }[]): void {
    for (const inst of instances) {
      this.channelTypeMap.set(inst.name.toLowerCase(), inst.channel_type.toLowerCase());
    }
  }

  // Enrich state with REST /v1/agents data (display names, models, etc.)
  seedAgents(
    apiAgents: {
      id: string;
      agent_key: string;
      model: string;
      provider: string;
      agent_type: string;
      display_name?: string;
    }[]
  ): void {
    for (const a of apiAgents) {
      if (!this.agents[a.id]) {
        this.agents[a.id] = this.newAgent(a.id);
      }
      const agent = this.agents[a.id]!;
      agent.name = a.agent_key;
      agent.model = a.model;
      agent.provider = a.provider;
      agent.agentType = a.agent_type;
      agent.displayName = a.display_name ?? a.agent_key;
      // Re-derive character index now that we have the real agent_key
      agent.characterIndex = charIdx(a.agent_key);
    }
  }

  // ── Main dispatch ────────────────────────────────────────────────────────────

  handleEvent(name: string, payload: unknown): void {
    this.eventCount++;

    switch (name) {
      case "agent":                   return this.handleAgentEvent(payload);
      case "delegation.started":      return this.handleDelegationStarted(payload);
      case "delegation.completed":    return this.handleDelegationTerminal(payload, "completed");
      case "delegation.failed":       return this.handleDelegationTerminal(payload, "failed");
      case "delegation.cancelled":    return this.handleDelegationTerminal(payload, "cancelled");
      case "delegation.progress":     return this.handleDelegationProgress(payload);
      case "delegation.accumulated":  return this.handleDelegationAccumulated(payload);
      case "team.created":            return this.handleTeamCreated(payload);
      case "team.updated":            return this.handleTeamUpdated(payload);
      case "team.deleted":            return this.handleTeamDeleted(payload);
      case "team.member.added":       return this.handleTeamMember(payload, "add");
      case "team.member.removed":     return this.handleTeamMember(payload, "remove");
      case "team.task.created":       return this.handleTask(payload, "created");
      case "team.task.claimed":       return this.handleTask(payload, "claimed");
      case "team.task.completed":     return this.handleTask(payload, "completed");
      case "team.task.cancelled":     return this.handleTask(payload, "cancelled");
      case "agent_link.created":      return this.handleAgentLink(payload, "upsert");
      case "agent_link.updated":      return this.handleAgentLink(payload, "upsert");
      case "agent_link.deleted":      return this.handleAgentLink(payload, "delete");
      case "agent.summoning":         return this.handleAgentSummoning(payload);
      // health / handoff — no visual update needed
    }
  }

  // ── Agent events ─────────────────────────────────────────────────────────────

  private handleAgentEvent(payload: unknown): void {
    const p = payload as {
      agentId?: string;
      runId?: string;
      type?: string;
      payload?: unknown;
      channel?: string;
    };
    const id = p.agentId;
    if (!id) return;

    if (!this.agents[id]) {
      this.agents[id] = this.newAgent(id);
    }
    const agent = this.agents[id]!;

    switch (p.type) {
      case "run.started":
        agent.state = "thinking";
        agent.currentRunId = p.runId;
        agent.speechBubble = "Processing...";
        agent.lastActiveAt = new Date().toISOString();
        if (p.channel) {
          // Prefer exact lookup (channel instance name → type) over substring guess.
          // AgentEvent.Channel = instance name (e.g. "my-telegram-bot"), not the type.
          const mapped = this.channelTypeMap.get(p.channel.toLowerCase());
          agent.currentChannel = mapped ?? normalizeChannelType(p.channel);
        }
        this.addNotification("run.started", id, `${agent.displayName ?? id} started`);
        break;

      case "run.completed":
        agent.state = "idle";
        agent.currentChannel = undefined;
        agent.speechBubble = undefined;
        this.addNotification("run.completed", id, `${agent.displayName ?? id} completed`);
        break;

      case "run.failed":
        agent.state = "error";
        agent.currentChannel = undefined;
        agent.speechBubble = undefined;
        this.addNotification("run.failed", id, `${agent.displayName ?? id} failed`);
        break;

      case "run.retrying":
        agent.speechBubble = "Retrying...";
        break;

      case "tool.call": {
        agent.state = "tool_calling";
        const toolName = extractString(p.payload, "name");
        agent.speechBubble = toolName ? `Using: ${toolName}` : "Using tool...";
        this.addNotification("tool.call", id, `${agent.displayName ?? id}: ${toolName}`);
        break;
      }

      case "tool.result":
        agent.state = "thinking";
        agent.speechBubble = "Processing...";
        break;

      case "chunk": {
        agent.state = "responding";
        const content =
          extractString(p.payload, "content") ||
          (typeof p.payload === "string" ? p.payload : "");
        if (content) agent.speechBubble = content.slice(0, 120);
        break;
      }

      case "thinking": {
        agent.state = "thinking";
        const thought = extractString(p.payload, "content");
        if (thought) agent.speechBubble = thought.slice(0, 120);
        break;
      }
    }
  }

  // ── Delegation events ────────────────────────────────────────────────────────

  private handleDelegationStarted(payload: unknown): void {
    // DelegationEventPayload uses snake_case JSON fields
    const p = payload as {
      delegation_id?: string;
      source_agent_key?: string;
      target_agent_key?: string;
      source_display_name?: string;
      target_display_name?: string;
      task?: string;
      mode?: string;
      team_id?: string;
      team_task_id?: string;
    };
    if (!p.delegation_id) return;

    this.delegations = [
      ...this.delegations.slice(-(MAX_DELEGATIONS - 1)),
      {
        id: p.delegation_id,
        sourceId: p.source_agent_key ?? "",
        targetId: p.target_agent_key ?? "",
        sourceDisplayName: p.source_display_name,
        targetDisplayName: p.target_display_name,
        task: p.task,
        status: "running",
        mode: p.mode ?? "sync",
        teamId: p.team_id,
        teamTaskId: p.team_task_id,
        startedAt: new Date().toISOString(),
      },
    ];

    // Speech bubbles on both ends
    if (p.source_agent_key && this.agents[p.source_agent_key]) {
      this.agents[p.source_agent_key]!.speechBubble =
        `→ Briefing ${p.target_display_name ?? p.target_agent_key}...`;
    }
    if (p.target_agent_key && this.agents[p.target_agent_key]) {
      this.agents[p.target_agent_key]!.speechBubble = "← Receiving task...";
    }
  }

  private handleDelegationTerminal(payload: unknown, status: string): void {
    const p = payload as { delegation_id?: string; error?: string };
    if (!p.delegation_id) return;
    this.delegations = this.delegations.map((d) =>
      d.id === p.delegation_id ? { ...d, status, error: p.error } : d
    );
  }

  private handleDelegationProgress(payload: unknown): void {
    // DelegationProgressPayload.Active serializes as "active_delegations"
    const p = payload as {
      active_delegations?: Array<{ delegation_id: string; elapsed_ms: number }>;
    };
    for (const item of p.active_delegations ?? []) {
      this.delegations = this.delegations.map((d) =>
        d.id === item.delegation_id ? { ...d, elapsedMs: item.elapsed_ms } : d
      );
    }
  }

  private handleDelegationAccumulated(payload: unknown): void {
    const p = payload as {
      delegation_id?: string;
      target_agent_key?: string;
    };
    if (p.delegation_id) {
      this.delegations = this.delegations.map((d) =>
        d.id === p.delegation_id ? { ...d, status: "accumulated" } : d
      );
    }
    if (p.target_agent_key && this.agents[p.target_agent_key]) {
      this.agents[p.target_agent_key]!.speechBubble = "Done — waiting for team...";
    }
  }

  // ── Team events ───────────────────────────────────────────────────────────────

  private handleTeamCreated(payload: unknown): void {
    // TeamCreatedPayload uses snake_case; no member list — members arrive via team.member.added
    const p = payload as {
      team_id?: string;
      team_name?: string;
      lead_agent_key?: string;
      lead_display_name?: string;
    };
    if (!p.team_id) return;
    this.teams[p.team_id] = {
      id: p.team_id,
      name: p.team_name ?? p.team_id,
      leadId: p.lead_agent_key ?? "",
      leadDisplayName: p.lead_display_name,
      members: [],
    };
  }

  private handleTeamUpdated(payload: unknown): void {
    const p = payload as { team_id?: string; team_name?: string };
    if (p.team_id && this.teams[p.team_id]) {
      this.teams[p.team_id] = {
        ...this.teams[p.team_id]!,
        name: p.team_name ?? this.teams[p.team_id]!.name,
      };
    }
  }

  private handleTeamDeleted(payload: unknown): void {
    const p = payload as { team_id?: string };
    if (p.team_id) delete this.teams[p.team_id];
  }

  private handleTeamMember(payload: unknown, action: "add" | "remove"): void {
    // TeamMemberAddedPayload / TeamMemberRemovedPayload use snake_case
    const p = payload as { team_id?: string; agent_key?: string };
    if (!p.team_id || !this.teams[p.team_id] || !p.agent_key) return;
    const team = this.teams[p.team_id]!;
    if (action === "add") {
      if (!team.members.includes(p.agent_key)) {
        team.members = [...team.members, p.agent_key];
      }
    } else {
      team.members = team.members.filter((m) => m !== p.agent_key);
    }
  }

  // ── Task events ───────────────────────────────────────────────────────────────

  private handleTask(payload: unknown, action: string): void {
    // TeamTaskEventPayload uses snake_case
    const p = payload as {
      task_id?: string;
      team_id?: string;
      subject?: string;
      status?: string;
      owner_agent_key?: string;
      owner_display_name?: string;
      reason?: string;
    };
    if (!p.task_id) return;
    this.tasks[p.task_id] = {
      id: p.task_id,
      teamId: p.team_id ?? "",
      subject: p.subject ?? "",
      status: p.status ?? action,
      ownerAgentKey: p.owner_agent_key,
      ownerDisplayName: p.owner_display_name,
      reason: p.reason,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Agent link events ──────────────────────────────────────────────────────────

  private handleAgentLink(payload: unknown, action: "upsert" | "delete"): void {
    // AgentLinkCreatedPayload / AgentLinkUpdatedPayload / AgentLinkDeletedPayload use snake_case
    const p = payload as {
      link_id?: string;
      source_agent_key?: string;
      target_agent_key?: string;
      direction?: string;
      status?: string;
      team_id?: string;
    };
    if (!p.link_id) return;
    if (action === "delete") {
      this.agentLinks = this.agentLinks.filter((l) => l.id !== p.link_id);
    } else {
      const link: OfficeAgentLink = {
        id: p.link_id,
        sourceAgentKey: p.source_agent_key ?? "",
        targetAgentKey: p.target_agent_key ?? "",
        direction: p.direction ?? "one-way",
        status: p.status ?? "active",
        teamId: p.team_id,
      };
      const idx = this.agentLinks.findIndex((l) => l.id === p.link_id);
      if (idx >= 0) {
        this.agentLinks = this.agentLinks.map((l, i) => (i === idx ? link : l));
      } else {
        this.agentLinks = [...this.agentLinks, link];
      }
    }
  }

  // ── Agent summoning ────────────────────────────────────────────────────────────

  private handleAgentSummoning(payload: unknown): void {
    // Summoner broadcasts { type, agent_id } — use agent_id as key
    const p = payload as { agent_id?: string; display_name?: string };
    const key = p.agent_id;
    if (!key || this.agents[key]) return;
    this.agents[key] = {
      ...this.newAgent(key),
      displayName: p.display_name ?? key,
    };
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────────

  snapshot(): OfficeSnapshot {
    return {
      gateway: {
        version: "-",
        healthy: true,
        mode: "managed",
        uptime: 0,
        eventCount: this.eventCount,
        startedAt: this.startedAt,
      },
      agents: { ...this.agents },
      teams: { ...this.teams },
      activeDelegations: [...this.delegations],
      agentLinks: [...this.agentLinks],
      tasks: { ...this.tasks },
      notifications: [...this.notifications],
      updatedAt: new Date().toISOString(),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private newAgent(id: string): OfficeAgent {
    return {
      id,
      name: id,
      model: "",
      provider: "",
      state: "idle",
      characterIndex: charIdx(id),
      lastActiveAt: new Date(0).toISOString(),
    };
  }

  private addNotification(type: string, agentId: string, message: string): void {
    this.notifications = [
      ...this.notifications.slice(-(MAX_NOTIFICATIONS - 1)),
      {
        id: `${Date.now()}-${Math.random()}`,
        agentId,
        type,
        message,
        timestamp: new Date().toISOString(),
      },
    ];
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function extractString(payload: unknown, key: string): string {
  if (typeof payload === "object" && payload !== null) {
    const v = (payload as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
  }
  return "";
}
