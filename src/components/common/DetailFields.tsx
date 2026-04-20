import { ExternalLink } from 'lucide-react';

interface DetailFieldProps {
  label: string;
  value: string | number | null | undefined;
}

export function DetailField({ label, value }: DetailFieldProps) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <span className="text-xs text-gray-500 uppercase">{label}</span>
      <p className="text-sm text-gray-900">{String(value)}</p>
    </div>
  );
}

interface FileFieldProps {
  label: string;
  url: string | null | undefined;
  labelLink?: string;
}

export function FileField({ label, url, labelLink }: FileFieldProps) {
  if (!url) return null;
  return (
    <div>
      <span className="text-xs text-gray-500 uppercase">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-1"
      >
        <ExternalLink className="w-3 h-3" />
        {labelLink || 'Ver documento'}
      </a>
    </div>
  );
}

interface SectionTitleProps {
  children: unknown;
}

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <h3 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
      {children}
    </h3>
  );
}
