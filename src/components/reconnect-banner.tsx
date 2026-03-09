import { useOfficeStore } from "@/stores/use-office-store";

export function ReconnectBanner() {
  const connected = useOfficeStore((s) => s.connected);
  const token = useOfficeStore((s) => s.token);

  if (connected || !token) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-600 text-black text-center py-2 text-sm font-medium z-50">
      Reconnecting to gateway...
    </div>
  );
}
