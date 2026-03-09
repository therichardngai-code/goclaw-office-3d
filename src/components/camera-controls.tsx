import {
  sceneZoomIn,
  sceneZoomOut,
  sceneRotateLeft,
  sceneRotateRight,
  sceneResetCamera,
} from "@/hooks/use-scene";

export function CameraControls() {
  const buttonClass =
    "w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded flex items-center justify-center text-lg font-bold transition-colors";

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-40">
      {/* Rotate controls */}
      <div className="flex gap-2">
        <button
          onClick={sceneRotateLeft}
          className={buttonClass}
          title="Rotate left"
        >
          &larr;
        </button>
        <button
          onClick={sceneRotateRight}
          className={buttonClass}
          title="Rotate right"
        >
          &rarr;
        </button>
      </div>

      {/* Zoom controls */}
      <div className="flex gap-2">
        <button onClick={sceneZoomIn} className={buttonClass} title="Zoom In">
          +
        </button>
        <button onClick={sceneZoomOut} className={buttonClass} title="Zoom Out">
          -
        </button>
      </div>

      {/* Reset */}
      <button
        onClick={sceneResetCamera}
        className={buttonClass}
        title="Reset Camera"
      >
        O
      </button>
    </div>
  );
}
