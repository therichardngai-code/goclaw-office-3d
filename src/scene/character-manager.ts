import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import {
  CHAR_MODELS,
  ANIM_GLB,
  WALK_SPEED,
  WANDER_RANGE,
  ARRIVE_DIST,
} from "./constants";
import { charIdx, hex6, stateHex, toAnimState, shortestAngle, resolvePlatform } from "./utils";
import type { AssetLoader } from "./asset-loader";
import type { PlatformManager } from "./platform-manager";
import type { OfficeAgent, OfficeTeam } from "@/api/types";

// Map agent state + speechBubble → display text for the overhead bubble
function formatBubble(state: string, speechBubble?: string): string {
  if (state === "idle" || state === "error") return "";

  if (speechBubble) {
    // "Using: skill_search" → "skill_search"
    if (speechBubble.startsWith("Using: ")) return speechBubble.slice(7);
    // Delegation / coordination text from backend — show as-is
    return speechBubble;
  }

  // Fallback labels when no speechBubble text yet
  switch (state) {
    case "thinking":    return "Thinking...";
    case "responding":  return "Responding...";
    case "tool_calling": return "Calling tool...";
    case "receiving":   return "Receiving...";
    default:            return "";
  }
}

interface AgentData {
  group: THREE.Group;
  placeholder: THREE.Mesh | null;
  nameLbl: CSS2DObject;
  bubble: CSS2DObject;
  data: OfficeAgent;
  staticMesh: THREE.Object3D | null;
  animMesh: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  animState: string | null;
  animGLBName: string | null;
  wanderX: number;
  wanderZ: number;
  wanderTargetX: number;
  wanderTargetZ: number;
  wanderRotY: number;
  talkingWith: string | null;
}

export class CharacterManager {
  private scene: THREE.Scene;
  private loader: AssetLoader;
  private map = new Map<string, AgentData>();

  constructor(scene: THREE.Scene, loader: AssetLoader) {
    this.scene = scene;
    this.loader = loader;
  }

  update(id: string, data: OfficeAgent): void {
    if (!this.map.has(id)) {
      this.spawn(id, data);
    }

    const a = this.map.get(id)!;

    // Detect character change — happens when the merged snapshot replaces the
    // UUID-keyed SSE agent with the correctly-keyed API agent (charIdx(key) vs
    // charIdx(UUID) differ). Clear cached meshes so the correct model loads.
    const prevCi = charIdx(a.data.name);
    const newCi = charIdx(data.name);
    if (prevCi !== newCi) {
      if (a.staticMesh) {
        a.group.remove(a.staticMesh);
        a.staticMesh = null;
      }
      if (a.animMesh) {
        if (a.mixer) { a.mixer.stopAllAction(); a.mixer = null; }
        a.group.remove(a.animMesh);
        a.animMesh = null;
      }
      a.animState = null;   // force applyAnim on next check
      a.animGLBName = null;
    }

    a.data = data;

    // Update name
    const nameSpan = a.nameLbl.element.querySelector("span");
    if (nameSpan) {
      nameSpan.textContent = data.displayName || data.name || id;
    }

    // Update status dot
    const dotEl = a.nameLbl.element.querySelector(".status-dot") as HTMLElement;
    if (dotEl) {
      const col = hex6(stateHex(data.state));
      dotEl.style.background = col;
      dotEl.style.color = col;
    }

    // Activity indicator
    const bubbleText = formatBubble(data.state, data.speechBubble);
    if (bubbleText) {
      a.bubble.element.textContent = bubbleText;
      a.bubble.element.style.display = "";
    } else {
      a.bubble.element.textContent = "";
      a.bubble.element.style.display = "none";
    }

    // Error tilt
    a.group.rotation.z = data.state === "error" ? 0.26 : 0;

    // Trigger anim state update
    const as = toAnimState(data.state, !!data.speechBubble);
    if (as !== a.animState) {
      // Play victory when transitioning from active → idle (task complete)
      const wasActive = a.animState === "working" || a.animState === "talking";
      if (as === "idle" && wasActive) {
        this.applyAnim(id, "victory");
      } else {
        this.applyAnim(id, as);
      }
    }
  }

