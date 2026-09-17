import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import React from 'react';

interface SortableHeaderProps {
  label: string;
  direction: 'asc' | 'desc' | null;
  onSort: () => void;
  className?: string;
}

export default function SortableHeader({ label, direction, onSort, className }: SortableHeaderProps): React.ReactElement {
  return (
    <th
      className={className}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={onSort}
        className="inline-flex items-center gap-1 uppercase hover:text-zinc-700"
      >
        {label}
        {direction === 'asc' && <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
        {direction === 'desc' && <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
        {direction === null && <ArrowUpDown className="h-3.5 w-3.5 text-zinc-300" aria-hidden="true" />}
      </button>
    </th>
  );
}
