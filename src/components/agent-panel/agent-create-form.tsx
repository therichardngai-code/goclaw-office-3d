import { useState, useEffect } from "react";
import {
  fetchProviders,
  fetchProviderModels,
  fetchAllAgents,
  createAgent,
  type Provider,
  type ProviderModel,
} from "@/api/agent-api";
import { verifyProvider } from "@/api/provider-api";
import { useOfficeStore } from "@/stores/use-office-store";
import { AddProviderForm } from "./add-provider-form";
import { CustomSelect, ModelCombobox } from "./custom-select";
import type { AgentPreset } from "@/data/agent-presets";

interface Props {
  preset?: AgentPreset;
  onSuccess: () => void;
  onCancel: () => void;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function AgentCreateForm({ preset, onSuccess, onCancel }: Props) {
  const setApiAgents = useOfficeStore((s) => s.setApiAgents);
  const [displayName, setDisplayName]   = useState(preset?.label ?? "");
  const [agentKey, setAgentKey]         = useState(preset?.suggestedKey ?? "");
  const [description, setDescription]   = useState(preset?.prompt ?? "");
  const [provider, setProvider]         = useState("");
  const [model, setModel]               = useState("");
  const [providers, setProviders]       = useState<Provider[]>([]);
  const [models, setModels]             = useState<ProviderModel[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingModels, setLoadingModels]       = useState(false);
  const [showAddProvider, setShowAddProvider]   = useState(false);
  const [verifying, setVerifying]       = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const isPredefined = !!preset;

  const loadProviders = () => {
    setLoadingProviders(true);
    fetchProviders().then((list) => {
      setProviders(list);
      setLoadingProviders(false);
      if (list.length > 0 && !provider) {
        const first = list.find((p) => p.enabled) ?? list[0]!;
        setProvider(first.name);
      }
    });
  };

  useEffect(() => { loadProviders(); }, []);

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
    setVerifyResult(null);
  }, [provider, providers]);

  useEffect(() => { setVerifyResult(null); }, [model]);

  const handleNameChange = (v: string) => {
    setDisplayName(v);
    setAgentKey(slugify(v) || (preset?.suggestedKey ?? ""));
  };

  const handleProviderChange = (v: string) => {
    setProvider(v);
    setModel("");
    setVerifyResult(null);
    setShowAddProvider(false);
  };

  const handleProviderAdded = (newProviderName: string) => {
    setShowAddProvider(false);
    setLoadingProviders(true);
    fetchProviders().then((list) => {
      setProviders(list);
      setLoadingProviders(false);
      setProvider(newProviderName);
    });
  };

  const handleVerify = async () => {
    const found = providers.find((p) => p.name === provider);
    if (!found || !model.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    const result = await verifyProvider(found.id, model.trim());
    setVerifyResult(result);
    setVerifying(false);
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
      other_config: isPredefined && description.trim() ? { description: description.trim() } : undefined,
    });
    setLoading(false);
    if (result.ok) {
      fetchAllAgents().then(setApiAgents).catch(() => {});
      onSuccess();
    } else {
      setError(result.error ?? "Failed to create agent");
    }
  };

  // Build provider options for CustomSelect
  const providerOptions = providers.map((p) => ({
    value: p.name,
    label: `${p.display_name || p.name}${!p.enabled ? " (disabled)" : ""}`,
  }));

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
      <Field label="Display Name">
        <input className={inp} value={displayName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. My Support Agent" />
      </Field>

      <Field label="Agent Key">
        <input className={inp} value={agentKey} onChange={(e) => setAgentKey(e.target.value)} placeholder="my-support-agent" />
      </Field>

      {/* Provider — custom dark select; "＋ Add Provider" toggle below */}
      <Field label="Provider">
        {providers.length === 0 && !loadingProviders ? (
          <p className="text-gray-500 text-xs italic py-1">No providers configured — add one below.</p>
        ) : (
          <CustomSelect
            value={provider}
            onChange={handleProviderChange}
            options={providerOptions}
            placeholder="Select provider…"
            disabled={loadingProviders}
          />
        )}

        {!showAddProvider && (
          <button
            type="button"
            onClick={() => setShowAddProvider(true)}
            className="mt-1.5 text-xs text-[#00ADD8] hover:text-[#007D9C] transition-colors"
          >
            ＋ Add LLM Provider
          </button>
        )}
      </Field>

      {showAddProvider && (
        <AddProviderForm
          onSuccess={handleProviderAdded}
          onCancel={() => setShowAddProvider(false)}
        />
      )}

      {/* Model — combobox: free-type + dark suggestion list + [Check] verify */}
      <Field label="Model">
        <div className="flex gap-2">
          <div className="flex-1">
            <ModelCombobox
              value={model}
              onChange={setModel}
              models={models}
              loading={loadingModels}
            />
          </div>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || !model.trim() || !provider}
            className="px-3 py-2 rounded text-xs font-semibold border border-[#2a2a3a] text-white/60 hover:text-white hover:border-[#3a3a4a] transition-colors disabled:opacity-40"
          >
            {verifying ? "…" : "Check"}
          </button>
        </div>
        {verifyResult && (
          <p className={`text-xs mt-1 ${verifyResult.valid ? "text-green-400" : "text-red-400"}`}>
            {verifyResult.valid ? "✓ Model verified" : `✗ ${verifyResult.error ?? "Verification failed"}`}
          </p>
        )}
        {!verifyResult && !loadingModels && provider && models.length === 0 && (
          <p className="text-gray-600 text-xs mt-1">Provider doesn't list models — type the model ID manually.</p>
        )}
      </Field>

      {isPredefined && (
        <Field label="Describe Your Agent">
          <textarea className={`${inp} h-28 resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your agent's personality and purpose…" />
        </Field>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-3 justify-end mt-auto pt-2">
        <button onClick={onCancel} className="px-5 py-2 rounded text-sm text-white/60 hover:text-white border border-[#2a2a3a] hover:border-[#3a3a4a] transition-colors">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={loading} className="px-5 py-2 rounded text-sm font-semibold bg-[#00ADD8] hover:bg-[#007D9C] text-white transition-colors disabled:opacity-50">
          {loading ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00ADD8]/60 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase">{label}</label>
      {children}
    </div>
  );
}
