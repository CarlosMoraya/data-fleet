import type { ActionItem } from './dashboardKpi';

export const VEHICLE_PENDENCY_ACTION_ROUTES = {
  checklist: '/cadastros/veiculos?issue=checklist_overdue',
  crlv: '/cadastros/veiculos?issue=crlv_expired',
  crlv_expiring: '/cadastros/veiculos?issue=crlv_expiring',
  gr_vehicle_expiring: '/cadastros/veiculos?issue=gr_expiring',
} as const;

export const GENERAL_ACTION_ROUTES: Record<ActionItem['category'], string> = {
  ...VEHICLE_PENDENCY_ACTION_ROUTES,
  cnh: '/cadastros/motoristas?issue=cnh_expired',
  cnh_expiring: '/cadastros/motoristas?issue=cnh_expiring',
  os_overdue: '/manutencao',
  os_pending_approval: '/manutencao',
  gr_driver_expiring: '/cadastros/motoristas?issue=gr_expiring',
};

export const OPERATIONAL_ACTION_ROUTES: Record<ActionItem['category'], string> = {
  ...VEHICLE_PENDENCY_ACTION_ROUTES,
  cnh: '/cadastros/motoristas?issue=cnh_expired',
  cnh_expiring: '/cadastros/motoristas?issue=cnh_expiring',
  os_overdue: '/manutencao',
  os_pending_approval: '/aprovacao-orcamentos',
  gr_driver_expiring: '/cadastros/motoristas?issue=gr_expiring',
};
