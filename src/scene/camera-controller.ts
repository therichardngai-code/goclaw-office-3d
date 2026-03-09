import * as THREE from "three";
import { CAM_RADIUS, CAM_HEIGHT } from "./constants";

export interface CameraState {
  target: THREE.Vector3;
  angle: number;
  frustumHalf: number;
}

export class CameraController {
  camera: THREE.OrthographicCamera;
  state: CameraState;
  private renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const asp = window.innerWidth / window.innerHeight;
    const fs = 16;

    this.camera = new THREE.OrthographicCamera(
      (-fs * asp) / 2,
      (fs * asp) / 2,
      fs / 2,
      -fs / 2,
      0.1,
      300
    );
    this.camera.position.set(12, 10, 12);
    this.camera.lookAt(0, 0, 0);

    this.state = {
      target: new THREE.Vector3(0, 0, 0),
      angle: Math.PI / 4,
      frustumHalf: fs,
    };

    this.initMouseControls();
  }

  apply(): void {
    const asp = window.innerWidth / window.innerHeight;
    const { target, angle, frustumHalf } = this.state;

    this.camera.position.set(
      target.x + Math.cos(angle) * CAM_RADIUS,
      CAM_HEIGHT,
      target.z + Math.sin(angle) * CAM_RADIUS
    );
    this.camera.lookAt(target);
    this.camera.left = (-frustumHalf * asp) / 2;
    this.camera.right = (frustumHalf * asp) / 2;
    this.camera.top = frustumHalf / 2;
    this.camera.bottom = -frustumHalf / 2;
    this.camera.updateProjectionMatrix();
  }

  zoomIn(): void {
    this.state.frustumHalf = Math.max(4, this.state.frustumHalf * 0.8);
    this.apply();
  }

  zoomOut(): void {
    this.state.frustumHalf = Math.min(120, this.state.frustumHalf * 1.25);
    this.apply();
  }

  rotateLeft(): void {
    this.state.angle -= Math.PI / 8;
    this.apply();
  }

  rotateRight(): void {
    this.state.angle += Math.PI / 8;
    this.apply();
  }

  fitToScene(
    platforms: Array<{
      position: THREE.Vector3;
      width: number;
      depth: number;
    }>
  ): void {
    if (!platforms.length) return;

    let x0 = Infinity,
      x1 = -Infinity,
      z0 = Infinity,
      z1 = -Infinity;

    for (const p of platforms) {
      x0 = Math.min(x0, p.position.x - p.width / 2);
      x1 = Math.max(x1, p.position.x + p.width / 2);
      z0 = Math.min(z0, p.position.z - p.depth / 2);
      z1 = Math.max(z1, p.position.z + p.depth / 2);
    }

    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const span = Math.max(x1 - x0 + 8, z1 - z0 + 8);
    const asp = window.innerWidth / window.innerHeight;
    const fs = Math.max(span / asp, span) * 0.65;

    this.state.target.set(cx, 0, cz);
    this.state.angle = Math.PI / 4;
    this.state.frustumHalf = fs;
    this.apply();
  }

  onResize(): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const asp = W / H;
    const half = (this.camera.top - this.camera.bottom) / 2;
    this.camera.left = -half * asp;
    this.camera.right = half * asp;
    this.camera.updateProjectionMatrix();
  }

  private initMouseControls(): void {
    let dragging = false;
    let lx = 0;
    let ly = 0;
    const domElement = this.renderer.domElement;

    domElement.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      domElement.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;

      const scale = (this.state.frustumHalf * 2) / window.innerHeight;
      const a = this.state.angle;
      this.state.target.x += (-dx * Math.sin(a) + dy * Math.cos(a)) * scale;
      this.state.target.z += (dx * Math.cos(a) + dy * Math.sin(a)) * scale;
      this.apply();
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
      domElement.style.cursor = "grab";
    });

    domElement.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.1 : 0.9;
        this.state.frustumHalf = Math.max(
          4,
          Math.min(120, this.state.frustumHalf * factor)
        );
        this.apply();
      },
      { passive: false }
    );

    domElement.style.cursor = "grab";
  }
}
