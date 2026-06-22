import { ODOMETER_UPDATE_CONTEXT, type ChecklistContext } from '../types';

export function canSaveTemplateWithoutItems(context: ChecklistContext): boolean {
  return context === ODOMETER_UPDATE_CONTEXT;
}
