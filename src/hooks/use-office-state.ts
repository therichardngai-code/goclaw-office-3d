import { useEffect, useRef } from "react";
import { OfficeWsClient } from "@/api/ws-client";
import { OfficeStateMachine } from "@/stores/office-state-machine";
import { useOfficeStore } from "@/stores/use-office-store";
import { useEventStore } from "@/stores/use-event-store";
import { fetchAllAgents } from "@/api/agent-api";

// Coalesce rapid WS bursts — LLM token chunks fire at 20-50 Hz.
// Scene update at ~7-10 Hz is more than enough for visual smoothness.
const DEBOUNCE_MS = 150;

export function useOfficeState(token: string): void {
  const setSnapshot = useOfficeStore((s) => s.setSnapshot);
  const setConnected = useOfficeStore((s) => s.setConnected);
  const setMachine = useOfficeStore((s) => s.setMachine);
  const removeApiAgent = useOfficeStore((s) => s.removeApiAgent);

  const clientRef = useRef<OfficeWsClient | null>(null);
  const machineRef = useRef<OfficeStateMachine>(new OfficeStateMachine());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;

    const machine = machineRef.current;
    const client = new OfficeWsClient();
    clientRef.current = client;

    // Expose machine to store so seedAgents() is called when REST data arrives
    setMachine(machine);

    // Expose WS call function so chat panel can call chat.send / chat.history
    useOfficeStore.getState().setWsCall((method, params) => client.call(method, params ?? {}));

    // Trailing-edge debounce — coalesces bursts (tool chunks fire at 20-50 Hz)
    const flush = () => {
      setSnapshot(machine.snapshot());
      timerRef.current = null;
    };
    const schedule = () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    };

    const setApiAgents = useOfficeStore.getState().setApiAgents;

    // Every WS event → update state machine → debounced snapshot push
    const unsub = client.onNamed((name, payload) => {
      // Capture every raw event in event store for the "Events" tab
      useEventStore.getState().addEvent(name, payload);
      machine.handleEvent(name, payload);

      // Bridge WS agent events → chat panel
      // agent event payload: { type, agentId, runKind?, payload?: { content?, error? } }
      if (name === "agent") {
        const p = payload as { type?: string; agentId?: string; payload?: unknown };
        const store = useOfficeStore.getState();
        if (p.agentId) {
          if (p.type === "chunk") {
            // Stream token — high frequency, accumulated in panel via ref
            const inner = p.payload as { content?: string } | null | undefined;
            if (inner?.content) {
              store.setIncomingChatChunk({ agentKey: p.agentId, content: inner.content });
            }
          } else if (p.type === "run.completed") {
            // Always fire — content non-empty for announce runs, empty for interactive chat.send runs
            const inner = p.payload as { content?: string } | null | undefined;
            store.setIncomingChatMessage({ agentKey: p.agentId, content: inner?.content ?? "" });
          } else if (p.type === "run.failed") {
            const inner = p.payload as { error?: string } | null | undefined;
            store.setIncomingChatError({ agentKey: p.agentId, error: inner?.error ?? "Agent run failed" });
          }
        }
      }

      if (name === "agent.summoning") {
        const p = payload as { type?: string; agent_id?: string };
        if ((p.type === "failed" || p.type === "error") && p.agent_id) {
          // Evict from REST cache so buildMergedAgents doesn't resurrect it
          removeApiAgent(p.agent_id);
        } else if (p.type === "completed") {
          // New agent is now live — refresh REST list immediately
          fetchAllAgents().then(setApiAgents).catch(() => {});
        }
      }

      // team.created only includes lead_agent_key — initial members are NOT
      // sent as team.member.added events. Fetch full member list via teams.get.
      if (name === "team.created") {
        const p = payload as { team_id?: string };
        if (p.team_id) {
          client.call("teams.get", { teamId: p.team_id })
            .then((res) => {
              const r = res as {
                members?: Array<{ agent_key?: string; display_name?: string; role?: string }>;
              };
              if (r.members) {
                machine.seedTeamMembers(p.team_id!, r.members);
                schedule();
              }
            })
            .catch(() => {});
        }
      }

      // cache.invalidate kind=agent → refresh agent list so newly created/deleted
      // agents appear without waiting for the 30s poll
      if (name === "cache.invalidate") {
        const p = payload as { kind?: string };
        if (p.kind === "agent") {
          fetchAllAgents().then(setApiAgents).catch(() => {});
        }
      }

      schedule();
    });

    client.connect(
      token,
      () => {
        setConnected(true);
        // Push initial snapshot immediately on connect
        setSnapshot(machine.snapshot());
      },
      () => setConnected(false)
    );

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      useOfficeStore.getState().setWsCall(null);
      unsub();
      client.disconnect();
      clientRef.current = null;
    };
  }, [token, setSnapshot, setConnected, setMachine]);
}
