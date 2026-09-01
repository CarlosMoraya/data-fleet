import type { PaymentInstallment } from '../types/payment';

export function resolvePaymentVehiclePlate(
  installment: PaymentInstallment,
): string | undefined {
  return installment.maintenanceOrderVehiclePlate
    ?? installment.extraPaymentVehiclePlate
    ?? undefined;
}
