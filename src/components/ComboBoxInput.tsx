import React, { useEffect, useMemo, useRef, useState } from "react";

interface ComboBoxInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/** Text input with a dropdown of existing values to pick from, so free-text fields (like an item name) stay consistent instead of drifting across near-duplicate spellings. Still allows typing a brand-new value. */
const ComboBoxInput: React.FC<ComboBoxInputProps> = ({
  value,
  onChange,
  options,
  placeholder,
  autoFocus,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const uniqueOptions = useMemo(
    () => Array.from(new Set(options.map((o) => o.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    ),
    [options],
  );

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter((o) => o.toLowerCase().includes(q));
  }, [uniqueOptions, value]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        autoFocus={autoFocus}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 overflow-y-auto bg-white border rounded-lg shadow-lg border-slate-200 max-h-48">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-[13px] text-left text-slate-700 hover:bg-slate-50 truncate"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComboBoxInput;
