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
// Only list GLB files that physically exist in public/assets/characters/animated/.
// Missing states fall back: entry[state] ?? entry.idle ?? null (static mesh).
export const ANIM_GLB: Array<{
  idle: string | null;
  working: string | null;
  talking: string | null;
  victory: string | null;
  walking: string | null;
}> = [
  // 0 female-a — has: idle, walking, talking
  { idle: "anim-female-a-idle",  working: null, talking: "anim-female-a-talking", victory: null, walking: "anim-female-a-walking" },
  // 1 female-b — no own GLBs; share female-a
  { idle: "anim-female-a-idle",  working: null, talking: "anim-female-a-talking", victory: null, walking: "anim-female-a-walking" },
  // 2 female-c — has: idle, walking
  { idle: "anim-female-c-idle",  working: null, talking: null, victory: null, walking: "anim-female-c-walking" },
  // 3 female-d — has: idle, walking
  { idle: "anim-female-d-idle",  working: null, talking: null, victory: null, walking: "anim-female-d-walking" },
  // 4 female-e — no own animated GLBs; share female-d (same rig)
  { idle: "anim-female-d-idle", working: null, talking: null, victory: null, walking: "anim-female-d-walking" },
  // 5 female-f — no own animated GLBs; share female-a (same rig)
  { idle: "anim-female-a-idle", working: null, talking: "anim-female-a-talking", victory: null, walking: "anim-female-a-walking" },
  // 6 male-a — has: idle, walking
  { idle: "anim-male-a-idle",    working: null, talking: null, victory: null, walking: "anim-male-a-walking" },
  // 7 male-b — has: idle, walking
  { idle: "anim-male-b-idle",    working: null, talking: null, victory: null, walking: "anim-male-b-walking" },
  // 8 male-c — has: idle, walking, talking
  { idle: "anim-male-c-idle",    working: null, talking: "anim-male-c-talking", victory: null, walking: "anim-male-c-walking" },
  // 9 male-d — has: idle, walking
  { idle: "anim-male-d-idle",    working: null, talking: null, victory: null, walking: "anim-male-d-walking" },
  // 10 male-e — has: idle, walking
  { idle: "anim-male-e-idle",    working: null, talking: null, victory: null, walking: "anim-male-e-walking" },
  // 11 male-f — has: idle, walking
  { idle: "anim-male-f-idle",    working: null, talking: null, victory: null, walking: "anim-male-f-walking" },
  // 12 employee — has: idle, walking
  { idle: "anim-employee-idle",  working: null, talking: null, victory: null, walking: "anim-employee-walking" },
  // 13 gamer — has: idle, walking
  { idle: "anim-gamer-idle",     working: null, talking: null, victory: null, walking: "anim-gamer-walking" },
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
