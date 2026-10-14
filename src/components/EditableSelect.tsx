import React, { useState, useEffect } from 'react';
import { Plus, Check, Edit3, RotateCcw } from 'lucide-react';

interface EditableSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | string[];
  placeholder?: string;
  storageKey?: string; // Optional key to persist user-added options across reloads
  className?: string;
  disabled?: boolean;
}

export const EditableSelect: React.FC<EditableSelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'اختر أو اكتب...',
  storageKey,
  className = '',
  disabled = false,
}) => {
  const [customOptions, setCustomOptions] = useState<string[]>(() => {
    if (!storageKey) return [];
    try {
      const saved = localStorage.getItem(`custom_opt_${storageKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
    // If the value is not empty and not in the initial options, default to custom mode
    return Boolean(value && !options.includes(value as any) && !customOptions.includes(value));
  });

  const [customInputText, setCustomInputText] = useState<string>(value || '');

  // Keep all unique options
  const allOptions = Array.from(new Set([...options, ...customOptions]));

  // Sync state if value changes externally
  useEffect(() => {
    if (value && !allOptions.includes(value)) {
      setIsCustomMode(true);
      setCustomInputText(value);
    }
  }, [value]);

  const saveCustomOption = (newVal: string) => {
    const trimmed = newVal.trim();
    if (!trimmed) return;
    if (storageKey && !customOptions.includes(trimmed)) {
      const updated = [...customOptions, trimmed];
      setCustomOptions(updated);
      try {
        localStorage.setItem(`custom_opt_${storageKey}`, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
    onChange(trimmed);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__ADD_NEW__') {
      setIsCustomMode(true);
      setCustomInputText('');
    } else {
      onChange(val);
    }
  };

  const handleCustomInputSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (customInputText.trim()) {
      saveCustomOption(customInputText.trim());
      setIsCustomMode(false);
    }
  };

  if (isCustomMode) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div className="relative flex-1">
          <input
            id={id}
            type="text"
            value={customInputText}
            onChange={(e) => {
              setCustomInputText(e.target.value);
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomInputSubmit();
              }
            }}
            placeholder="اكتب خيارك يدوياً هنا..."
            autoFocus
            disabled={disabled}
            className="w-full text-xs p-2 rounded-lg border border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/40 text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>
        <button
          type="button"
          onClick={() => handleCustomInputSubmit()}
          title="حفظ واعتماد في القائمة"
          disabled={!customInputText.trim() || disabled}
          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs disabled:opacity-40 transition shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsCustomMode(false);
          }}
          title="الرجوع للاختيار من القائمة"
          disabled={disabled}
          className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs transition shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <select
        id={id}
        value={value}
        onChange={handleSelectChange}
        disabled={disabled}
        className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 font-medium"
      >
        <option value="" disabled={false}>
          -- {placeholder || 'اختر...'} --
        </option>
        {!allOptions.includes(value) && value && (
          <option value={value}>{value}</option>
        )}
        {allOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value="__ADD_NEW__" className="text-emerald-700 font-bold bg-emerald-50">
          ➕ إضافة خيار يدوي جديد...
        </option>
      </select>
      <button
        type="button"
        onClick={() => {
          setIsCustomMode(true);
          setCustomInputText(value || '');
        }}
        title="كتابة يدوية مخصصة"
        disabled={disabled}
        className="p-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 text-slate-500 text-xs transition shrink-0"
      >
        <Edit3 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
