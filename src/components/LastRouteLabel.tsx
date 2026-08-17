import { buildLastRouteText } from '../services/vehicleLastRouteService';

import type { VehicleLastRouteInfo } from '../services/vehicleLastRouteService';
import type { JSX } from 'react';

export default function LastRouteLabel({
  info,
  className,
}: {
  info: VehicleLastRouteInfo | null | undefined;
  className?: string;
}): JSX.Element | null {
  const text = buildLastRouteText(info);
  if (text == null) return null;

  return <div className={className ?? 'text-xs text-zinc-400'}>{text}</div>;
}
