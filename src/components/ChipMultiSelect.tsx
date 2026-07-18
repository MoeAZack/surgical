import React from "react";
import { X } from "lucide-react";

interface ChipMultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  onQuickAdd?: () => void;
  placeholder: string;
  icon?: React.ReactNode;
}

/** A select-driven multi-value picker that renders chosen values as removable
 *  chips. Used for procedures and surgeons on a case. */
export const ChipMultiSelect: React.FC<ChipMultiSelectProps> = ({
  label,
  options,
  selected,
  onAdd,
  onRemove,
  onQuickAdd,
  placeholder,
  icon
}) => {
  const available = options.filter((o) => !selected.includes(o));
  return (
    <div>
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      <div className="flex gap-1.5">
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onAdd(e.target.value);
            e.target.value = "";
          }}
          className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
        >
          <option value="" className="bg-brand-bg text-white/50">
            {placeholder}
          </option>
          {available.map((o) => (
            <option key={o} value={o} className="bg-brand-bg text-white">
              {o}
            </option>
          ))}
        </select>
        {onQuickAdd && (
          <button
            type="button"
            onClick={onQuickAdd}
            className="py-1 px-2.5 border border-white/10 hover:border-brand-primary text-white/60 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
          >
            +
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 bg-brand-primary/15 border border-brand-primary/30 text-brand-primary-light text-xs font-semibold rounded-full pl-3 pr-1.5 py-1"
            >
              {s}
              <button
                type="button"
                onClick={() => onRemove(s)}
                className="hover:bg-brand-primary/20 rounded-full p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
