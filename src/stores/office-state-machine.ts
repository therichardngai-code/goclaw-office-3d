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
  private tasks: Record<string, OfficeTask> = {};
  private notifications: Notification[] = [];
  private eventCount = 0;
  private readonly startedAt = new Date().toISOString();

  // ── Seed ────────────────────────────────────────────────────────────────────

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
          agent.currentChannel = normalizeChannelType(p.channel);
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
    const p = payload as {
      delegationId?: string;
      sourceAgentKey?: string;
      targetAgentKey?: string;
      sourceDisplayName?: string;
      targetDisplayName?: string;
      task?: string;
      mode?: string;
      teamId?: string;
      teamTaskId?: string;
    };
    if (!p.delegationId) return;

    this.delegations = [
      ...this.delegations.slice(-(MAX_DELEGATIONS - 1)),
      {
        id: p.delegationId,
        sourceId: p.sourceAgentKey ?? "",
        targetId: p.targetAgentKey ?? "",
        sourceDisplayName: p.sourceDisplayName,
        targetDisplayName: p.targetDisplayName,
        task: p.task,
        status: "running",
        mode: p.mode ?? "sync",
        teamId: p.teamId,
        teamTaskId: p.teamTaskId,
        startedAt: new Date().toISOString(),
      },
    ];

    // Speech bubbles on both ends
    if (p.sourceAgentKey && this.agents[p.sourceAgentKey]) {
      this.agents[p.sourceAgentKey]!.speechBubble =
        `→ Briefing ${p.targetDisplayName ?? p.targetAgentKey}...`;
    }
    if (p.targetAgentKey && this.agents[p.targetAgentKey]) {
      this.agents[p.targetAgentKey]!.speechBubble = "← Receiving task...";
    }
  }

  private handleDelegationTerminal(payload: unknown, status: string): void {
    const p = payload as { delegationId?: string; error?: string };
    if (!p.delegationId) return;
    this.delegations = this.delegations.map((d) =>
      d.id === p.delegationId ? { ...d, status, error: p.error } : d
    );
  }

  private handleDelegationProgress(payload: unknown): void {
    const p = payload as {
      active?: Array<{ delegationId: string; elapsedMs: number }>;
    };
    for (const item of p.active ?? []) {
      this.delegations = this.delegations.map((d) =>
        d.id === item.delegationId ? { ...d, elapsedMs: item.elapsedMs } : d
      );
    }
  }

  private handleDelegationAccumulated(payload: unknown): void {
    const p = payload as {
      delegationId?: string;
      targetAgentKey?: string;
    };
    if (p.delegationId) {
      this.delegations = this.delegations.map((d) =>
        d.id === p.delegationId ? { ...d, status: "accumulated" } : d
      );
    }
    if (p.targetAgentKey && this.agents[p.targetAgentKey]) {
      this.agents[p.targetAgentKey]!.speechBubble = "Done — waiting for team...";
    }
  }

  // ── Team events ───────────────────────────────────────────────────────────────

  private handleTeamCreated(payload: unknown): void {
    const p = payload as {
      teamId?: string;
      teamName?: string;
      leadAgentKey?: string;
      leadDisplayName?: string;
      memberKeys?: string[];
    };
    if (!p.teamId) return;
    this.teams[p.teamId] = {
      id: p.teamId,
      name: p.teamName ?? p.teamId,
      leadId: p.leadAgentKey ?? "",
      leadDisplayName: p.leadDisplayName,
      members: p.memberKeys ?? [],
    };
  }

  private handleTeamUpdated(payload: unknown): void {
    const p = payload as { teamId?: string; teamName?: string };
    if (p.teamId && this.teams[p.teamId]) {
      this.teams[p.teamId] = {
        ...this.teams[p.teamId]!,
        name: p.teamName ?? this.teams[p.teamId]!.name,
      };
    }
  }

  private handleTeamDeleted(payload: unknown): void {
    const p = payload as { teamId?: string };
    if (p.teamId) delete this.teams[p.teamId];
  }

  private handleTeamMember(payload: unknown, action: "add" | "remove"): void {
    const p = payload as { teamId?: string; agentKey?: string };
    if (!p.teamId || !this.teams[p.teamId] || !p.agentKey) return;
    const team = this.teams[p.teamId]!;
    if (action === "add") {
      if (!team.members.includes(p.agentKey)) {
        team.members = [...team.members, p.agentKey];
      }
    } else {
      team.members = team.members.filter((m) => m !== p.agentKey);
    }
  }

  // ── Task events ───────────────────────────────────────────────────────────────

  private handleTask(payload: unknown, action: string): void {
    const p = payload as {
      taskId?: string;
      teamId?: string;
      subject?: string;
      status?: string;
      ownerAgentKey?: string;
      ownerDisplayName?: string;
      reason?: string;
    };
    if (!p.taskId) return;
    this.tasks[p.taskId] = {
      id: p.taskId,
      teamId: p.teamId ?? "",
      subject: p.subject ?? "",
      status: p.status ?? action,
      ownerAgentKey: p.ownerAgentKey,
      ownerDisplayName: p.ownerDisplayName,
      reason: p.reason,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Agent link events ──────────────────────────────────────────────────────────

  private handleAgentLink(payload: unknown, action: "upsert" | "delete"): void {
    const p = payload as {
      linkId?: string;
      sourceAgentKey?: string;
      targetAgentKey?: string;
      direction?: string;
      status?: string;
      teamId?: string;
    };
    if (!p.linkId) return;
    if (action === "delete") {
      this.agentLinks = this.agentLinks.filter((l) => l.id !== p.linkId);
    } else {
      const link: OfficeAgentLink = {
        id: p.linkId,
        sourceAgentKey: p.sourceAgentKey ?? "",
        targetAgentKey: p.targetAgentKey ?? "",
        direction: p.direction ?? "one-way",
        status: p.status ?? "active",
        teamId: p.teamId,
      };
      const idx = this.agentLinks.findIndex((l) => l.id === p.linkId);
      if (idx >= 0) {
        this.agentLinks = this.agentLinks.map((l, i) => (i === idx ? link : l));
      } else {
        this.agentLinks = [...this.agentLinks, link];
      }
    }
  }

  // ── Agent summoning ────────────────────────────────────────────────────────────

  private handleAgentSummoning(payload: unknown): void {
    const p = payload as { agentKey?: string; displayName?: string };
    if (!p.agentKey || this.agents[p.agentKey]) return;
    this.agents[p.agentKey] = {
      ...this.newAgent(p.agentKey),
      displayName: p.displayName ?? p.agentKey,
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