  private spawn(id: string, data: OfficeAgent): void {
    const group = new THREE.Group();
    group.userData = { baseY: 0.15, t0: Math.random() * Math.PI * 2 };

    // Placeholder capsule
    const ph = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.7, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2a55 })
    );
    ph.position.y = 0.85;
    group.add(ph);

    // Name label with status dot
    const nameDiv = document.createElement("div");
    nameDiv.className = "agent-label";
    nameDiv.style.display = "flex";
    nameDiv.style.alignItems = "center";
    nameDiv.style.gap = "5px";
    nameDiv.style.fontSize = "0.8rem";
    nameDiv.style.fontWeight = "700";
    nameDiv.style.color = "#39ff14";
    nameDiv.style.whiteSpace = "nowrap";
    nameDiv.style.letterSpacing = "0.04em";
    nameDiv.style.textShadow = "0 0 8px #39ff14, 0 0 2px #000";

    const dotSpan = document.createElement("div");
    dotSpan.className = "status-dot";
    dotSpan.style.width = "8px";
    dotSpan.style.height = "8px";
    dotSpan.style.borderRadius = "50%";
    dotSpan.style.flexShrink = "0";
    dotSpan.style.background = hex6(stateHex(data.state));
    dotSpan.style.color = hex6(stateHex(data.state));
    dotSpan.style.boxShadow = `0 0 6px currentColor`;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = data.displayName || data.name || id;

    nameDiv.appendChild(dotSpan);
    nameDiv.appendChild(nameSpan);

    const nameLbl = new CSS2DObject(nameDiv);
    nameLbl.position.set(0, 2.2, 0);
    group.add(nameLbl);

    // Activity bubble
    const bubDiv = document.createElement("div");
    bubDiv.className = "speech-bubble";
    bubDiv.style.fontSize = "0.62rem";
    bubDiv.style.color = "#a0a8d0";
    bubDiv.style.whiteSpace = "nowrap";
    bubDiv.style.letterSpacing = "0.05em";
    bubDiv.style.textShadow = "0 0 6px rgba(120,120,255,0.5)";
    bubDiv.style.display = "none";

    const bubble = new CSS2DObject(bubDiv);
    bubble.position.set(0, 2.8, 0);
    group.add(bubble);

    this.scene.add(group);

    // Wander state
    const startX = (Math.random() - 0.5) * 0.7;
    const startZ = (Math.random() - 0.5) * 0.7;

    const obj: AgentData = {
      group,
      placeholder: ph,
      nameLbl,
      bubble,
      data,
      staticMesh: null,
      animMesh: null,
      mixer: null,
      animState: null,
      animGLBName: null,
      wanderX: startX,
      wanderZ: startZ,
      wanderTargetX: (Math.random() - 0.5) * 0.8,
      wanderTargetZ: (Math.random() - 0.5) * 0.8,
      wanderRotY: Math.random() * Math.PI * 2,
      talkingWith: null,
    };

    this.map.set(id, obj);
    this.applyAnim(id, toAnimState(data.state, !!data.speechBubble));
  }

  private async applyAnim(id: string, animState: string): Promise<void> {
    const a = this.map.get(id);
    if (!a) return;
    a.animState = animState;

    const ci = charIdx(a.data.name);
    const entry = ANIM_GLB[ci];
    const animName = entry
      ? (entry[animState as keyof typeof entry] ?? entry.idle ?? null)
      : null;

    if (animName !== null && animName === a.animGLBName) return;
    a.animGLBName = animName;

    if (!animName) {
      // Load static GLB
      if (!a.staticMesh) {
        try {
          const mdl = CHAR_MODELS[ci] ?? "character-male-a";
          const mesh = await this.loader.loadStatic(mdl);
          if (!this.map.has(id)) return;

          this.loader.normalizeHeight(mesh);
          mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              (child as THREE.Mesh).castShadow = true;
            }
          });

          if (a.placeholder) {
            a.group.remove(a.placeholder);
            a.placeholder.geometry.dispose();
            (a.placeholder.material as THREE.Material).dispose();
            a.placeholder = null;
          }

          a.group.add(mesh);
          a.staticMesh = mesh;
        } catch (err) {
          console.error("[office] static mesh error:", id, err);
        }
      }

      if (a.mixer) {
        a.mixer.stopAllAction();
        a.mixer = null;
      }
      if (a.animMesh) {
        a.group.remove(a.animMesh);
        a.animMesh = null;
      }
      return;
    }

    try {
      const { mesh, anims } = await this.loader.loadAnim(animName);
      if (!this.map.has(id) || a.animGLBName !== animName) return;

      mesh.scale.set(100, 100, 100);
      mesh.position.set(0, 0, 0);
      mesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).castShadow = true;
        }
      });

      if (a.placeholder) {
        a.group.remove(a.placeholder);
        a.placeholder.geometry.dispose();
        (a.placeholder.material as THREE.Material).dispose();
        a.placeholder = null;
      }

      if (a.mixer) {
        a.mixer.stopAllAction();
        a.mixer = null;
      }
      if (a.animMesh) {
        a.group.remove(a.animMesh);
        a.animMesh = null;
      }

      if (a.staticMesh) {
        a.staticMesh.visible = false;
      }

      this.loader.applyColormap(mesh);
      a.group.add(mesh);
      a.animMesh = mesh;

      if (anims.length > 0 && anims[0]) {
        a.mixer = new THREE.AnimationMixer(mesh);
        const clip = anims[0];
        const cleanTracks = clip.tracks.filter(
          (t) => !(t.name.includes("Hips") && t.name.includes(".position"))
        );
        const cleanClip = new THREE.AnimationClip(
          clip.name,
          clip.duration,
          cleanTracks
        );
        const action = a.mixer.clipAction(cleanClip);

        if (animState === "victory") {
          // Play once then fall back to idle
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          a.mixer.addEventListener("finished", () => {
            if (this.map.has(id) && a.animState === "victory") {
              this.applyAnim(id, "idle");
            }
          });
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity);
        }
        action.play();
      }
    } catch (err) {
      console.error("[office] anim GLB error:", id, animName, err);
    }
  }

  reposition(
    teams: Record<string, OfficeTeam>,
    platMgr: PlatformManager
  ): void {
    const byPlat = new Map<string, string[]>();

    for (const [id, a] of this.map) {
      const k = resolvePlatform(a.data, teams);
      if (!byPlat.has(k)) byPlat.set(k, []);
      byPlat.get(k)!.push(id);
    }

    for (const [k, ids] of byPlat) {
      ids.forEach((id, i) => {
        const a = this.map.get(id);
        if (!a) return;
        const pos = platMgr.slotPos(k, i, ids.length);
        a.group.position.copy(pos);
        a.group.userData.baseY = pos.y;
      });
    }
  }

  tick(delta: number, elapsed: number): void {
    for (const a of this.map.values()) {
      if (a.mixer) {
        a.mixer.update(delta);

        if (a.animMesh && (a.animState === "working" || a.animState === "talking")) {
          if (a.talkingWith) {
            const other = this.map.get(a.talkingWith);
            if (other) {
              const toX =
                other.group.position.x +
                other.wanderX -
                (a.group.position.x + a.wanderX);
              const toZ =
                other.group.position.z +
                other.wanderZ -
                (a.group.position.z + a.wanderZ);
              const toLen = Math.sqrt(toX * toX + toZ * toZ);

              if (toLen > 0.01) {
                a.wanderTargetX = (toX / toLen) * WANDER_RANGE;
                a.wanderTargetZ = (toZ / toLen) * WANDER_RANGE;
                const faceRot = Math.atan2(toX, toZ);
                a.wanderRotY += shortestAngle(a.wanderRotY, faceRot) * 0.15;
              }
            }
          }

          const dx = a.wanderTargetX - a.wanderX;
          const dz = a.wanderTargetZ - a.wanderZ;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (!a.talkingWith && dist < ARRIVE_DIST) {
            a.wanderTargetX = (Math.random() - 0.5) * WANDER_RANGE * 2;
            a.wanderTargetZ = (Math.random() - 0.5) * WANDER_RANGE * 2;
          } else if (dist >= ARRIVE_DIST) {
            const step = Math.min(WALK_SPEED * delta, dist);
            a.wanderX += (dx / dist) * step;
            a.wanderZ += (dz / dist) * step;

            if (!a.talkingWith) {
              const targetRotY = Math.atan2(dx, dz);
              a.wanderRotY += shortestAngle(a.wanderRotY, targetRotY) * 0.12;
            }
          }

          a.animMesh.position.set(a.wanderX, 0, a.wanderZ);
          a.animMesh.rotation.set(0, a.wanderRotY, 0);
        }
      }

      // Subtle Y-float hover
      const g = a.group;
      const ud = g.userData as { baseY: number; t0: number };
      g.position.y = ud.baseY + Math.sin(elapsed * 1.4 + ud.t0) * 0.03;
    }
  }

  setTalking(idA: string, idB: string): void {
    const a = this.map.get(idA);
    const b = this.map.get(idB);
    if (a) a.talkingWith = idB;
    if (b) b.talkingWith = idA;
  }

  clearTalking(idA: string, idB: string): void {
    const a = this.map.get(idA);
    const b = this.map.get(idB);
    if (a) {
      a.talkingWith = null;
      a.wanderTargetX = (Math.random() - 0.5) * WANDER_RANGE * 2;
      a.wanderTargetZ = (Math.random() - 0.5) * WANDER_RANGE * 2;
    }
    if (b) {
      b.talkingWith = null;
      b.wanderTargetX = (Math.random() - 0.5) * WANDER_RANGE * 2;
      b.wanderTargetZ = (Math.random() - 0.5) * WANDER_RANGE * 2;
    }
  }

  remove(id: string): void {
    const a = this.map.get(id);
    if (!a) return;

    if (a.mixer) a.mixer.stopAllAction();
    this.scene.remove(a.group);
    this.map.delete(id);
  }

  pos(id: string): THREE.Vector3 | null {
    return this.map.get(id)?.group.position.clone() ?? null;
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  keys(): IterableIterator<string> {
    return this.map.keys();
  }
}
