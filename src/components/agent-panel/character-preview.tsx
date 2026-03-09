import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { ASSET_BASE, CHAR_MODELS } from "@/scene/constants";

interface Props {
  characterIndex: number;
  width?: number;
  height?: number;
}

export function CharacterPreview({ characterIndex, width = 200, height = 280 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const modelName = CHAR_MODELS[characterIndex] ?? "character-male-a";

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.9, 3.2);
    camera.lookAt(0, 0.7, 0);

    scene.add(new THREE.AmbientLight(0xc8d0ff, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(2, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe8c0, 1.0);
    fill.position.set(-2, 2, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x6666ff, 0.6);
    rim.position.set(0, -2, -4);
    scene.add(rim);

    let animId: number;
    let meshGroup: THREE.Object3D | null = null;

    const texLoader = new THREE.TextureLoader();
    const colormap = texLoader.load(`${ASSET_BASE}/characters/Textures/colormap.png`);
    colormap.flipY = false;
    colormap.colorSpace = THREE.SRGBColorSpace;

    const loader = new GLTFLoader();
    loader.load(`${ASSET_BASE}/characters/${modelName}.glb`, (gltf) => {
      meshGroup = SkeletonUtils.clone(gltf.scene);

      meshGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => {
            if (mat && !(mat as THREE.MeshStandardMaterial).map) {
              (mat as THREE.MeshStandardMaterial).map = colormap;
              mat.needsUpdate = true;
            }
          });
        }
      });

      // Normalize to 1.4 units height
      const box = new THREE.Box3().setFromObject(meshGroup);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0) {
        const s = 1.4 / size.y;
        meshGroup.scale.setScalar(s);
        meshGroup.position.y = -box.min.y * s;
      } else {
        meshGroup.scale.setScalar(100);
      }

      scene.add(meshGroup);
    });

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (meshGroup) meshGroup.rotation.y += 0.008;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, [modelName, width, height]);

  return (
    <div
      ref={mountRef}
      style={{ width, height }}
      className="flex items-center justify-center"
    />
  );
}
