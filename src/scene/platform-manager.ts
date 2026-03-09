import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { ASSET_BASE, CHAN_COLOR } from "./constants";
import { cap, hex6 } from "./utils";
import { HOME_SLOT_Y, DEFAULT_SLOT_Y, HOME_ROTATION_Y, ROOM_ROTATION_Y } from "./constants";
import type { AssetLoader } from "./asset-loader";
import type { CameraController } from "./camera-controller";

interface PlatformData {
  group: THREE.Group;
  width: number;
  depth: number;
  color: number;
}

export class PlatformManager {
  private scene: THREE.Scene;
  private loader: AssetLoader;
  private map = new Map<string, PlatformData>();

  // Full room GLBs — space-station (Home) + arcade/mini-market (other platforms)
  private homeGLB: THREE.Object3D | null = null;
  private roomGLBs: Array<THREE.Object3D | null> = [null, null]; // [arcade-full, mini-market-full]
  private roomPending: Array<[THREE.Group, number, number, number, string]> = [];

  constructor(scene: THREE.Scene, loader: AssetLoader) {
    this.scene = scene;
    this.loader = loader;
    this.loadRooms();
  }

  private async loadRooms(): Promise<void> {
    const [homeResult, ...roomResults] = await Promise.allSettled([
      this.loader.loadGLTF(`${ASSET_BASE}/platform/space-station.glb`),
      this.loader.loadGLTF(`${ASSET_BASE}/platform/arcade-full.glb`),
      this.loader.loadGLTF(`${ASSET_BASE}/platform/mini-market-full.glb`),
    ]);

    if (homeResult.status === "fulfilled") {
      this.homeGLB = homeResult.value.scene;
    } else {
      console.warn("[office] space-station.glb failed:", homeResult.reason);
    }

    roomResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        this.roomGLBs[i] = result.value.scene;
      } else {
        console.warn("[office] room GLB failed index", i, result.reason);
      }
    });

    // Flush platforms created before GLBs finished loading
    for (const args of this.roomPending) {
      this.addRoom(...args);
    }
    this.roomPending = [];
  }

  create(key: string, teams: Record<string, { name?: string }>): void {
    let color: number = CHAN_COLOR.idle ?? 0x334466;
    let name = "Home";

    if (key.startsWith("team:")) {
      const t = teams[key.slice(5)];
      color = CHAN_COLOR.team ?? 0xffd700;
      name = t?.name || "Team";
    } else if (key !== "idle") {
      const chanColor = CHAN_COLOR[key];
      if (chanColor !== undefined) {
        color = chanColor;
        name = cap(key);
      }
    }

    const W = 5.5;
    const D = 4.5;
    const hw = W / 2;
    const hd = D / 2;
    const group = new THREE.Group();

    // Neon border
    const y = 0.01;
    const pts = [
      new THREE.Vector3(-hw, y, -hd),
      new THREE.Vector3(hw, y, -hd),
      new THREE.Vector3(hw, y, hd),
      new THREE.Vector3(-hw, y, hd),
      new THREE.Vector3(-hw, y, -hd),
    ];
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color })
      )
    );

    // Platform label
    const div = document.createElement("div");
    div.className = "platform-label";
    div.textContent = name;
    div.style.color = hex6(color);
    div.style.fontSize = "0.72rem";
    div.style.fontWeight = "600";
    div.style.letterSpacing = "0.08em";
    div.style.padding = "3px 10px";
    div.style.background = "#05050fcc";
    div.style.borderRadius = "12px";
    div.style.border = `1px solid ${hex6(color)}`;
    div.style.whiteSpace = "nowrap";
    div.style.textShadow = `0 0 8px ${hex6(color)}`;
    const lbl = new CSS2DObject(div);
    lbl.position.set(-hw + 0.3, 0, hd + 0.3);
    group.add(lbl);

    // Full room decoration
    const isHome = key === "idle";
    const roomReady = isHome ? this.homeGLB !== null : this.roomGLBs.some(Boolean);
    if (roomReady) {
      this.addRoom(group, color, W, D, key);
    } else {
      this.roomPending.push([group, color, W, D, key]);
    }

    this.scene.add(group);
    this.map.set(key, { group, width: W, depth: D, color });
  }

  remove(key: string): void {
    const p = this.map.get(key);
    if (!p) return;

    this.scene.remove(p.group);
    p.group.traverse((o) => {
      // Check for CSS2DObject by checking for element property
      const css2dObj = o as CSS2DObject & { isCSS2DObject?: boolean };
      if (css2dObj.element && css2dObj.element.parentNode) {
        css2dObj.element.parentNode.removeChild(css2dObj.element);
      }
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.map.delete(key);
  }

  layout(camCtrl: CameraController): void {
    const list = [...this.map.values()];
    if (!list.length || !list[0]) return;

    const first = list[0];
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
    const gX = 3.5;
    const gZ = 3.5;
    const stepX = first.width + gX;
    const stepZ = first.depth + gZ;
    const offX = ((cols - 1) * stepX) / 2;

    list.forEach((p, i) => {
      p.group.position.set(
        (i % cols) * stepX - offX,
        0,
        Math.floor(i / cols) * stepZ
      );
    });

    camCtrl.fitToScene(
      list.map((p) => ({
        position: p.group.position,
        width: p.width,
        depth: p.depth,
      }))
    );
  }

  slotPos(key: string, slot: number, total: number): THREE.Vector3 {
    const p = this.map.get(key);
    if (!p) return new THREE.Vector3();

    const perRow = Math.min(4, Math.max(1, total));
    const col = slot % perRow;
    const row = Math.floor(slot / perRow);
    const rows = Math.ceil(total / perRow);
    const baseY = key === "idle" ? HOME_SLOT_Y : DEFAULT_SLOT_Y;

    return p.group.position.clone().add(
      new THREE.Vector3(
        (col - (perRow - 1) / 2) * 1.3,
        baseY,
        row * 1.3 - (rows - 1) * 0.65
      )
    );
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  keys(): IterableIterator<string> {
    return this.map.keys();
  }

  private addRoom(
    g: THREE.Group,
    color: number,
    _W: number,
    _D: number,
    key: string
  ): void {
    let src: THREE.Object3D | null;

    if (key === "idle") {
      // Home platform always uses space-station
      src = this.homeGLB;
    } else {
      // Other platforms: deterministic pick from available room GLBs
      const available = this.roomGLBs.filter(Boolean) as THREE.Object3D[];
      if (!available.length) return;
      let h = 0;
      for (let i = 0; i < key.length; i++) {
        h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
      }
      src = available[Math.abs(h) % available.length] ?? null;
    }

    if (!src) return;

    const mesh = SkeletonUtils.clone(src);

    // Rotation to face isometric camera (PI/4 from +Z toward +X)
    mesh.rotation.y = key === "idle" ? HOME_ROTATION_Y : ROOM_ROTATION_Y;

    // Native scale (100%) — sit on y=0
    const box = new THREE.Box3().setFromObject(mesh);
    mesh.position.y = -box.min.y;

    // Subtle zone color tint
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        const mat = ((m.material as THREE.Material).clone()) as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(color);
        mat.emissiveIntensity = 0.1;
        mat.needsUpdate = true;
        m.material = mat;
      }
    });

    g.add(mesh);
  }
}
