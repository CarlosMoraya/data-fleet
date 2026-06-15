import type { ActionItem } from './dashboardKpi';

export const OPERATIONAL_ACTION_ROUTES: Record<ActionItem['category'], string> = {
  checklist: '/checklists',
  crlv: '/cadastros/veiculos',
  crlv_expiring: '/cadastros/veiculos',
  cnh: '/cadastros/motoristas',
  cnh_expiring: '/cadastros/motoristas',
  os_overdue: '/manutencao',
  os_pending_approval: '/aprovacao-orcamentos',
  gr_vehicle_expiring: '/cadastros/veiculos',
  gr_driver_expiring: '/cadastros/motoristas',
};
