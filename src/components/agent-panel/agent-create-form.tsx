import { useState, useEffect } from "react";
import {
  fetchProviders,
  fetchProviderModels,
  fetchAllAgents,
  createAgent,
  type Provider,
  type ProviderModel,
} from "@/api/agent-api";
import { useOfficeStore } from "@/stores/use-office-store";
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
  const setApiAgents = useOfficeStore((s) => s.setApiAgents);
  const [displayName, setDisplayName] = useState(preset?.label ?? "");
  const [agentKey, setAgentKey] = useState(preset?.suggestedKey ?? "");
  const [description, setDescription] = useState(preset?.prompt ?? "");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isPredefined = !!preset;

  // Load providers on mount; auto-select first enabled one
  useEffect(() => {
    fetchProviders().then((list) => {
      setProviders(list);
      setLoadingProviders(false);
      // Auto-select first enabled provider (matches goclaw web UI behaviour)
      if (list.length > 0) {
        const first = list.find((p) => p.enabled) ?? list[0]!;
        setProvider(first.name);
      }
    });
  }, []);

  // Fetch models whenever provider changes
  useEffect(() => {
    const found = providers.find((p) => p.name === provider);
    if (found) {
      setLoadingModels(true);
      fetchProviderModels(found.id, found.provider_type).then((list) => {
        setModels(list);
        setLoadingModels(false);
      });
    } else {
      setModels([]);
      setLoadingModels(false);
    }
    setModel("");
  }, [provider, providers]);

  const handleNameChange = (v: string) => {
    setDisplayName(v);
    setAgentKey(slugify(v) || (preset?.suggestedKey ?? ""));
  };

  const handleProviderChange = (v: string) => {
    setProvider(v);
    setModel("");
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
      fetchAllAgents().then(setApiAgents).catch(() => {});
      onSuccess();
    } else {
      setError(result.error ?? "Failed to create agent");
    }
  };

  // Unique datalist id per form instance to avoid collisions
  const datalistId = `model-options-${isPredefined ? "pre" : "open"}`;

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

      {/* Provider — always a <select>; shows "Loading…" while fetching */}
      <Field label="Provider">
        {loadingProviders ? (
          <select className={inputCls} disabled>
            <option>Loading providers…</option>
          </select>
        ) : providers.length > 0 ? (
          <select
            className={inputCls}
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            <option value="">Select provider…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.name}>
                {p.display_name || p.name}{!p.enabled ? " (disabled)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={inputCls}
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            placeholder="No providers configured — type slug (e.g. anthropic)"
          />
        )}
      </Field>

      {/* Model — combobox: free-type any ID, datalist shows API suggestions */}
      <Field label="Model">
        <input
          className={inputCls}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={
            loadingModels
              ? "Loading models…"
              : models.length > 0
              ? "Type or select model…"
              : "e.g. claude-opus-4-6"
          }
          list={datalistId}
          disabled={loadingModels}
        />
        <datalist id={datalistId}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </datalist>
        {!loadingModels && provider && models.length === 0 && (
          <p className="text-gray-500 text-xs mt-1">
            Provider doesn&apos;t list models — type the model ID manually.
          </p>
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
