import { WS_URL } from "@/lib/config";

type EventHandler = (payload: unknown) => void;

interface WsFrame {
  type: "req" | "res" | "event";
  id?: string;
  event?: string;  // for event frames — Go EventFrame uses "event" field, not "name"
  ok?: boolean;    // for res frames
  payload?: unknown;
}

export class OfficeWsClient {
  private ws: WebSocket | null = null;
  private token = "";
  private retryDelay = 1_000;
  private readonly maxRetry = 30_000;
  private connected = false;
  private stopped = false;

  // event name → set of handlers
  private handlers = new Map<string, Set<EventHandler>>();

  // handlers that receive (name, payload) — used by state machine
  private namedHandlers = new Set<(name: string, payload: unknown) => void>();

  private onConnectedCb?: () => void;
  private onDisconnectedCb?: () => void;

  connect(
    token: string,
    onConnected?: () => void,
    onDisconnected?: () => void
  ): void {
    this.token = token;
    this.stopped = false;
    this.onConnectedCb = onConnected;
    this.onDisconnectedCb = onDisconnected;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.stopped) return;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      // Send connect handshake per goclaw WS protocol v3
      const frame = {
        type: "req",
        id: crypto.randomUUID(),
        method: "connect",
        params: {
          token: this.token,
          userId: localStorage.getItem("goclaw:userId") ?? "default",
          senderId: "",
        },
      };
      this.ws!.send(JSON.stringify(frame));
    };

    this.ws.onmessage = (ev) => {
      try {
        const frame: WsFrame = JSON.parse(ev.data as string);
        this.handleFrame(frame);
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.onDisconnectedCb?.();
      if (!this.stopped) {
        setTimeout(() => this.doConnect(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetry);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private handleFrame(frame: WsFrame): void {
    if (frame.type === "res" && frame.ok) {
      // Connect handshake succeeded — reset backoff
      this.connected = true;
      this.retryDelay = 1_000;
      this.onConnectedCb?.();
      return;
    }

    if (frame.type === "event" && frame.event) {
      // Named handlers (used by state machine)
      this.namedHandlers.forEach((h) => h(frame.event!, frame.payload));

      // Per-event handlers (legacy support)
      this.handlers.get(frame.event)?.forEach((h) => h(frame.payload));
    }
  }

  // Subscribe to a specific event by name
  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  // Subscribe to ALL events — handler receives (eventName, payload)
  onNamed(handler: (name: string, payload: unknown) => void): () => void {
    this.namedHandlers.add(handler);
    return () => this.namedHandlers.delete(handler);
  }

  disconnect(): void {
    this.stopped = true;
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
