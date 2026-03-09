// Syntax-highlighted JSON viewer — dark theme, no external deps
// Ported from goclaw ui/web EventDetailDialog's JsonHighlight
interface Props { json: string }

export function JsonHighlight({ json }: Props) {
  const parts = json.split(
    /("(?:\\.|[^"\\])*") *(:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g
  );

  return (
    <>
      {parts.map((part, i) => {
        if (part === undefined || part === "") return null;
        // String key (followed by colon)
        if (part.startsWith('"') && parts[i + 1] === ":") {
          return <span key={i} className="text-sky-400">{part}</span>;
        }
        if (part === ":") {
          return <span key={i} className="text-white/40">{part}</span>;
        }
        if (part.startsWith('"')) {
          return <span key={i} className="text-emerald-400">{part}</span>;
        }
        if (part === "true" || part === "false" || part === "null") {
          return <span key={i} className="text-amber-400">{part}</span>;
        }
        if (/^-?\d/.test(part)) {
          return <span key={i} className="text-violet-400">{part}</span>;
        }
        return <span key={i} className="text-white/50">{part}</span>;
      })}
    </>
  );
}

// Inline detail block: shows event name + formatted JSON with copy button
interface DetailProps {
  eventName: string;
  payload: unknown;
  onClose?: () => void;
}

export function EventJsonDetail({ eventName, payload, onClose }: DetailProps) {
  const json = JSON.stringify(payload, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(json).catch(() => {});
  };

  return (
    <div className="mt-2 rounded-lg border border-[#2a2a3a] bg-[#0a0a14] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2a2a3a] bg-[#10101c]">
        <span className="font-mono text-xs text-white/50">{eventName}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="text-xs text-white/40 hover:text-white/80 transition-colors"
          >
            copy
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-white/30 hover:text-white/70 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <pre className="p-3 text-xs leading-relaxed overflow-x-auto max-h-64 overflow-y-auto">
        <code><JsonHighlight json={json} /></code>
      </pre>
    </div>
  );
}
