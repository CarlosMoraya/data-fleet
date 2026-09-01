import React from 'react';

import { cn } from '../../lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  ariaLabel: string;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

function cycleIndex(index: number, direction: number, length: number): number {
  if (length === 0) return -1;
  return (index + direction + length) % length;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  query,
  onQueryChange,
  ariaLabel,
  placeholder,
  emptyLabel = 'Nenhum resultado',
  disabled = false,
  className,
}: SearchableSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusIndex, setFocusIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const optionLabelsRef = React.useRef(new Map<string, string>());
  const listboxId = React.useId();
  for (const option of options) optionLabelsRef.current.set(option.value, option.label);

  const close = React.useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setFocusIndex(-1);
    if (restoreFocus) inputRef.current?.focus();
  }, []);

  const open = () => {
    if (disabled || isOpen) return;
    setIsOpen(true);
    setFocusIndex(-1);
    onQueryChange('');
  };

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option.value);
    close();
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close, isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) open();
        setFocusIndex((current) => cycleIndex(current, 1, options.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) open();
        setFocusIndex((current) => (
          current === -1 ? options.length - 1 : cycleIndex(current, -1, options.length)
        ));
        break;
      case 'Home':
        if (isOpen) {
          event.preventDefault();
          setFocusIndex(options.length > 0 ? 0 : -1);
        }
        break;
      case 'End':
        if (isOpen) {
          event.preventDefault();
          setFocusIndex(options.length > 0 ? options.length - 1 : -1);
        }
        break;
      case 'Enter':
        if (isOpen && focusIndex >= 0) {
          event.preventDefault();
          selectOption(options[focusIndex]);
        }
        break;
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          close(true);
        }
        break;
      case 'Tab':
        if (isOpen) close();
        break;
      default:
        break;
    }
  };

  const inputValue = isOpen ? query : (optionLabelsRef.current.get(value) ?? query);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-activedescendant={isOpen && focusIndex >= 0 ? `${listboxId}-option-${focusIndex}` : undefined}
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={open}
        onClick={open}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
      />

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg"
        >
          {options.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-zinc-400">
              {emptyLabel}
            </li>
          ) : (
            options.map((option, index) => {
              const isFocused = focusIndex === index;
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50',
                    isFocused && 'bg-orange-50 text-orange-700',
                    isSelected && 'font-medium',
                  )}
                >
                  {option.label}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
