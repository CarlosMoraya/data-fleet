import { buildLastKmDisplayParts, VehicleLastKmInfo } from '../services/vehicleOdometerService';

import type { JSX } from 'react';

export default function LastKmLabel({
  info,
  className,
  hideWhenEmpty = false,
}: {
  info: VehicleLastKmInfo | null | undefined;
  className?: string;
  hideWhenEmpty?: boolean;
}): JSX.Element | null {
  const parts = buildLastKmDisplayParts(info);

  if (parts.valueText == null) {
    if (hideWhenEmpty) return null;
    return <div className={className ?? 'text-xs text-zinc-400'}>{parts.fullText}</div>;
  }

  return (
    <div className={className ?? 'text-xs text-zinc-400'}>
      {parts.prefix} {parts.valueText}
      {parts.suffix ? <span className="text-red-600"> {parts.suffix}</span> : null}
    </div>
  );
}
