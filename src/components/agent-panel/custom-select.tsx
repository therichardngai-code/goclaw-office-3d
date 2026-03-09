// Portal-based custom select + model combobox — dark themed to match panel UI.
// Uses ReactDOM.createPortal to escape overflow:hidden clipping on the modal container.
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { ProviderModel } from "@/api/agent-api";

// ── Shared: track anchor position from a DOM element ─────────────────────────

function useAnchorPos(triggerRef: { current: HTMLElement | null }, open: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const update = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, [triggerRef]);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, update]);

  return pos;
}

// ── Shared: dark dropdown panel rendered via portal ───────────────────────────

function DropPanel({
  dropRef,
  pos,
  children,
}: {
  dropRef: React.RefObject<HTMLDivElement | null>;
  pos: { top: number; left: number; width: number };
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      ref={dropRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-2xl overflow-hidden"
    >
      <div className="max-h-56 overflow-y-auto py-1">{children}</div>
    </div>,
    document.body
  );
}

// ── CustomSelect ──────────────────────────────────────────────────────────────

export interface SelectOption { value: string; label: string }

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder = "Select…", disabled = false }: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const pos = useAnchorPos(triggerRef, open);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#1a1a24] border rounded text-sm transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-left"
        style={{ borderColor: open ? "rgba(0,173,216,0.6)" : "#2a2a3a" }}
      >
        <span className={selected ? "text-white" : "text-gray-500"}>
          {disabled ? "Loading…" : (selected?.label ?? placeholder)}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && pos && (
        <DropPanel dropRef={dropRef} pos={pos}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                opt.value === value
                  ? "bg-[#00ADD8]/20 text-white font-medium"
                  : "text-gray-300 hover:bg-[#00ADD8]/10 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </DropPanel>
      )}
    </>
  );
}

// ── ModelCombobox ─────────────────────────────────────────────────────────────
// Free-type input + live-filtered dark suggestion list from the API model roster.

interface ComboboxProps {
  value: string;
  onChange: (v: string) => void;
  models: ProviderModel[];
  loading?: boolean;
}

export function ModelCombobox({ value, onChange, models, loading = false }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const pos = useAnchorPos(inputRef, open);

  const filtered = models.filter(
    (m) =>
      !value ||
      m.id.toLowerCase().includes(value.toLowerCase()) ||
      m.name.toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (inputRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const inpCls =
    "w-full px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00ADD8]/60 transition-colors disabled:opacity-50";

  return (
    <>
      <input
        ref={inputRef}
        className={inpCls}
        value={value}
        disabled={loading}
        placeholder={loading ? "Loading models…" : models.length > 0 ? "Type or pick a model…" : "e.g. gpt-4o"}
        onChange={(e) => { onChange(e.target.value); if (models.length > 0) setOpen(true); }}
        onFocus={() => { if (models.length > 0) setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      />

      {open && pos && filtered.length > 0 && (
        <DropPanel dropRef={dropRef} pos={pos}>
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onChange(m.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-3 ${
                m.id === value
                  ? "bg-[#00ADD8]/20 text-white"
                  : "text-gray-300 hover:bg-[#00ADD8]/10 hover:text-white"
              }`}
            >
              <span className="font-mono text-xs truncate">{m.id}</span>
              {m.name !== m.id && (
                <span className="text-gray-500 text-xs shrink-0 truncate max-w-[140px]">{m.name}</span>
              )}
            </button>
          ))}
        </DropPanel>
      )}
    </>
  );
}
