import * as THREE from "three";
import { HANDSHAKE_MS } from "./constants";
import type { CharacterManager } from "./character-manager";

interface ArcData {
  line: THREE.Line;
  color: number;
  handshaking: boolean;
  startedMs: number;
  sourceId: string;
  targetId: string;
}

export class DelegationArcManager {
  private scene: THREE.Scene;
  private map = new Map<string, ArcData>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  update(
    delegations: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      status: string;
      mode: string;
      startedAt?: string;
    }>,
    getAgentPos: (id: string) => THREE.Vector3 | null,
    charMgr: CharacterManager
  ): void {
    const live = new Set<string>();

    for (const d of delegations) {
      // Handle accumulated status (dim the arc)
      if (d.status === "accumulated") {
        const existing = this.map.get(d.id);
        if (existing) {
          // Dim the arc by reducing opacity
          (existing.line.material as THREE.LineBasicMaterial).opacity = 0.3;
          (existing.line.material as THREE.LineBasicMaterial).transparent = true;
          live.add(d.id);
        }
        continue;
      }

      if (d.status !== "running") {
        this.remove(d.id, charMgr);
        continue;
      }

      live.add(d.id);
      const from = getAgentPos(d.sourceId);
      const to = getAgentPos(d.targetId);
      if (!from || !to) continue;

      if (this.map.has(d.id)) {
        this.updateArc(d.id, from, to);
      } else {
        const startedMs = d.startedAt ? Date.parse(d.startedAt) : Date.now();
        this.addArc(
          d.id,
          from,
          to,
          d.mode,
          startedMs,
          d.sourceId,
          d.targetId,
          charMgr
        );
      }
    }

    // Remove arcs no longer in delegations
    for (const id of [...this.map.keys()]) {
      if (!live.has(id)) this.remove(id, charMgr);
    }
  }

  tick(delta: number, charMgr: CharacterManager): void {
    const now = Date.now();
    for (const a of this.map.values()) {
      if (!a.handshaking) continue;

      if (now - a.startedMs >= HANDSHAKE_MS) {
        // Handshake over - swap to solid material
        const mat = a.line.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
        a.line.material = new THREE.LineBasicMaterial({ color: a.color });
        a.handshaking = false;
        charMgr.clearTalking(a.sourceId, a.targetId);
      } else {
        // March the dashes - cast to any for dashOffset (Three.js types issue)
        const mat = a.line.material as THREE.LineDashedMaterial & { dashOffset: number };
        mat.dashOffset = (mat.dashOffset ?? 0) - delta * 3;
      }
    }
  }

  private curve(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += 3.5;
    return new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(32);
  }

  private addArc(
    id: string,
    from: THREE.Vector3,
    to: THREE.Vector3,
    mode: string,
    startedMs: number,
    sourceId: string,
    targetId: string,
    charMgr: CharacterManager
  ): void {
    const color = mode === "async" ? 0xc084fc : 0xa855f7;
    const age = Date.now() - startedMs;
    const handshaking = age < HANDSHAKE_MS;

    let mat: THREE.Material;
    if (handshaking) {
      mat = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.4,
        gapSize: 0.2,
      });
      charMgr.setTalking(sourceId, targetId);
    } else {
      mat = new THREE.LineBasicMaterial({ color });
    }

    const geo = new THREE.BufferGeometry().setFromPoints(this.curve(from, to));
    const line = new THREE.Line(geo, mat);
    if (handshaking) line.computeLineDistances();

    this.scene.add(line);
    this.map.set(id, {
      line,
      color,
      handshaking,
      startedMs,
      sourceId,
      targetId,
    });
  }

  private updateArc(id: string, from: THREE.Vector3, to: THREE.Vector3): void {
    const a = this.map.get(id);
    if (!a) return;
    a.line.geometry.setFromPoints(this.curve(from, to));
    if (a.handshaking) a.line.computeLineDistances();
  }

  private remove(id: string, charMgr: CharacterManager): void {
    const a = this.map.get(id);
    if (!a) return;

    if (a.handshaking) {
      charMgr.clearTalking(a.sourceId, a.targetId);
    }

    this.scene.remove(a.line);
    a.line.geometry.dispose();
    (a.line.material as THREE.Material).dispose();
    this.map.delete(id);
  }
}
