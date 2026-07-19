// ─── Pagamentos Extras / Serviços Avulsos (módulo financeiro) ───────────────

export type ExtraPaymentCategory =
  | 'guincho'
  | 'borracheiro'
  | 'chaveiro'
  | 'uber'
  | 'taxi'
  | 'frete_apoio'
  | 'outro';

export type ExtraPaymentStatus = 'pendente_aprovacao' | 'aprovado' | 'reprovado' | 'pago' | 'cancelado';

export interface ExtraPaymentRequest {
  id: string;
  clientId: string;
  requestNumber: string;
  category: ExtraPaymentCategory;
  serviceDate: string;
  supplierName: string;
  supplierDocument?: string;
  vehicleId?: string;
  driverId?: string;
  amount: number;
  description?: string;
  justification?: string;
  notes?: string;
  receiptUrl?: string;
  invoiceUrl?: string;
  evidenceUrls?: string[];
  status: ExtraPaymentStatus;
  createdById: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  paidBy?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joins (populated via select with relations)
  vehicleLicensePlate?: string;
  driverName?: string;
  approvedByName?: string;
}

export interface ExtraPaymentRequestRow {
  id: string;
  client_id: string;
  request_number: string;
  category: ExtraPaymentCategory;
  service_date: string;
  supplier_name: string;
  supplier_document: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  amount: number;
  description: string | null;
  justification: string | null;
  notes: string | null;
  receipt_url: string | null;
  invoice_url: string | null;
  evidence_urls: string[] | null;
  status: ExtraPaymentStatus;
  created_by_id: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  vehicles?: { license_plate: string } | null;
  drivers?: { name: string } | null;
  approver?: { name: string } | null;
}

export interface ExtraPaymentAuditors {
  createdByName?: string;
  approvedByName?: string;
  rejectedByName?: string;
  paidByName?: string;
}

export interface ExtraPaymentFormInput {
  category: ExtraPaymentCategory;
  serviceDate: string;
  supplierName: string;
  supplierDocument?: string;
  vehicleId?: string;
  driverId?: string;
  amount: number;
  description?: string;
  justification?: string;
  notes?: string;
  receiptUrl?: string;
  invoiceUrl?: string;
  evidenceUrls?: string[];
}

export interface ExtraPaymentVehicleOption {
  id: string;
  licensePlate: string;
  driverId?: string;
  driverName?: string;
}

export interface ExtraPaymentDriverOption {
  id: string;
  name: string;
  vehicleId?: string;
  vehicleLicensePlate?: string;
}
