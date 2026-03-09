import { useEffect } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { fetchAllAgents, fetchChannelInstances } from "@/api/agent-api";

const POLL_MS = 30_000;

// Fetches agents + channel instances from REST API and keeps the store in sync.
// Polls every 30s so newly created agents/channels appear without a page refresh.
export function useApiAgents(token: string): void {
  const setApiAgents = useOfficeStore((s) => s.setApiAgents);
  const setChannelInstances = useOfficeStore((s) => s.setChannelInstances);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      const [agents, instances] = await Promise.all([
        fetchAllAgents(),
        fetchChannelInstances(),
      ]);
      if (!cancelled) {
        setChannelInstances(instances);
        setApiAgents(agents);
      }
    };

    load();
    const id = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, setApiAgents, setChannelInstances]);
}
