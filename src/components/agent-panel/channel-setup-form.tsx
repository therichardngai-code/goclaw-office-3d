import { useState } from "react";
import { CHANNEL_TYPES, CHANNEL_CREDS, type CredField } from "@/data/channel-schemas";
import { createChannelInstance } from "@/api/channel-api";

interface Props {
  agentId: string;   // pre-linked to the currently-selected agent
  agentKey: string;  // used to auto-generate a channel instance name
  onSuccess: () => void;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ChannelSetupForm({ agentId, agentKey, onSuccess }: Props) {
  const [channelType, setChannelType] = useState("telegram");
  const [instanceName, setInstanceName] = useState(`${slugify(agentKey)}-telegram`);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fields: CredField[] = CHANNEL_CREDS[channelType] ?? [];

  const handleChannelChange = (type: string) => {
    setChannelType(type);
    setInstanceName(`${slugify(agentKey)}-${type.replace("_", "-")}`);
    setCreds({});
    setRevealed({});
    setError("");
  };

  const handleSubmit = async () => {
    if (!instanceName.trim()) { setError("Instance name is required."); return; }
    const missing = fields.filter((f) => f.required && !creds[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Required: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setLoading(true);
    setError("");
    const cleanCreds = Object.fromEntries(
      Object.entries(creds).filter(([, v]) => v.trim())
    );
    const result = await createChannelInstance({
      name: instanceName.trim(),
      channel_type: channelType,
      agent_id: agentId,
      credentials: Object.keys(cleanCreds).length > 0 ? cleanCreds : undefined,
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
        <select
          className={inputCls}
          value={channelType}
          onChange={(e) => handleChannelChange(e.target.value)}
        >
          {CHANNEL_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
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
      {fields.length > 0 && fields.map((field) => (
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

      {fields.length === 0 && (
        <p className="text-gray-500 text-xs italic">
          No credentials required — authentication happens after creation.
        </p>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-1 w-full py-2 rounded text-sm font-semibold bg-[#e8352a] hover:bg-[#c42d22] text-white transition-colors disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect Channel"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#e8352a]/60 transition-colors";

const labelCls =
  "block text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase";
