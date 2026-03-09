import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { ASSET_BASE } from "./constants";

export class AssetLoader {
  private loader: GLTFLoader;
  private staticCache = new Map<string, THREE.Object3D>();
  private animCache = new Map<
    string,
    { scene: THREE.Object3D; anims: THREE.AnimationClip[] }
  >();
  private textureLoader = new THREE.TextureLoader();
  private textureCache = new Map<string, THREE.Texture>();

  // Pre-loaded colormap for characters
  colormap: THREE.Texture;

  constructor() {
    this.loader = new GLTFLoader();
    this.colormap = this.loadTexture(
      `${ASSET_BASE}/characters/Textures/colormap.png`
    );
  }

  loadTexture(path: string, flipY = false): THREE.Texture {
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path)!;
    }
    const tex = this.textureLoader.load(path);
    tex.flipY = flipY;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textureCache.set(path, tex);
    return tex;
  }

  async loadStatic(modelName: string): Promise<THREE.Object3D> {
    if (this.staticCache.has(modelName)) {
      return SkeletonUtils.clone(this.staticCache.get(modelName)!);
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        `${ASSET_BASE}/characters/${modelName}.glb`,
        (gltf: GLTF) => {
          this.staticCache.set(modelName, gltf.scene);
          resolve(SkeletonUtils.clone(gltf.scene));
        },
        undefined,
        (err) => {
          console.error("[office] static GLB load failed:", modelName, err);
          reject(err);
        }
      );
    });
  }

  async loadAnim(
    name: string
  ): Promise<{ mesh: THREE.Object3D; anims: THREE.AnimationClip[] }> {
    if (this.animCache.has(name)) {
      const { scene, anims } = this.animCache.get(name)!;
      return { mesh: SkeletonUtils.clone(scene), anims };
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        `${ASSET_BASE}/characters/animated/${name}.glb`,
        (gltf: GLTF) => {
          this.animCache.set(name, {
            scene: gltf.scene,
            anims: gltf.animations,
          });
          resolve({
            mesh: SkeletonUtils.clone(gltf.scene),
            anims: gltf.animations,
          });
        },
        undefined,
        reject
      );
    });
  }

  loadGLTF(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.loader.load(path, resolve, undefined, reject);
    });
  }

  // Apply colormap to meshes without embedded texture
  applyColormap(mesh: THREE.Object3D): void {
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          if (mat && !(mat as THREE.MeshStandardMaterial).map) {
            (mat as THREE.MeshStandardMaterial).map = this.colormap;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }

  // Normalize mesh height to target world units
  normalizeHeight(mesh: THREE.Object3D, targetH = 1.4): void {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0) {
      const s = targetH / size.y;
      mesh.scale.setScalar(s);
      mesh.position.y = -box.min.y * s;
    } else {
      mesh.scale.setScalar(100);
    }
  }
}
