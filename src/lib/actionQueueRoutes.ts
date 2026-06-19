import type { ActionItem } from './dashboardKpi';

export const VEHICLE_PENDENCY_ACTION_ROUTES = {
  checklist: '/cadastros/veiculos?pendencia=checklist_vencido',
  crlv: '/cadastros/veiculos?pendencia=crlv_vencido',
  crlv_expiring: '/cadastros/veiculos?pendencia=crlv_a_vencer',
  gr_vehicle_expiring: '/cadastros/veiculos?pendencia=gr_a_vencer',
} as const;

export const GENERAL_ACTION_ROUTES: Record<ActionItem['category'], string> = {
  ...VEHICLE_PENDENCY_ACTION_ROUTES,
  cnh: '/cadastros/motoristas?situacao=cnh_vencida',
  cnh_expiring: '/cadastros/motoristas?situacao=cnh_a_vencer',
  os_overdue: '/manutencao',
  os_pending_approval: '/manutencao',
  gr_driver_expiring: '/cadastros/motoristas?situacao=gr_a_vencer',
};

export const OPERATIONAL_ACTION_ROUTES: Record<ActionItem['category'], string> = {
  ...VEHICLE_PENDENCY_ACTION_ROUTES,
  cnh: '/cadastros/motoristas?situacao=cnh_vencida',
  cnh_expiring: '/cadastros/motoristas?situacao=cnh_a_vencer',
  os_overdue: '/manutencao',
  os_pending_approval: '/aprovacao-orcamentos',
  gr_driver_expiring: '/cadastros/motoristas?situacao=gr_a_vencer',
};
