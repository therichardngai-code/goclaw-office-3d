import {
  sceneZoomIn,
  sceneZoomOut,
  sceneRotateLeft,
  sceneRotateRight,
  sceneResetCamera,
} from "@/hooks/use-scene";

export function CameraControls() {
  const buttonClass =
    "w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded flex items-center justify-center text-sm font-bold transition-colors";

  return (
    <div className="fixed bottom-4 left-4 flex gap-1.5 z-40">
      <button onClick={sceneRotateLeft}  className={buttonClass} title="Rotate left">←</button>
      <button onClick={sceneRotateRight} className={buttonClass} title="Rotate right">→</button>
      <button onClick={sceneZoomIn}      className={buttonClass} title="Zoom in">+</button>
      <button onClick={sceneZoomOut}     className={buttonClass} title="Zoom out">−</button>
      <button onClick={sceneResetCamera} className={buttonClass} title="Reset camera">⊙</button>
    </div>
  );
}
