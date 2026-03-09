// Captures all raw WS events for the "Events" tab — mirrors goclaw ui/web useTeamEventStore pattern
import { create } from "zustand";

const MAX_EVENTS = 500;
const PERSIST_KEY = "goclaw:web3d:recentEvents";
const PERSIST_MAX = 30;

export interface WsEventEntry {
  id: number;
  event: string;
  payload: unknown;
  timestamp: number;
  teamId: string | null;
  userId: string | null;
}

interface EventStore {
  events: WsEventEntry[];
  paused: boolean;
  addEvent: (event: string, payload: unknown) => void;
  clear: () => void;
  setPaused: (v: boolean) => void;
}

function extractStr(payload: unknown, ...keys: string[]): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const k of keys) {
    if (typeof p[k] === "string" && p[k]) return p[k] as string;
  }
  return null;
}

function loadPersisted(): WsEventEntry[] {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WsEventEntry[];
    return Array.isArray(parsed) ? parsed.slice(-PERSIST_MAX) : [];
  } catch {
    return [];
  }
}

const initial = loadPersisted();
let counter = initial.length > 0 ? (initial[initial.length - 1]?.id ?? 0) : 0;

export const useEventStore = create<EventStore>((set) => ({
  events: initial,
  paused: false,

  addEvent: (event, payload) => {
    set((s) => {
      if (s.paused) return s;
      const entry: WsEventEntry = {
        id: ++counter,
        event,
        payload,
        timestamp: Date.now(),
        teamId: extractStr(payload, "team_id", "teamId"),
        userId: extractStr(payload, "user_id", "userId"),
      };
      const next = [...s.events, entry];
      const trimmed = next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(trimmed.slice(-PERSIST_MAX)));
      } catch { /* storage full */ }
      return { events: trimmed };
    });
  },

  clear: () => {
    localStorage.removeItem(PERSIST_KEY);
    set({ events: [] });
  },
  setPaused: (paused) => set({ paused }),
}));
