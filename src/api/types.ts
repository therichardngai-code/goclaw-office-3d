// Matches internal/office/state.go

export type AgentState =
  | "idle"
  | "receiving"
  | "thinking"
  | "responding"
  | "tool_calling"
  | "error";

export interface OfficeAgent {
  id: string;
  name: string;
  model: string;
  provider: string;
  state: AgentState;
  speechBubble?: string;
  currentRunId?: string;
  currentChannel?: string;
  agentType?: string;
  displayName?: string;
  characterIndex: number;
  lastActiveAt: string;
}

export interface OfficeTeam {
  id: string;
  name: string;
  leadId: string;
  leadDisplayName?: string;
  members: string[];
}

export interface OfficeDelegation {
  id: string;
  sourceId: string;
  targetId: string;
  sourceDisplayName?: string;
  targetDisplayName?: string;
  task?: string;
  status: string; // running/completed/failed/cancelled/accumulated
  mode: string;
  teamId?: string;
  teamTaskId?: string;
  elapsedMs?: number;
  error?: string; // error message for failed delegations
  startedAt: string;
}

export interface OfficeAgentLink {
  id: string;
  sourceAgentKey: string;
  targetAgentKey: string;
  direction: string;
  status: string;
  teamId?: string;
}

export interface OfficeTask {
  id: string;
  teamId: string;
  subject: string;
  status: string; // pending/in_progress/completed/cancelled
  ownerAgentKey?: string;
  ownerDisplayName?: string;
  reason?: string; // for cancelled tasks
  timestamp: string;
}

export interface GatewayDesk {
  version: string;
  healthy: boolean;
  mode: string;
  uptime: number;
  eventCount: number;
  startedAt: string;
}

export interface Notification {
  id: string;
  agentId?: string;
  type: string;
  message: string;
  timestamp: string;
}

export interface OfficeSnapshot {
  gateway: GatewayDesk;
  agents: Record<string, OfficeAgent>;
  teams: Record<string, OfficeTeam>;
  activeDelegations: OfficeDelegation[];
  agentLinks: OfficeAgentLink[];
  tasks: Record<string, OfficeTask>;
  notifications: Notification[];
  updatedAt: string;
}
