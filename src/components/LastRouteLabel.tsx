import { buildLastRouteDateText, buildLastRouteText } from '../services/vehicleLastRouteService';

import type { VehicleLastRouteInfo } from '../services/vehicleLastRouteService';
import type { JSX } from 'react';

export default function LastRouteLabel({
  info,
  className,
  variant,
}: {
  info: VehicleLastRouteInfo | null | undefined;
  className?: string;
  variant?: 'full' | 'dateOnly';
}): JSX.Element | null {
  const text = variant === 'dateOnly' ? buildLastRouteDateText(info) : buildLastRouteText(info);
  if (text == null) return null;

  return <div className={className ?? 'text-xs text-zinc-400'}>{text}</div>;
}
