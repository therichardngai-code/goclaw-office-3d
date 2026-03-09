import { useEffect } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { fetchAllAgents } from "@/api/agent-api";

const POLL_MS = 30_000;

// Fetches all agents from REST API and keeps the store's mergedSnapshot in sync.
// Polls every 30s so newly created agents appear without a page refresh.
export function useApiAgents(token: string): void {
  const setApiAgents = useOfficeStore((s) => s.setApiAgents);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      const agents = await fetchAllAgents();
      if (!cancelled) setApiAgents(agents);
    };

    load();
    const id = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, setApiAgents]);
}
