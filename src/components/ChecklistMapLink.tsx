import { MapPin } from 'lucide-react';

import { cn } from '../lib/utils';

export default function ChecklistMapLink({
  latitude,
  longitude,
  className,
}: {
  latitude?: number;
  longitude?: number;
  className?: string;
}) {
  if (latitude == null || longitude == null) return null;

  return (
    <a
      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-orange-500 hover:underline', className)}
    >
      <MapPin className="h-3 w-3" />
      Ver no mapa
    </a>
  );
}
