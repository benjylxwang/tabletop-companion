import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  error = false,
  id,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedLabel = options.find((o) => o.value === value)?.label;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onClick={() => setOpen((prev) => !prev)}
        className={[
          'w-full flex items-center justify-between rounded border bg-parchment-200',
          'px-3 py-2 text-sm text-left',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-crimson-600 focus:ring-crimson-600'
            : 'border-parchment-300',
        ].join(' ')}
      >
        <span className={selectedLabel ? 'text-ink-900' : 'text-ink-300'}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-ink-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 w-full rounded border border-parchment-300 bg-parchment-100 shadow-modal py-1 max-h-60 overflow-auto"
        >
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled}
              onClick={() => {
                if (!option.disabled) {
                  onChange(option.value);
                  setOpen(false);
                }
              }}
              className={[
                'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
                'transition-colors duration-100',
                option.disabled
                  ? 'text-ink-300 cursor-not-allowed'
                  : 'text-ink-900 hover:bg-parchment-200',
              ].join(' ')}
            >
              <span className="w-4 shrink-0">
                {option.value === value && (
                  <Check className="h-4 w-4 text-amber-500" />
                )}
              </span>
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
