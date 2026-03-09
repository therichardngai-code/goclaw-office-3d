// API calls for LLM provider management — /v1/providers
import { apiURL } from "@/lib/config";

const getHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${localStorage.getItem("goclaw:token") ?? ""}`,
  "X-GoClaw-User-Id": localStorage.getItem("goclaw:userId") ?? "default",
  "Content-Type": "application/json",
});

export interface CreateProviderInput {
  name: string;
  display_name?: string;
  provider_type: string;
  api_base?: string;
  api_key?: string;
  enabled: boolean;
}

export interface CreatedProvider {
  id: string;
  name: string;
  display_name?: string;
  provider_type: string;
  enabled: boolean;
}

export async function createProvider(
  input: CreateProviderInput
): Promise<{ ok: boolean; provider?: CreatedProvider; error?: string }> {
  try {
    const res = await fetch(apiURL("/v1/providers"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? "Failed to create provider" };
    }
    const data = await res.json();
    return { ok: true, provider: data as CreatedProvider };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function verifyProvider(
  providerId: string,
  model: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(apiURL(`/v1/providers/${providerId}/verify`), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ model }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { valid: false, error: (data as { error?: string }).error ?? "Verification failed" };
    }
    const data = await res.json() as { valid?: boolean; error?: string };
    return { valid: data.valid ?? false, error: data.error };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}
