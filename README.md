# GoClaw Office 3D

A real-time **3D office visualization** for [GoClaw](https://github.com/nextlevelbuilder/goclaw) AI agents. Watch your agents think, respond, and collaborate — rendered as animated characters in a live 3D workspace, all driven by the GoClaw WebSocket event stream.

```
postgres ──► goclaw (AI gateway) ──► goclaw-ui (web dashboard)
                                 └──► web3d     (this — 3D office)
```

---

## Features

| Category | What you get |
|---|---|
| **3D Scene** | Animated office environment — agents rendered as distinct characters on their own platforms |
| **Live state** | Agent states (idle / thinking / responding / tool_calling / error) reflected in real-time via WS events |
| **Speech bubbles** | LLM output streamed token-by-token into in-scene speech bubbles |
| **Delegation arcs** | Animated arcs between agents during active team delegations |
| **Team platforms** | Team members grouped on a shared elevated platform; lead–member arcs rendered |
| **Chat panel** | Per-agent persistent chat with session history — survives page refresh (stored in GoClaw DB) |
| **Session history** | Browse and resume previous chat sessions (up to 20 per agent, stored in localStorage) |
| **Agent management** | Recruit predefined or open agents directly from the 3D UI |
| **Channel setup** | Connect agents to Telegram, Discord, Slack, Feishu, Zalo, WhatsApp with full approval/policy config |
| **Team management** | Create, view, and delete agent teams with lead + member assignment |
| **Provider management** | Add LLM providers (Anthropic, OpenAI-compat, etc.) from within the UI |
| **Notifications** | Live notification panel with raw WS event inspector |
| **Docker-first** | Single `docker compose up --build` spins the full 4-service stack |

---

## Stack

| Layer | Technology |
|---|---|
| 3D engine | [Three.js](https://threejs.org/) 0.165 |
| UI framework | [React](https://react.dev/) 19 + [Vite](https://vitejs.dev/) 6 |
| State | [Zustand](https://zustand.pmnd.rs/) 5 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 4 |
| Language | TypeScript 5.7 |
| Package manager | pnpm 10 |
| Production server | nginx (via Docker multi-stage build) |
| Backend | [GoClaw](https://github.com/nextlevelbuilder/goclaw) (pre-built GHCR image) |

---

## Quick Start (Docker)

### Prerequisites
- Docker + Docker Compose v2
- A GoClaw gateway token and encryption key

### 1. Clone and configure

```bash
git clone https://github.com/therichardngai-code/goclaw-office-3d
cd goclaw-office-3d

cp .env.example .env
# Edit .env — fill in GOCLAW_GATEWAY_TOKEN and GOCLAW_ENCRYPTION_KEY
```

Generate the required secrets:
```bash
openssl rand -hex 32   # → GOCLAW_GATEWAY_TOKEN
openssl rand -hex 32   # → GOCLAW_ENCRYPTION_KEY
```

### 2. Start the stack

```bash
docker compose up -d --build
```

This starts four services:

| Service | URL | Description |
|---|---|---|
| `web3d` | http://localhost:8080 | **3D Office UI** (this repo) |
| `goclaw-ui` | http://localhost:3000 | Web Dashboard (agents, channels, providers, logs) |
| `goclaw` | http://localhost:18790 | GoClaw API (optional direct access) |
| `postgres` | — | PostgreSQL + pgvector (internal) |

### 3. First run

1. Open **http://localhost:3000** (web dashboard) to onboard: add an LLM provider and create your first agent
2. Open **http://localhost:8080** (3D office) — enter the same gateway token and start chatting

---

## Development Setup

```bash
# Install dependencies
pnpm install

# Start dev server (proxies /ws and /v1/* to a local GoClaw instance)
pnpm dev
```

The dev server proxies API and WS traffic via Vite's built-in proxy — no CORS issues.
By default it assumes GoClaw is running on `localhost:18790`. Override with:

```bash
VITE_BACKEND_URL=http://my-remote-goclaw.com pnpm dev
```

### Build

```bash
pnpm build          # TypeScript compile + Vite bundle → dist/
pnpm preview        # Preview production build locally
```

---

## Environment Variables

### Docker (`.env`)

| Variable | Default | Description |
|---|---|---|
| `GOCLAW_GATEWAY_TOKEN` | — | **Required.** Bearer token for GoClaw auth |
| `GOCLAW_ENCRYPTION_KEY` | — | **Required.** 64-char hex key (AES-256-GCM) |
| `POSTGRES_USER` | `goclaw` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `goclaw` | PostgreSQL password |
| `POSTGRES_DB` | `goclaw` | PostgreSQL database name |
| `WEB3D_PORT` | `8080` | Host port for the 3D office UI |
| `GOCLAW_UI_PORT` | `3000` | Host port for the web dashboard |
| `GOCLAW_API_PORT` | `18790` | Host port for direct GoClaw API access |

### Vite (`.env.local` for dev)

| Variable | Default | Description |
|---|---|---|
| `VITE_BACKEND_URL` | `""` (Vite proxy) | Override GoClaw backend URL for production builds |

---

## Project Structure

```
src/
├── api/                    API + WS clients
│   ├── ws-client.ts        WebSocket RPC client (connect/call/events)
│   ├── agent-api.ts        Agent/provider CRUD (HTTP /v1/*)
│   ├── channel-api.ts      Channel instance CRUD (HTTP /v1/channels/instances)
│   ├── chat-ws.ts          WS chat sessions: send, history, session list
│   ├── team-api.ts         WS team management: list, create, delete
│   └── types.ts            Shared TS types (OfficeAgent, OfficeTeam, etc.)
│
├── scene/                  Three.js 3D scene
│   ├── office-scene.ts     Main scene: renderer, loop, agent sync
│   ├── character-manager.ts Character spawning, animation state machine
│   ├── platform-manager.ts Platform placement (agent desk + team platform)
│   ├── delegation-arc.ts   Animated arcs between delegating agents
│   ├── camera-controller.ts Orbit camera with drag + zoom
│   └── asset-loader.ts     GLTF model + animation loading
│
├── stores/
│   ├── use-office-store.ts Zustand store: snapshot, agents, wsCall, chat bridge
│   ├── office-state-machine.ts WS event → scene state machine
│   └── use-event-store.ts  Raw WS event log for the Events inspector
│
├── hooks/
│   ├── use-office-state.ts WS lifecycle: connect, event routing, chat bridge
│   └── use-api-agents.ts   REST agent polling (30s interval)
│
├── components/
│   ├── agent-chat-panel.tsx  Floating chat panel with session history
│   ├── hud.tsx               Gateway status / agent count HUD
│   ├── notification-panel.tsx Live event notifications + raw event inspector
│   ├── reconnect-banner.tsx  WS disconnect banner
│   └── agent-panel/          Agent Office modal (tabbed)
│       ├── agent-panel.tsx           Shell: Recruit / Connection / Teams tabs
│       ├── recruit-tab.tsx           Agent creation (predefined presets + open)
│       ├── agent-create-form.tsx     Agent create form
│       ├── connection-tab.tsx        Channel instance management
│       ├── channel-setup-form.tsx    Connect a channel (Telegram, Discord, etc.)
│       ├── channel-config-fields.tsx Per-channel approval/policy config fields
│       ├── teams-tab.tsx             Team list + create team form
│       ├── chat-history-panel.tsx    Session list for chat history navigation
│       ├── custom-select.tsx         Portal-based dark dropdown + model combobox
│       ├── add-provider-form.tsx     Add LLM provider
│       └── character-preview.tsx     Character thumbnail renderer
│
└── data/
    ├── agent-presets.ts    Predefined agent presets (character + system prompt)
    ├── channel-schemas.ts  Per-channel credential + config field definitions
    └── provider-types.ts   LLM provider type definitions
```

---

## How It Connects to GoClaw

```
Browser
  │
  ├─ WebSocket /ws ──► GoClaw WS RPC
  │    • connect (auth handshake)
  │    • chat.send / chat.history   (persistent chat sessions)
  │    • teams.list / teams.create / teams.delete
  │
  └─ HTTP /v1/* ───► GoClaw REST API
       • GET  /v1/agents            (agent list)
       • POST /v1/agents            (create agent)
       • GET  /v1/providers         (provider list)
       • POST /v1/channels/instances (connect channel)
       • ...
```

### WS Event → 3D State Flow

```
GoClaw WS events
  │
  ├─ agent (chunk/run.completed/run.failed) ──► chat panel streaming
  ├─ agent (state change) ──► OfficeStateMachine ──► character animation
  ├─ team.created ──► fetch teams.get ──► platform grouping
  ├─ delegation.started/completed ──► arc rendering
  └─ cache.invalidate ──► refresh agent/channel lists
```

### Chat Session Persistence

Chat history is stored in GoClaw's PostgreSQL database — not in-memory. On every panel open, the client loads the session history via `chat.history` WS RPC. Sessions are keyed by `agent:{agentId}:ws-{userId}-{timestamp}` and tracked in `localStorage` for navigation.

---

## Supported Channels

| Channel | Key | Notes |
|---|---|---|
| Telegram | `telegram` | Long polling; supports DM + group policy, pairing |
| Discord | `discord` | Bot token |
| Slack | `slack` | Bot + App-level tokens (Socket Mode) |
| Feishu / Lark | `feishu` | Webhook or WebSocket mode |
| Zalo OA | `zalo_oa` | OA access token |
| Zalo Personal | `zalo_personal` | QR auth (post-create wizard) |
| WhatsApp | `whatsapp` | Bridge URL |

---

## License

This project is part of the GoClaw ecosystem. See [LICENSE](LICENSE) for details.
