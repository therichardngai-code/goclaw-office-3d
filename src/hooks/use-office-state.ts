import { useEffect, useRef } from "react";
import { OfficeWsClient } from "@/api/ws-client";
import { OfficeStateMachine } from "@/stores/office-state-machine";
import { useOfficeStore } from "@/stores/use-office-store";

// Coalesce rapid WS bursts — LLM token chunks fire at 20-50 Hz.
// Scene update at ~7-10 Hz is more than enough for visual smoothness.
const DEBOUNCE_MS = 150;

export function useOfficeState(token: string): void {
  const setSnapshot = useOfficeStore((s) => s.setSnapshot);
  const setConnected = useOfficeStore((s) => s.setConnected);
  const setMachine = useOfficeStore((s) => s.setMachine);

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

    // Trailing-edge debounce — coalesces bursts (tool chunks fire at 20-50 Hz)
    const flush = () => {
      setSnapshot(machine.snapshot());
      timerRef.current = null;
    };
    const schedule = () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    };

    // Every WS event → update state machine → debounced snapshot push
    const unsub = client.onNamed((name, payload) => {
      machine.handleEvent(name, payload);
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
      unsub();
      client.disconnect();
      clientRef.current = null;
    };
  }, [token, setSnapshot, setConnected, setMachine]);
}
