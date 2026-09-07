// ─── Abastecimento (espelho da API Veloe) ─────────────────────────────────────
//
// Contrato de domínio do módulo de Abastecimento no frontend.
// Não contém CPF do motorista nem número de cartão completo — apenas os
// 4 últimos dígitos, conforme a restrição de LGPD do módulo.

export interface FuelSupply {
  id: string;
  clientId: string;
  vehicleId: string | null;
  driverId: string | null;
  plate: string;
  driverName: string | null;
  vehicleModel: string | null;
  fuelType: string | null;
  amountLiters: number | null;
  unitValue: number | null;
  totalValue: number | null;
  odometer: number | null;
  previousOdometer: number | null;
  kmTraveled: number | null;
  transactionDate: string;
  transactionStatus: string | null;
  supplyLocation: string | null;
  network: string | null;
  costCenter: string | null;
  baseName: string | null;
  cardLast4: string | null;
  shipperId: string | null;
  shipperName: string | null;
  operationalUnitId: string | null;
  operationalUnitName: string | null;
}
