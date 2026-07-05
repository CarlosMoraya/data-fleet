import { buildLastKmDisplayParts, VehicleLastKmInfo } from '../services/vehicleOdometerService';

import type { JSX } from 'react';

export default function LastKmLabel({
  info,
  className,
}: {
  info: VehicleLastKmInfo | null | undefined;
  className?: string;
}): JSX.Element {
  const parts = buildLastKmDisplayParts(info);

  if (parts.valueText == null) {
    return <div className={className ?? 'text-xs text-zinc-400'}>{parts.fullText}</div>;
  }

  return (
    <div className={className ?? 'text-xs text-zinc-400'}>
      {parts.prefix} {parts.valueText}
      {parts.suffix ? <span className="text-red-600"> {parts.suffix}</span> : null}
    </div>
  );
}
