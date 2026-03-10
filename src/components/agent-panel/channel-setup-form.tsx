import { useState } from "react";
import { CHANNEL_TYPES, CHANNEL_CREDS, CHANNEL_CONFIG, type CredField } from "@/data/channel-schemas";
import { createChannelInstance } from "@/api/channel-api";
import { ChannelConfigFields } from "./channel-config-fields";
import { CustomSelect } from "./custom-select";

interface Props {
  agentId: string;   // pre-linked to the currently-selected agent
  agentKey: string;  // used to auto-generate a channel instance name
  onSuccess: () => void;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Build initial config values from schema defaults
function defaultConfig(channelType: string): Record<string, unknown> {
  const fields = CHANNEL_CONFIG[channelType] ?? [];
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
  }
  return out;
}

export function ChannelSetupForm({ agentId, agentKey, onSuccess }: Props) {
  const [channelType, setChannelType] = useState("telegram");
  const [instanceName, setInstanceName] = useState(`${slugify(agentKey)}-telegram`);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<Record<string, unknown>>(defaultConfig("telegram"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const credFields: CredField[] = CHANNEL_CREDS[channelType] ?? [];
  const configFields = CHANNEL_CONFIG[channelType] ?? [];

  const handleChannelChange = (type: string) => {
    setChannelType(type);
    setInstanceName(`${slugify(agentKey)}-${type.replace("_", "-")}`);
    setCreds({});
    setRevealed({});
    setConfig(defaultConfig(type));
    setError("");
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!instanceName.trim()) { setError("Instance name is required."); return; }
    const missing = credFields.filter((f) => f.required && !creds[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Required: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setLoading(true);
    setError("");

    const cleanCreds = Object.fromEntries(
      Object.entries(creds).filter(([, v]) => v.trim())
    );
    // Strip undefined/empty/"inherit" from config before sending.
    // "inherit" means "use gateway default" = omit the field entirely (Go reads as nil).
    // "true"/"false" strings are handled server-side by coerceStringBools.
    const cleanConfig = Object.fromEntries(
      Object.entries(config).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== "inherit")
    );

    const result = await createChannelInstance({
      name: instanceName.trim(),
      channel_type: channelType,
      agent_id: agentId,
      credentials: Object.keys(cleanCreds).length > 0 ? cleanCreds : undefined,
      config: Object.keys(cleanConfig).length > 0 ? cleanConfig : undefined,
      enabled: true,
    });
    setLoading(false);
    if (result.ok) {
      onSuccess();
    } else {
      setError(result.error ?? "Failed to connect channel");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Channel type */}
      <div>
        <label className={labelCls}>Channel Type</label>
        <CustomSelect
          value={channelType}
          onChange={handleChannelChange}
          options={CHANNEL_TYPES.map((ct) => ({ value: ct.value, label: ct.label }))}
        />
      </div>

      {/* Instance name */}
      <div>
        <label className={labelCls}>Instance Name</label>
        <input
          className={inputCls}
          value={instanceName}
          onChange={(e) => setInstanceName(e.target.value)}
          placeholder="my-telegram-bot"
        />
        <p className="text-gray-600 text-xs mt-1">Unique slug used as channel identifier</p>
      </div>

      {/* Per-channel credential fields */}
      {credFields.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mt-1">Credentials</p>
          {credFields.map((field) => (
            <div key={field.key}>
              <label className={labelCls}>
                {field.label}{field.required ? " *" : ""}
              </label>
              <div className="relative">
                <input
                  className={`${inputCls} pr-10`}
                  type={field.type === "password" && !revealed[field.key] ? "password" : "text"}
                  value={creds[field.key] ?? ""}
                  onChange={(e) => setCreds((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder ?? ""}
                />
                {field.type === "password" && (
                  <button
                    type="button"
                    onClick={() => setRevealed((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors text-xs px-1"
                    title={revealed[field.key] ? "Hide" : "Show"}
                  >
                    {revealed[field.key] ? "●●●" : "···"}
                  </button>
                )}
              </div>
              {field.help && <p className="text-gray-600 text-xs mt-1">{field.help}</p>}
            </div>
          ))}
        </>
      )}

      {credFields.length === 0 && (
        <p className="text-gray-500 text-xs italic">
          No credentials required — authentication happens after creation.
        </p>
      )}

      {/* Approval & access rules (config) */}
      {configFields.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mt-2">Approval &amp; Access Rules</p>
          <ChannelConfigFields
            fields={configFields}
            values={config}
            onChange={handleConfigChange}
          />
        </>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-1 w-full py-2 rounded text-sm font-semibold bg-[#00ADD8] hover:bg-[#007D9C] text-white transition-colors disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect Channel"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00ADD8]/60 transition-colors";

const labelCls =
  "block text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase";
