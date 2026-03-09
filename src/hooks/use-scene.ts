import { useEffect, useRef, type RefObject } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { OfficeScene } from "@/scene/office-scene";

// Global reference for camera controls
let globalScene: OfficeScene | null = null;

export function useScene(containerRef: RefObject<HTMLDivElement | null>): void {
  const sceneRef = useRef<OfficeScene | null>(null);
  const mergedSnapshot = useOfficeStore((s) => s.mergedSnapshot);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new OfficeScene();
    scene.init(containerRef.current);
    sceneRef.current = scene;
    globalScene = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
      globalScene = null;
    };
  }, [containerRef]);

  useEffect(() => {
    if (mergedSnapshot && sceneRef.current) {
      sceneRef.current.update(mergedSnapshot);
    }
  }, [mergedSnapshot]);
}

// Camera control functions for external use
export function sceneZoomIn(): void {
  globalScene?.zoomIn();
}

export function sceneZoomOut(): void {
  globalScene?.zoomOut();
}

export function sceneRotateLeft(): void {
  globalScene?.rotateLeft();
}

export function sceneRotateRight(): void {
  globalScene?.rotateRight();
}

export function sceneResetCamera(): void {
  globalScene?.resetCamera();
}
