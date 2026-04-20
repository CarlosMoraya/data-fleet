// ─── Embarcadores e Unidades Operacionais ─────────────────────────────────────

export interface Shipper {
  id: string;
  clientId: string;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  notes?: string;
  active: boolean;
}

export interface OperationalUnit {
  id: string;
  clientId: string;
  shipperId: string;       // FK obrigatória → Shipper
  shipperName?: string;    // from JOIN
  name: string;
  code?: string;
  city?: string;
  state?: string;
  notes?: string;
  active: boolean;
}
