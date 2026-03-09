// Dev: VITE_BACKEND_URL="" — Vite proxy handles /ws and /v1/
// Production: VITE_BACKEND_URL="https://my-goclaw.com"
export const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "";

// WebSocket URL: http → ws, https → wss
export const WS_URL = BACKEND
  ? `${BACKEND.replace(/^http/, "ws")}/ws`
  : "/ws";

export const apiURL = (path: string) => `${BACKEND}${path}`;
