// Scene constants matching the original renderer

export const ASSET_BASE = "/assets";

export const CHAN_COLOR: Record<string, number> = {
  telegram: 0x2aabee,
  discord: 0x5865f2,
  whatsapp: 0x25d366,
  feishu: 0x00b0f0,
  zalo: 0xff3333,
  zalo_personal: 0xff3333,
  direct: 0xff6600,
  system: 0xff6600,
  team: 0xffd700,
  idle: 0x334466,
};

export const CHAN_ICON: Record<string, string> = {
  telegram: "T",
  discord: "D",
  whatsapp: "W",
  feishu: "F",
  zalo: "Z",
  zalo_personal: "Z",
  direct: "X",
  system: "X",
  team: "T",
  idle: "H",
};

export const CHAR_MODELS = [
  "character-female-a",
  "character-female-b",
  "character-female-c",
  "character-female-d",
  "character-female-e",
  "character-female-f",
  "character-male-a",
  "character-male-b",
  "character-male-c",
  "character-male-d",
  "character-male-e",
  "character-male-f",
  "character-employee",
  "character-gamer",
];

// Per-character animated GLB names.
// States:
//   idle     → Dwarf Idle / Warrior Idle  (agent is waiting)
//   working  → Punching / Speedbag        (agent is thinking or using tools)
//   talking  → Talking                    (agent is responding or receiving a task)
//   victory  → Victory Idle              (agent just completed a task)
//   walking  → Walking                   (kept for wander motion; same as before)
export const ANIM_GLB: Array<{
  idle: string | null;
  working: string | null;
  talking: string | null;
  victory: string | null;
  walking: string | null;
}> = [
  // 0 female-a
  { idle: "anim-female-a-idle",     working: "anim-female-a-working",  talking: "anim-female-a-talking",  victory: "anim-female-a-victory",  walking: "anim-female-a-walking" },
  // 1 female-b (no source FBX — share female-a)
  { idle: "anim-female-a-idle",     working: "anim-female-a-working",  talking: "anim-female-a-talking",  victory: "anim-female-a-victory",  walking: "anim-female-a-walking" },
  // 2 female-c
  { idle: "anim-female-c-idle",     working: "anim-female-c-working",  talking: "anim-female-c-talking",  victory: "anim-female-c-victory",  walking: "anim-female-c-walking" },
  // 3 female-d
  { idle: "anim-female-d-idle",     working: "anim-female-d-working",  talking: "anim-female-d-talking",  victory: "anim-female-d-victory",  walking: "anim-female-d-walking" },
  // 4 female-e (Speedbag for working, no Punching)
  { idle: "anim-female-e-idle",     working: "anim-female-e-working",  talking: "anim-female-e-talking",  victory: "anim-female-e-victory",  walking: "anim-female-e-walking" },
  // 5 female-f
  { idle: "anim-female-f-idle",     working: "anim-female-f-working",  talking: "anim-female-f-talking",  victory: "anim-female-f-victory",  walking: "anim-female-f-walking" },
  // 6 male-a (Warrior Idle)
  { idle: "anim-male-a-idle",       working: "anim-male-a-working",    talking: "anim-male-a-talking",    victory: "anim-male-a-victory",    walking: "anim-male-a-walking" },
  // 7 male-b
  { idle: "anim-male-b-idle",       working: "anim-male-b-working",    talking: "anim-male-b-talking",    victory: "anim-male-b-victory",    walking: "anim-male-b-walking" },
  // 8 male-c
  { idle: "anim-male-c-idle",       working: "anim-male-c-working",    talking: "anim-male-c-talking",    victory: "anim-male-c-victory",    walking: "anim-male-c-walking" },
  // 9 male-d (Warrior Idle)
  { idle: "anim-male-d-idle",       working: "anim-male-d-working",    talking: "anim-male-d-talking",    victory: "anim-male-d-victory",    walking: "anim-male-d-walking" },
  // 10 male-e (Warrior Idle)
  { idle: "anim-male-e-idle",       working: "anim-male-e-working",    talking: "anim-male-e-talking",    victory: "anim-male-e-victory",    walking: "anim-male-e-walking" },
  // 11 male-f
  { idle: "anim-male-f-idle",       working: "anim-male-f-working",    talking: "anim-male-f-talking",    victory: "anim-male-f-victory",    walking: "anim-male-f-walking" },
  // 12 employee
  { idle: "anim-employee-idle",     working: "anim-employee-working",  talking: "anim-employee-talking",  victory: "anim-employee-victory",  walking: "anim-employee-walking" },
  // 13 gamer
  { idle: "anim-gamer-idle",        working: "anim-gamer-working",     talking: "anim-gamer-talking",     victory: "anim-gamer-victory",     walking: "anim-gamer-walking" },
];

// Platform slot Y offsets — space-station has 2 elevated stone layers
export const HOME_SLOT_Y = 1.0;  // upper deck of space-station
export const DEFAULT_SLOT_Y = 0.15;

// Platform room Y rotation (radians) — camera sits at PI/4 (45°) from +Z toward +X
// Tune these so each room's entrance faces the camera
export const HOME_ROTATION_Y = Math.PI / 2;      // space-station
export const ROOM_ROTATION_Y = -Math.PI / 2;     // arcade-full / mini-market-full

// Movement constants
export const WALK_SPEED = 0.35;
export const WANDER_RANGE = 0.45;
export const ARRIVE_DIST = 0.08;
export const HANDSHAKE_MS = 3000;

// Camera constants
export const CAM_RADIUS = Math.sqrt(12 * 12 + 12 * 12);
export const CAM_HEIGHT = 10;

// State colors
export const STATE_HEX: Record<string, number> = {
  idle: 0x666688,
  thinking: 0x4488ff,
  responding: 0x44ff88,
  tool_calling: 0xffaa00,
  error: 0xff3333,
};
