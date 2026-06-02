import type { OperationalUnit, OperationsManagerScope } from '../types';

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizeOperationsManagerScope(
  scope: Partial<OperationsManagerScope>
): OperationsManagerScope {
  return {
    shipperIds: uniq(scope.shipperIds ?? []).sort(),
    operationalUnitIds: uniq(scope.operationalUnitIds ?? []).sort(),
  };
}

export function validateOperationsManagerScope(scope: Partial<OperationsManagerScope>): string | null {
  const normalized = normalizeOperationsManagerScope(scope);

  if (normalized.shipperIds.length === 0) {
    return 'Selecione ao menos 1 embarcador.';
  }

  if (normalized.operationalUnitIds.length === 0) {
    return 'Selecione ao menos 1 base operacional.';
  }

  return null;
}

export function filterOperationalUnitsByShippers(
  operationalUnitIds: string[],
  selectedShipperIds: string[],
  operationalUnits: Array<Pick<OperationalUnit, 'id' | 'shipperId'>>
): string[] {
  const allowedShippers = new Set(selectedShipperIds);

  return uniq(operationalUnitIds).filter((unitId) => {
    const unit = operationalUnits.find((item) => item.id === unitId);
    return !!unit && allowedShippers.has(unit.shipperId);
  });
}

export function hasOperationsManagerScopeChanged(
  previousScope: Partial<OperationsManagerScope>,
  nextScope: Partial<OperationsManagerScope>
): boolean {
  const previous = normalizeOperationsManagerScope(previousScope);
  const next = normalizeOperationsManagerScope(nextScope);

  return (
    previous.shipperIds.join(',') !== next.shipperIds.join(',') ||
    previous.operationalUnitIds.join(',') !== next.operationalUnitIds.join(',')
  );
}
