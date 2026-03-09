// API calls for channel instance management — POST /v1/channels/instances
import { apiURL } from "@/lib/config";

const getHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${localStorage.getItem("goclaw:token") ?? ""}`,
  "X-GoClaw-User-Id": localStorage.getItem("goclaw:userId") ?? "default",
  "Content-Type": "application/json",
});

export interface CreateChannelInstanceInput {
  name: string;
  channel_type: string;
  agent_id: string;
  credentials?: Record<string, string>;
  config?: Record<string, unknown>;  // approval rules, behaviour settings
  enabled: boolean;
}

export async function createChannelInstance(
  input: CreateChannelInstanceInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(apiURL("/v1/channels/instances"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? "Failed to create channel" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
