// ─── Re-export de todos os tipos para compatibilidade ─────────────────────────
// Este arquivo mantém os imports existentes (`from '../types'`) funcionando.
// TODO: após migração completa de todos os imports, remover este arquivo.

export type { Role } from './types/role';
export type { User, Client } from './types/user';
export type { Vehicle, VehicleFieldSettings, VehicleKmInterval } from './types/vehicle';
export type { Driver, DriverFieldSettings } from './types/driver';
export type {
  MaintenanceStatus,
  MaintenanceType,
  BudgetStatus,
  MaintenanceOrder,
  BudgetItem,
  MaintenanceOrderRow,
  MaintenanceBudgetItemRow,
  MaintenanceOrderDashboard,
} from './types/maintenance';
export type {
  VehicleCategory,
  TemplateCategory,
  ChecklistContext,
  TemplateStatus,
  ChecklistStatus,
  ResponseStatus,
  ActionPlanStatus,
  ChecklistItemSuggestion,
  ChecklistTemplate,
  ChecklistTemplateVersion,
  ChecklistItem,
  Checklist,
  ChecklistResponse,
  ActionPlan,
  ChecklistDayInterval,
} from './types/checklist';
export { WORKSHOP_CONTEXTS } from './types/checklist';
export type {
  TireVisualClassification,
  TirePositionType,
  AxleType,
  RodagemType,
  AxleConfigEntry,
  Tire,
  TirePositionHistory,
  VehicleTireConfig,
} from './types/tire';
export type {
  Workshop,
  WorkshopAccount,
  WorkshopPartnership,
  WorkshopInvitation,
  WorkshopScheduleStatus,
  WorkshopSchedule,
} from './types/workshop';
export type { Shipper, OperationalUnit } from './types/shipper';
export type {
  TireInspectionStatus,
  TireInspectionResponseStatus,
  TireInspection,
  TireInspectionResponse,
} from './types/tireInspection';
