// ─── Barrel export de todos os tipos ──────────────────────────────────────────

export type { Role } from './role';
export type { User, Client } from './user';
export type { Vehicle, VehicleFieldSettings, VehicleKmInterval } from './vehicle';
export type { Driver, DriverFieldSettings } from './driver';
export type {
  MaintenanceStatus,
  MaintenanceType,
  BudgetStatus,
  MaintenanceOrder,
  BudgetItem,
  MaintenanceOrderRow,
  MaintenanceBudgetItemRow,
  MaintenanceOrderDashboard,
} from './maintenance';
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
} from './checklist';
export { WORKSHOP_CONTEXTS } from './checklist';
export type {
  TireVisualClassification,
  TirePositionType,
  AxleType,
  RodagemType,
  AxleConfigEntry,
  Tire,
  TirePositionHistory,
  VehicleTireConfig,
} from './tire';
export type {
  Workshop,
  WorkshopAccount,
  WorkshopPartnership,
  WorkshopInvitation,
  WorkshopScheduleStatus,
  WorkshopSchedule,
} from './workshop';
export type { Shipper, OperationalUnit } from './shipper';
export type {
  TireInspectionStatus,
  TireInspectionResponseStatus,
  TireInspection,
  TireInspectionResponse,
} from './tireInspection';
