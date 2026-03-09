import * as THREE from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { OfficeSnapshot } from "@/api/types";
import { AssetLoader } from "./asset-loader";
import { CameraController } from "./camera-controller";
import { PlatformManager } from "./platform-manager";
import { CharacterManager } from "./character-manager";
import { DelegationArcManager } from "./delegation-arc";
import { resolvePlatform } from "./utils";

export class OfficeScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private css2dRenderer: CSS2DRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private clock: THREE.Clock | null = null;
  private animationId: number | null = null;

  private loader: AssetLoader | null = null;
  private camCtrl: CameraController | null = null;
  private platMgr: PlatformManager | null = null;
  private charMgr: CharacterManager | null = null;
  private arcMgr: DelegationArcManager | null = null;

  private layoutDirty = false;

  init(container: HTMLDivElement): void {
    // WebGL Renderer — let Three.js create its own canvas (matches original renderer)
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x06060f);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    container.appendChild(this.renderer.domElement);

    // CSS2D Renderer for labels
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.setSize(window.innerWidth, window.innerHeight);
    this.css2dRenderer.domElement.style.position = "absolute";
    this.css2dRenderer.domElement.style.top = "0";
    this.css2dRenderer.domElement.style.left = "0";
    this.css2dRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(this.css2dRenderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = this.makeSpaceBackground();

    // Clock
    this.clock = new THREE.Clock();

    // Camera
    this.camCtrl = new CameraController(this.renderer);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xc8d0ff, 1.8));

    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(8, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 80;
    key.shadow.camera.left = key.shadow.camera.bottom = -22;
    key.shadow.camera.right = key.shadow.camera.top = 22;
    key.shadow.bias = -0.002;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffe8c0, 1.2);
    fill.position.set(-6, 6, -4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0x6666ff, 0.8);
    rim.position.set(0, -4, -8);
    this.scene.add(rim);

    // Managers
    this.loader = new AssetLoader();
    this.platMgr = new PlatformManager(this.scene, this.loader);
    this.charMgr = new CharacterManager(this.scene, this.loader);
    this.arcMgr = new DelegationArcManager(this.scene);

    // Handle resize
    window.addEventListener("resize", this.handleResize);

    // Start render loop
    this.animate();
  }

  private makeSpaceBackground(): THREE.CanvasTexture {
    const W = 1024;
    const H = 768;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d")!;

    // Base
    ctx.fillStyle = "#06060f";
    ctx.fillRect(0, 0, W, H);

    // Teal nebula
    const teal = ctx.createRadialGradient(
      W * 0.38,
      H * 0.58,
      0,
      W * 0.38,
      H * 0.58,
      W * 0.52
    );
    teal.addColorStop(0, "rgba(0,90,90,0.40)");
    teal.addColorStop(0.6, "rgba(0,40,60,0.18)");
    teal.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = teal;
    ctx.fillRect(0, 0, W, H);

    // Red-brown glow
    const red = ctx.createRadialGradient(
      W * 0.82,
      H * 0.18,
      0,
      W * 0.82,
      H * 0.18,
      W * 0.42
    );
    red.addColorStop(0, "rgba(90,22,10,0.45)");
    red.addColorStop(0.5, "rgba(50,10,5,0.20)");
    red.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.4 + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,215,255,${(Math.random() * 0.6 + 0.2).toFixed(2)})`;
      ctx.fill();
    }

    return new THREE.CanvasTexture(cv);
  }

  private handleResize = (): void => {
    if (!this.renderer || !this.css2dRenderer || !this.camCtrl) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.css2dRenderer.setSize(window.innerWidth, window.innerHeight);
    this.camCtrl.onResize();
  };

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (!this.renderer || !this.scene || !this.camCtrl || !this.clock) return;

    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    if (this.charMgr) {
      this.charMgr.tick(delta, elapsed);
    }

    if (this.arcMgr && this.charMgr) {
      this.arcMgr.tick(delta, this.charMgr);
    }

    this.renderer.render(this.scene, this.camCtrl.camera);
    this.css2dRenderer?.render(this.scene, this.camCtrl.camera);
  };

  update(snapshot: OfficeSnapshot): void {
    if (!this.platMgr || !this.charMgr || !this.arcMgr || !this.camCtrl) return;

    const agentMap = snapshot.agents || {};
    const teams = snapshot.teams || {};
    const delegations = snapshot.activeDelegations || [];

    // Determine needed platforms
    const needed = new Set(["idle"]);
    for (const a of Object.values(agentMap)) {
      needed.add(resolvePlatform(a, teams));
    }
    for (const tid of Object.keys(teams)) {
      needed.add(`team:${tid}`);
    }

    // Reconcile platforms
    for (const k of [...this.platMgr.keys()]) {
      if (!needed.has(k)) {
        this.platMgr.remove(k);
        this.layoutDirty = true;
      }
    }
    for (const k of needed) {
      if (!this.platMgr.has(k)) {
        this.platMgr.create(k, teams);
        this.layoutDirty = true;
      }
    }

    // Reconcile agents
    const agentIds = new Set(Object.keys(agentMap));
    for (const id of [...this.charMgr.keys()]) {
      if (!agentIds.has(id)) {
        this.charMgr.remove(id);
        this.layoutDirty = true;
      }
    }
    for (const [id, a] of Object.entries(agentMap)) {
      if (!this.charMgr.has(id)) {
        this.layoutDirty = true;
      }
      this.charMgr.update(id, a);
    }

    // Layout if dirty
    if (this.layoutDirty) {
      this.platMgr.layout(this.camCtrl);
      this.layoutDirty = false;
    }

    // Reposition agents on platforms
    this.charMgr.reposition(teams, this.platMgr);

    // Update delegation arcs
    this.arcMgr.update(
      delegations,
      (id) => this.charMgr!.pos(id),
      this.charMgr
    );
  }

  // Camera control methods (called from React)
  zoomIn(): void {
    this.camCtrl?.zoomIn();
  }

  zoomOut(): void {
    this.camCtrl?.zoomOut();
  }

  rotateLeft(): void {
    this.camCtrl?.rotateLeft();
  }

  rotateRight(): void {
    this.camCtrl?.rotateRight();
  }

  resetCamera(): void {
    if (this.platMgr && this.camCtrl) {
      this.platMgr.layout(this.camCtrl);
    }
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.renderer?.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }

    if (this.css2dRenderer?.domElement.parentElement) {
      this.css2dRenderer.domElement.parentElement.removeChild(
        this.css2dRenderer.domElement
      );
    }

    this.renderer?.dispose();
    this.scene?.clear();

    this.renderer = null;
    this.css2dRenderer = null;
    this.scene = null;
    this.clock = null;
    this.camCtrl = null;
    this.platMgr = null;
    this.charMgr = null;
    this.arcMgr = null;
    this.loader = null;
  }
}
