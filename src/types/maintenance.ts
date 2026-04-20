// ─── Manutenção ───────────────────────────────────────────────────────────────

export type MaintenanceStatus = 'Aguardando orçamento' | 'Aguardando aprovação' | 'Orçamento aprovado' | 'Serviço em execução' | 'Concluído' | 'Cancelado';
export type MaintenanceType = 'Preventiva' | 'Preditiva' | 'Corretiva';
export type BudgetStatus = 'sem_orcamento' | 'pendente' | 'aprovado' | 'reprovado';

export interface MaintenanceOrder {
  id: string;
  os: string;
  licensePlate: string;
  workshop: string;
  vehicleId: string;
  workshopId: string;
  entryDate: string;
  expectedExitDate: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string;
  mechanicName: string;
  estimatedCost: number;
  approvedCost?: number;
  createdBy: string;
  createdAt: string;
  notes?: string;
  workshopOs?: string;
  currentKm?: number;
  budgetPdfUrl?: string;
  budgetStatus?: BudgetStatus;
  budgetReviewedBy?: string;
  budgetReviewedAt?: string;
  cancelledAt?: string;
  cancelledById?: string;
  clientName?: string; // Populado quando Workshop vê múltiplas transportadoras
  clientId?: string;   // client_id da OS; necessário para Workshop no modo "Todos os Clientes"
}

export interface BudgetItem {
  id?: string;
  maintenanceOrderId?: string;
  clientId?: string;
  itemName: string;
  system: string;
  quantity: number;
  value: number;
  sortOrder: number;
}

// Row types for Supabase queries (snake_case)

export interface MaintenanceOrderRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  workshop_id: string;
  os_number: string;
  entry_date: string;
  expected_exit_date: string | null;
  actual_exit_date: string | null;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string | null;
  mechanic_name: string | null;
  estimated_cost: number;
  approved_cost: number | null;
  created_by_id: string;
  notes: string | null;
  workshop_os_number: string | null;
  current_km: number | null;
  budget_pdf_url: string | null;
  budget_status: BudgetStatus | null;
  budget_reviewed_by: string | null;
  budget_reviewed_at: string | null;
  cancelled_at: string | null;
  cancelled_by_id: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  vehicles?: { license_plate: string };
  workshops?: { name: string };
  profiles?: { name: string };
  budget_reviewer?: { name: string };
  clients?: { name: string };
}

export interface MaintenanceBudgetItemRow {
  id: string;
  maintenance_order_id: string;
  client_id: string;
  item_name: string;
  system: string | null;
  quantity: number;
  value: number;
  sort_order: number;
  created_at: string;
}

// Dashboard-specific types

export interface MaintenanceOrderDashboard {
  id: string;
  vehicle_id: string;
  type: 'Corretiva' | 'Preventiva' | 'Preditiva';
  status: string;
  approved_cost: number | null;
  current_km: number | null;
  vehicle_type: string | null;
}
