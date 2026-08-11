export const OPERATION_START_BEFORE_ACQUISITION_WARNING = 'A data de início na operação é anterior à data de aquisição. Verifique se está correto — o cadastro pode ser salvo assim mesmo.';

export function isOperationStartBeforeAcquisition(acquisitionDate: string | undefined, operationStartDate: string | undefined): boolean {
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!acquisitionDate || !operationStartDate || !isoDatePattern.test(acquisitionDate) || !isoDatePattern.test(operationStartDate)) return false;
  return operationStartDate < acquisitionDate;
}
