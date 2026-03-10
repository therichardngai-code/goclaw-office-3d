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
  // agent_key → canonical UUID (populated by seedAgents, used to route WS events)
  private keyToId = new Map<string, string>();
  private tasks: Record<string, OfficeTask> = {};
  private notifications: Notification[] = [];
  private eventCount = 0;
  private readonly startedAt = new Date().toISOString();
  // Set before each dispatch so addNotification can attach raw payload without touching all call sites
  private currentEventName = "";
  private currentEventPayload: unknown = null;

  // ── Seed ────────────────────────────────────────────────────────────────────

  // Seed channel instance name → channel type lookup from REST /v1/channels/instances
  seedChannels(instances: { name: string; channel_type: string }[]): void {
    for (const inst of instances) {
      this.channelTypeMap.set(inst.name.toLowerCase(), inst.channel_type.toLowerCase());
    }
  }

  // Seed full member list for a team after teams.get RPC response.
  // Called after team.created when we need the complete member list
  // (team.created payload only includes lead; no team.member.added events fire for initial members).
  seedTeamMembers(
    teamId: string,
    members: Array<{ agent_key?: string; display_name?: string; role?: string }>
  ): void {
    const team = this.teams[teamId];
    if (!team) return;
    for (const m of members) {
      if (!m.agent_key) continue;
      if (!team.members.includes(m.agent_key)) {
        team.members = [...team.members, m.agent_key];
      }
      // Ensure leadId is set correctly (role = "lead")
      const role = (m.role ?? "").toLowerCase();
      if (role === "lead" && team.leadId !== m.agent_key) {
        team.leadId = m.agent_key;
        if (m.display_name) team.leadDisplayName = m.display_name;
      }
    }
  }

  // Seed teams from REST/RPC on connect — restores team platforms after page refresh.
  // WS team.created/team.member.added events are not replayed on reconnect, so without
  // this seed the state machine starts with teams={} and no team platforms are rendered.
  // Skips teams already tracked by live WS events (idempotent).
  seedTeamsFromList(
    list: Array<{ id: string; name: string; lead_agent_key: string; lead_display_name?: string }>,
    memberMap: Record<string, Array<{ agent_key?: string; display_name?: string; role?: string }>>
  ): void {
    for (const t of list) {
      if (this.teams[t.id]) continue; // live WS state takes precedence
      const members = (memberMap[t.id] ?? [])
        .filter((m) => m.agent_key)
        .map((m) => m.agent_key!);
      this.teams[t.id] = {
        id: t.id,
        name: t.name,
        leadId: t.lead_agent_key,
        leadDisplayName: t.lead_display_name,
        members,
      };
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
      agent.characterIndex = charIdx(a.agent_key);

      // If WS events already fired using agent_key as agentId (before seed),
      // migrate that live state into the canonical UUID entry, then remove it.
      if (a.agent_key !== a.id && this.agents[a.agent_key]) {
        const pre = this.agents[a.agent_key]!;
        if (pre.state !== "idle") agent.state = pre.state;
        if (pre.currentChannel) agent.currentChannel = pre.currentChannel;
        if (pre.currentRunId)   agent.currentRunId   = pre.currentRunId;
        if (pre.speechBubble)   agent.speechBubble   = pre.speechBubble;
        if (pre.lastActiveAt > agent.lastActiveAt) agent.lastActiveAt = pre.lastActiveAt;
        delete this.agents[a.agent_key];
      }

      // Register key → UUID so future WS events route to the canonical UUID entry
      this.keyToId.set(a.agent_key, a.id);
    }
  }

  // ── Main dispatch ────────────────────────────────────────────────────────────

  handleEvent(name: string, payload: unknown): void {
    this.eventCount++;
    // Capture context so addNotification can attach raw data automatically
    this.currentEventName = name;
    this.currentEventPayload = payload;

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
      case "agent_link.created":            return this.handleAgentLink(payload, "upsert");
      case "agent_link.updated":            return this.handleAgentLink(payload, "upsert");
      case "agent_link.deleted":            return this.handleAgentLink(payload, "delete");
      case "agent.summoning":               return this.handleAgentSummoning(payload);
      case "delegation.announce":           return this.handleDelegationAnnounce(payload);
      case "delegation.quality_gate.retry": return this.handleQualityGateRetry(payload);
      case "team.message.sent":             return this.handleTeamMessage(payload);
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
    if (!p.agentId) return;
    // Resolve agent_key → canonical UUID (WS sends key string, not UUID)
    const id = this.keyToId.get(p.agentId) ?? p.agentId;

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

      case "block.reply":
        agent.state = "idle";
        agent.speechBubble = undefined;
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

    // Resolve agent keys → UUIDs so DelegationArcManager can look up charMgr positions.
    // charMgr is keyed by UUID (from mergedSnapshot); delegation WS payload has agent_key strings.
    const srcId = this.keyToId.get(p.source_agent_key ?? "") ?? p.source_agent_key ?? "";
    const tgtId = this.keyToId.get(p.target_agent_key ?? "") ?? p.target_agent_key ?? "";

    this.delegations = [
      ...this.delegations.slice(-(MAX_DELEGATIONS - 1)),
      {
        id: p.delegation_id,
        sourceId: srcId,
        targetId: tgtId,
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
    if (srcId && this.agents[srcId]) {
      this.agents[srcId]!.speechBubble =
        `→ Briefing ${p.target_display_name ?? p.target_agent_key}...`;
    }
    if (tgtId && this.agents[tgtId]) {
      this.agents[tgtId]!.speechBubble = "← Receiving task...";
    }

    const src = p.source_display_name ?? p.source_agent_key ?? "?";
    const tgt = p.target_display_name ?? p.target_agent_key ?? "?";
    const task = p.task ? `: ${p.task.slice(0, 60)}` : "";
    this.addNotification("delegation", srcId, `${src} → ${tgt}${task}`);
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
    const teamName = p.team_name ?? p.team_id;
    const lead = p.lead_display_name ?? p.lead_agent_key ?? "";
    this.addNotification("team", p.team_id, `Team "${teamName}" created${lead ? ` — lead: ${lead}` : ""}`);
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
    const p = payload as {
      team_id?: string;
      team_name?: string;
      agent_key?: string;
      display_name?: string;
    };
    if (!p.team_id || !this.teams[p.team_id] || !p.agent_key) return;
    const team = this.teams[p.team_id]!;
    if (action === "add") {
      if (!team.members.includes(p.agent_key)) {
        team.members = [...team.members, p.agent_key];
      }
    } else {
      team.members = team.members.filter((m) => m !== p.agent_key);
    }
    const who = p.display_name ?? p.agent_key;
    const tName = p.team_name ?? team.name;
    const verb = action === "add" ? "joined" : "left";
    this.addNotification("team", p.team_id, `${who} ${verb} team "${tName}"`);
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
    const owner = p.owner_display_name ?? p.owner_agent_key;
    const subject = p.subject ? `"${p.subject.slice(0, 50)}"` : "task";
    const ownerStr = owner ? ` (${owner})` : "";
    this.addNotification("team.task", p.team_id ?? "", `Task ${action}: ${subject}${ownerStr}`);
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
    // Summoner broadcasts { type, agent_id } — only act on non-failure events
    const p = payload as { type?: string; agent_id?: string; display_name?: string };
    const label = p.display_name ?? p.agent_id ?? "agent";

    if (p.type === "failed" || p.type === "error") {
      // Agent creation failed — remove any entry added by the prior "started" event.
      if (p.agent_id) delete this.agents[p.agent_id];
      this.addNotification("agent.summoning", p.agent_id ?? "", `Summoning failed: ${label}`);
      return;
    }

    if (p.type === "started") {
      this.addNotification("agent.summoning", p.agent_id ?? "", `Summoning ${label}...`);
    } else if (p.type === "completed") {
      this.addNotification("agent.summoning", p.agent_id ?? "", `${label} joined the office`);
    }

    const key = p.agent_id;
    if (!key || this.agents[key]) return;
    this.agents[key] = {
      ...this.newAgent(key),
      displayName: label,
    };
  }

  // ── Delegation announce / quality gate ────────────────────────────────────────

  private handleDelegationAnnounce(payload: unknown): void {
    const p = payload as {
      source_agent_key?: string;
      source_display_name?: string;
      results?: Array<{ agent_key?: string; display_name?: string }>;
      total_elapsed_ms?: number;
    };
    const src = p.source_display_name ?? p.source_agent_key ?? "?";
    const count = p.results?.length ?? 0;
    const ms = p.total_elapsed_ms ? ` in ${(p.total_elapsed_ms / 1000).toFixed(1)}s` : "";
    const srcId = this.keyToId.get(p.source_agent_key ?? "") ?? p.source_agent_key ?? "";
    this.addNotification("delegation", srcId, `${src}: all ${count} sub-tasks done${ms}`);
  }

  private handleQualityGateRetry(payload: unknown): void {
    const p = payload as {
      target_agent_key?: string;
      gate_type?: string;
      attempt?: number;
      max_retries?: number;
    };
    const tgt = p.target_agent_key ?? "?";
    const tgtId = this.keyToId.get(tgt) ?? tgt;
    this.addNotification(
      "delegation",
      tgtId,
      `Quality gate retry ${p.attempt ?? 1}/${p.max_retries ?? "?"}: ${tgt}`
    );
  }

  private handleTeamMessage(payload: unknown): void {
    const p = payload as {
      from_agent_key?: string;
      from_display_name?: string;
      to_agent_key?: string;
      to_display_name?: string;
      preview?: string;
      message_type?: string;
    };
    const from = p.from_display_name ?? p.from_agent_key ?? "?";
    const to = p.to_display_name ?? p.to_agent_key ?? "?";
    const preview = p.preview ? `: ${p.preview.slice(0, 60)}` : "";
    const fromId = this.keyToId.get(p.from_agent_key ?? "") ?? p.from_agent_key ?? "";
    this.addNotification("team.message", fromId, `${from} → ${to}${preview}`);
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
        rawEventName: this.currentEventName,
        rawPayload: this.currentEventPayload,
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
