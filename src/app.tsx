import { useRef } from "react";
import { useOfficeStore } from "./stores/use-office-store";
import { useOfficeState } from "./hooks/use-office-state";
import { useScene } from "./hooks/use-scene";
import { AuthGate } from "./components/auth-gate";
import { HUD } from "./components/hud";
import { ReconnectBanner } from "./components/reconnect-banner";
import { NotificationPanel } from "./components/notification-panel";
import { CameraControls } from "./components/camera-controls";
import { AgentPanel } from "./components/agent-panel/agent-panel";
import { useApiAgents } from "./hooks/use-api-agents";

export function App() {
  const token = useOfficeStore((s) => s.token);
  const containerRef = useRef<HTMLDivElement>(null);

  useOfficeState(token);
  useScene(containerRef);
  useApiAgents(token);

  return (
    <>
      {/* Container always rendered so useScene initialises on first mount */}
      <div ref={containerRef} className="absolute inset-0" />
      {!token ? (
        <AuthGate />
      ) : (
        <>
          <HUD />
          <ReconnectBanner />
          <NotificationPanel />
          <AgentPanel />
          <CameraControls />
        </>
      )}
    </>
  );
}
