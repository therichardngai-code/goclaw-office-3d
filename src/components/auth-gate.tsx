import { useState } from "react";
import { useOfficeStore } from "@/stores/use-office-store";
import { LOCAL_STORAGE_USER_ID_KEY } from "@/lib/constants";

export function AuthGate() {
  const setToken = useOfficeStore((s) => s.setToken);
  const [tokenInput, setTokenInput] = useState("");
  const [userIdInput, setUserIdInput] = useState(
    localStorage.getItem(LOCAL_STORAGE_USER_ID_KEY) ?? ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    if (userIdInput.trim()) {
      localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, userIdInput.trim());
    }
    setToken(tokenInput.trim());
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0f]">
      <form
        onSubmit={handleSubmit}
        className="bg-[#12121a] border border-[#2a2a3a] rounded-lg p-8 w-96"
      >
        <h1 className="text-xl font-semibold text-white mb-2">Agent Office 3D</h1>
        <p className="text-sm text-gray-400 mb-6">
          Enter your gateway token to connect.
        </p>

        <div className="flex flex-col gap-3 mb-4">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Gateway token"
            className="w-full px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#4a4a5a]"
            autoFocus
          />
          <input
            type="text"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="User ID (required for managed mode)"
            className="w-full px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#4a4a5a]"
          />
        </div>

        <button
          type="submit"
          disabled={!tokenInput.trim()}
          className="w-full py-2 bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-40 text-white rounded font-medium transition-colors"
        >
          Connect
        </button>
      </form>
    </div>
  );
}
