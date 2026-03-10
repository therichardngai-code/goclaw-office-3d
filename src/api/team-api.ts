// WS-based team management using goclaw RPC methods.
// All calls go through the wsCall slot in useOfficeStore.

type WsCallFn = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

export interface TeamData {
  id: string;
  name: string;
  description?: string;
  lead_agent_key: string;
  lead_display_name?: string;
  member_count?: number;
  status: string;
  created_at: string;
}

export async function listTeams(wsCall: WsCallFn): Promise<TeamData[]> {
  try {
    const res = await wsCall("teams.list") as { teams?: TeamData[] };
    return res.teams ?? [];
  } catch {
    return [];
  }
}

export async function createTeam(
  wsCall: WsCallFn,
  params: { name: string; lead: string; members: string[]; description?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await wsCall("teams.create", params as unknown as Record<string, unknown>);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function deleteTeam(
  wsCall: WsCallFn,
  teamId: string
): Promise<void> {
  try {
    await wsCall("teams.delete", { teamId });
  } catch {
    // ignore — list will be refreshed regardless
  }
}
