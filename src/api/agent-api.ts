// API calls for agent management — proxied through GoClaw /v1/* endpoints
import { apiURL } from "@/lib/config";

const getHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${localStorage.getItem("goclaw:token") ?? ""}`,
  "X-GoClaw-User-Id": localStorage.getItem("goclaw:userId") ?? "default",
  "Content-Type": "application/json",
});

export interface Provider {
  id: string;            // UUID — used only for /v1/providers/{id}/models
  name: string;          // slug (e.g. "minimax-native") — sent to createAgent as provider
  display_name?: string; // human-readable label for UI (e.g. "MiniMax Native")
  provider_type: string; // e.g. "anthropic_native", "minimax_native", "chatgpt_oauth", "claude_cli"
  enabled: boolean;
}

// Hardcoded model list for ChatGPT OAuth — token lacks api.model.read scope
const CHATGPT_OAUTH_MODELS: ProviderModel[] = [
  { id: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
  { id: "gpt-5.2-codex", name: "GPT-5.2 Codex" },
  { id: "gpt-5.2", name: "GPT-5.2" },
  { id: "gpt-5.1-codex", name: "GPT-5.1 Codex" },
  { id: "gpt-5.1", name: "GPT-5.1" },
];

export interface ChannelInstance {
  id: string;
  name: string;
  channel_type: string;
  agent_id: string;
  status?: string;
}

export interface CreateAgentInput {
  agent_key: string;
  display_name?: string;
  provider: string;
  model: string;
  agent_type: "open" | "predefined";
  other_config?: { description?: string };
}

export async function fetchProviders(): Promise<Provider[]> {
  try {
    const res = await fetch(apiURL("/v1/providers"), { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    // Return ALL configured providers so users can pick any, not just enabled ones.
    // Disabled providers still have valid slugs and the agent runtime may accept them.
    return data.providers ?? [];
  } catch {
    return [];
  }
}

export interface ProviderModel {
  id: string;   // API identifier sent to goclaw (e.g. "MiniMax-M2.5")
  name: string; // Display label shown in dropdown (e.g. "MiniMax M2.5")
}

export async function fetchProviderModels(
  providerId: string,
  providerType?: string
): Promise<ProviderModel[]> {
  // ChatGPT OAuth token lacks api.model.read scope — use hardcoded list
  if (providerType === "chatgpt_oauth") {
    return CHATGPT_OAUTH_MODELS;
  }
  try {
    const res = await fetch(apiURL(`/v1/providers/${providerId}/models`), {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m: { id: string; name: string }) => ({
      id: m.id,
      name: m.name ?? m.id,
    }));
  } catch {
    return [];
  }
}

export async function createAgent(
  input: CreateAgentInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(apiURL("/v1/agents"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? "Failed to create agent" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Minimal agent record returned by GET /v1/agents
export interface AgentRecord {
  id: string;
  agent_key: string;
  display_name?: string;
  provider: string;
  model: string;
  agent_type: string;
  status: string;
}

export async function fetchAllAgents(): Promise<AgentRecord[]> {
  try {
    const res = await fetch(apiURL("/v1/agents"), { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.agents ?? []).filter((a: AgentRecord) => a.status === "active" || a.status === "summoning");
  } catch {
    return [];
  }
}

export async function fetchChannelInstances(): Promise<ChannelInstance[]> {
  try {
    const res = await fetch(apiURL("/v1/channels/instances"), { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.instances ?? [];
  } catch {
    return [];
  }
}
