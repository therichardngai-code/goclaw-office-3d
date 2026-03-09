// Renders per-channel config fields (approval rules, behaviour settings).
// Supports select, boolean toggle, number, and tags (textarea, one per line).
import type { ConfigField } from "@/data/channel-schemas";
import { CustomSelect } from "./custom-select";

const inp =
  "w-full px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00ADD8]/60 transition-colors";
const lbl =
  "block text-xs text-gray-400 mb-1.5 font-medium tracking-wide uppercase";

interface Props {
  fields: ConfigField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function ChannelConfigFields({ fields, values, onChange }: Props) {
  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <ConfigFieldRow key={field.key} field={field} value={values[field.key]} onChange={(v) => onChange(field.key, v)} />
      ))}
    </div>
  );
}

function ConfigFieldRow({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "select": {
      const current = (value as string) ?? (field.defaultValue as string) ?? "";
      return (
        <div>
          <label className={lbl}>{field.label}</label>
          <CustomSelect
            value={current}
            onChange={onChange}
            options={field.options ?? []}
          />
          {field.help && <p className="text-gray-600 text-xs mt-1">{field.help}</p>}
        </div>
      );
    }

    case "boolean": {
      const checked = value !== undefined ? (value as boolean) : (field.defaultValue as boolean) ?? false;
      return (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">{field.label}</span>
            {field.help && <p className="text-gray-600 text-xs mt-0.5">{field.help}</p>}
          </div>
          {/* Toggle switch — pure Tailwind, no Radix dependency */}
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
              checked ? "bg-[#00ADD8]" : "bg-[#2a2a3a]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                checked ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      );
    }

    case "number": {
      const numVal = value !== undefined && value !== null ? String(value) : "";
      return (
        <div>
          <label className={lbl}>{field.label}</label>
          <input
            className={inp}
            type="number"
            value={numVal}
            placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          />
          {field.help && <p className="text-gray-600 text-xs mt-1">{field.help}</p>}
        </div>
      );
    }

    case "tags": {
      const lines = Array.isArray(value) ? (value as string[]).join("\n") : "";
      return (
        <div>
          <label className={lbl}>{field.label}</label>
          <textarea
            className={`${inp} resize-none font-mono`}
            rows={3}
            value={lines}
            placeholder="One per line"
            onChange={(e) => {
              const parsed = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              onChange(parsed.length > 0 ? parsed : undefined);
            }}
          />
          {field.help && <p className="text-gray-600 text-xs mt-1">{field.help}</p>}
        </div>
      );
    }

    default:
      return null;
  }
}
