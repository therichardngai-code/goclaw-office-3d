import { useState, useEffect } from "react";
import {
  fetchProviders,
  fetchProviderModels,
  createAgent,
  type Provider,
} from "@/api/agent-api";
import type { AgentPreset } from "@/data/agent-presets";

interface Props {
  preset?: AgentPreset;
  onSuccess: () => void;
  onCancel: () => void;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AgentCreateForm({ preset, onSuccess, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(preset?.label ?? "");
  const [agentKey, setAgentKey] = useState(preset?.suggestedKey ?? "");
  const [description, setDescription] = useState(preset?.prompt ?? "");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isPredefined = !!preset;

  useEffect(() => {
    fetchProviders().then(setProviders);
  }, []);

  useEffect(() => {
    const found = providers.find((p) => p.name === provider);
    if (found) {
      fetchProviderModels(found.id).then(setModels);
    } else {
      setModels([]);
    }
    setModel("");
  }, [provider, providers]);

  const handleNameChange = (v: string) => {
    setDisplayName(v);
    setAgentKey(slugify(v) || (preset?.suggestedKey ?? ""));
  };

  const handleSubmit = async () => {
    if (!agentKey.trim() || !provider.trim() || !model.trim()) {
      setError("Agent Key, Provider, and Model are required.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await createAgent({
      agent_key: agentKey.trim(),
      display_name: displayName.trim() || undefined,
      provider: provider.trim(),
      model: model.trim(),
      agent_type: isPredefined ? "predefined" : "open",
      other_config:
        isPredefined && description.trim()
          ? { description: description.trim() }
          : undefined,
    });
    setLoading(false);
    if (result.ok) {
      onSuccess();
    } else {
      setError(result.error ?? "Failed to create agent");
    }
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
      <Field label="Display Name">
        <input
          className={inputCls}
          value={displayName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. My Support Agent"
        />
      </Field>

      <Field label="Agent Key">
        <input
          className={inputCls}
          value={agentKey}
          onChange={(e) => setAgentKey(e.target.value)}
          placeholder="my-support-agent"
        />
      </Field>

      <Field label="Provider">
        {providers.length > 0 ? (
          <select
            className={inputCls}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="">Select provider…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={inputCls}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="e.g. anthropic"
          />
        )}
      </Field>

      <Field label="Model">
        {models.length > 0 ? (
          <select
            className={inputCls}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">Select model…</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={inputCls}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. claude-opus-4-6"
          />
        )}
      </Field>

      {isPredefined && (
        <Field label="Describe Your Agent">
          <textarea
            className={`${inputCls} h-28 resize-none`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your agent's personality and purpose…"
          />
        </Field>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-3 justify-end mt-auto pt-2">
        <button
          onClick={onCancel}
          className="px-5 py-2 rounded text-sm text-white/60 hover:text-white border border-[#2a2a3a] hover:border-[#3a3a4a] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-5 py-2 rounded text-sm font-semibold bg-[#e8352a] hover:bg-[#c42d22] text-white transition-colors disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#e8352a]/60 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
