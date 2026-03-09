// Inline "Add LLM Provider" form — matches goclaw Setup > Providers flow.
// Creates a provider via POST /v1/providers then notifies parent with the new provider id+name.
import { useState } from "react";
import { PROVIDER_TYPES } from "@/data/provider-types";
import { createProvider } from "@/api/provider-api";

interface Props {
  onSuccess: (newProviderName: string) => void; // provider slug (name) to auto-select
  onCancel: () => void;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function AddProviderForm({ onSuccess, onCancel }: Props) {
  const [providerType, setProviderType] = useState("openai_compat");
  const [name, setName] = useState("my-provider");
  const [apiBase, setApiBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTypeChange = (type: string) => {
    setProviderType(type);
    const preset = PROVIDER_TYPES.find((t) => t.value === type);
    setApiBase(preset?.apiBase ?? "");
    setName(slugify(preset?.label ?? type));
    setError("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    setError("");
    const result = await createProvider({
      name: name.trim(),
      provider_type: providerType,
      api_base: apiBase.trim() || undefined,
      api_key: apiKey.trim() || undefined,
      enabled: true,
    });
    setLoading(false);
    if (result.ok && result.provider) {
      onSuccess(result.provider.name);
    } else {
      setError(result.error ?? "Failed to create provider");
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#0a0a14] border border-[#2a2a3a] rounded-lg">
      <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Add LLM Provider</p>

      {/* Provider type */}
      <div>
        <label className={lbl}>Provider Type</label>
        <select className={inp} value={providerType} onChange={(e) => handleTypeChange(e.target.value)}>
          {PROVIDER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Name slug */}
      <div>
        <label className={lbl}>Name (slug)</label>
        <input className={inp} value={name} onChange={(e) => setName(slugify(e.target.value))} placeholder="my-provider" />
      </div>

      {/* API Base URL */}
      <div>
        <label className={lbl}>API Base URL</label>
        <input
          className={inp}
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          placeholder="https://api.example.com/v1  (leave blank for default)"
        />
      </div>

      {/* API Key — hidden with show/hide toggle */}
      <div>
        <label className={lbl}>API Key</label>
        <div className="relative">
          <input
            className={`${inp} pr-14`}
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white transition-colors px-1"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-1">Encrypted server-side. Never returned in API responses.</p>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-1.5 rounded text-xs text-white/50 hover:text-white border border-[#2a2a3a] transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-1.5 rounded text-xs font-semibold bg-[#e8352a] hover:bg-[#c42d22] text-white transition-colors disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add Provider"}
        </button>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#e8352a]/60 transition-colors";
const lbl = "block text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase";
