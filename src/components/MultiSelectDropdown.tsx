import { Check, ChevronDown } from 'lucide-react';
import React from 'react';

import { cn } from '../lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectDropdownProps {
  label: string;
  options: Array<string | MultiSelectOption>;
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  disabled?: boolean;
}

function normalizeOptions(options: Array<string | MultiSelectOption>): MultiSelectOption[] {
  const seen = new Set<string>();
  const normalized: MultiSelectOption[] = [];
  for (const option of options) {
    const value = typeof option === 'string' ? option : option.value;
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push({
      value,
      label: typeof option === 'string' ? option : option.label,
    });
  }
  return normalized;
}

function cycleIndex(index: number, direction: number, length: number): number {
  if (length === 0) return -1;
  return (index + direction + length) % length;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  emptyLabel = 'Nenhuma opção',
  disabled = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusIndex, setFocusIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const listboxId = React.useId();

  const normalized = React.useMemo(() => normalizeOptions(options), [options]);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  const close = React.useCallback(() => {
    setIsOpen(false);
    setFocusIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const toggleOption = (value: string) => {
    const next = selectedSet.has(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(normalized.filter((option) => next.includes(option.value)).map((option) => option.value));
  };

  const open = () => {
    if (disabled) return;
    const firstSelected = normalized.findIndex((option) => selectedSet.has(option.value));
    const nextIndex = firstSelected !== -1 ? firstSelected : (normalized.length > 0 ? 0 : -1);
    setFocusIndex(nextIndex);
    setIsOpen(true);
  };

  const toggleOpen = () => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const target = optionRefs.current[focusIndex];
    if (target) target.focus();
  }, [isOpen, focusIndex]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        close();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, close]);

  const selectAll = () => {
    onChange(normalized.map((option) => option.value));
  };

  const clearSelection = () => {
    onChange([]);
  };

  const moveFocus = (direction: number) => {
    setFocusIndex((current) => cycleIndex(current, direction, normalized.length));
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent, value: string) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(-1);
        break;
      case 'Home':
        event.preventDefault();
        setFocusIndex(normalized.length > 0 ? 0 : -1);
        break;
      case 'End':
        event.preventDefault();
        setFocusIndex(normalized.length > 0 ? normalized.length - 1 : -1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        toggleOption(value);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      default:
        break;
    }
  };

  const buttonLabel = selected.length > 0 ? `${label} (${selected.length})` : label;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium',
          'bg-white text-zinc-700 transition-colors hover:bg-zinc-50',
          'focus:ring-2 focus:ring-orange-400 focus:outline-none',
          disabled && 'cursor-not-allowed opacity-50 hover:bg-white',
        )}
      >
        {buttonLabel}
        <ChevronDown className={cn('h-4 w-4 text-zinc-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {normalized.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-1.5">
              <button
                type="button"
                onClick={selectAll}
                disabled={selected.length === normalized.length}
                className="text-xs font-medium text-orange-600 transition-colors hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Selecionar todos
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selected.length === 0}
                className="text-xs font-medium text-orange-600 transition-colors hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Limpar seleção
              </button>
            </div>
          )}
          <div
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-56 overflow-y-auto"
          >
            {normalized.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-400">{emptyLabel}</div>
            ) : (
              normalized.map((option, index) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <div
                    key={option.value}
                    ref={(element) => { optionRefs.current[index] = element; }}
                    role="option"
                    aria-checked={isSelected}
                    tabIndex={-1}
                    onClick={() => toggleOption(option.value)}
                    onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                      'focus:bg-zinc-50 focus:outline-none',
                      isSelected ? 'bg-orange-50 text-orange-700' : 'text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-zinc-300',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
