export type FleetTicketSource = 'sos' | 'report';
export type FleetTicketSosType = 'breakdown' | 'collision' | 'theft';
export type FleetTicketCriticality = 'critical' | 'high' | 'medium' | 'low';
export type FleetTicketStatus = 'open' | 'in_analysis' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
export type FleetTicketLocationStatus = 'captured' | 'denied' | 'unavailable' | 'manual';
export type FleetTicketCardFilter = 'sos' | 'unclassified' | 'critical' | 'high' | 'medium' | 'low' | 'all';
export type FleetTicketEventType =
  | 'created'
  | 'attachments_added'
  | 'classified'
  | 'assigned'
  | 'status_changed'
  | 'telegram_sent'
  | 'telegram_failed';

export interface FleetTicket {
  id: string;
  clientId: string;
  source: FleetTicketSource;
  openedBy: string;
  openedByRole: string;
  openedByNameSnapshot: string;
  driverId?: string;
  driverNameSnapshot?: string;
  vehicleId: string;
  vehicleLicensePlateSnapshot: string;
  sosType?: FleetTicketSosType;
  title: string;
  description?: string;
  criticality?: FleetTicketCriticality;
  classifiedBy?: string;
  classifiedByNameSnapshot?: string;
  classifiedAt?: string;
  status: FleetTicketStatus;
  assignedTo?: string;
  assignedToNameSnapshot?: string;
  assignedAt?: string;
  resolvedBy?: string;
  resolvedByNameSnapshot?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  latitude?: number;
  longitude?: number;
  locationStatus?: FleetTicketLocationStatus;
  locationText?: string;
  attachmentPaths: string[];
  telegramNotifiedAt?: string;
  telegramLastError?: string;
  createdAt: string;
  updatedAt: string;
  ticketNumber?: string;
  odometerKm?: number;
  vehicleModelSnapshot?: string;
  vehicleOwnerSnapshot?: string;
  shipperNameSnapshot?: string;
  operationalUnitNameSnapshot?: string;
}

export interface FleetTicketEvent {
  id: string;
  clientId: string;
  ticketId: string;
  eventType: FleetTicketEventType;
  actorId?: string;
  actorNameSnapshot?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ClientTelegramSettings {
  clientId: string;
  enabled: boolean;
  chatId: string;
  notifySos: boolean;
  notifyCritical: boolean;
  notifyHigh: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface FleetTicketCounts {
  sos: number;
  unclassified: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  all: number;
}

export interface CreateSosTicketInput {
  clientId: string;
  vehicleId: string;
  sosType: FleetTicketSosType;
  description: string;
  locationText?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationStatus: FleetTicketLocationStatus;
  files?: File[];
  odometerKm: number;
}

export interface CreateFleetTicketReportInput {
  clientId: string;
  vehicleId: string;
  title: string;
  description: string;
  files?: File[];
  odometerKm: number;
  criticality: FleetTicketCriticality;
}
