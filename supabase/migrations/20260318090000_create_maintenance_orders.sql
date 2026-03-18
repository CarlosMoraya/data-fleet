-- Create maintenance_orders table
CREATE TABLE public.maintenance_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE RESTRICT,
  os_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_exit_date DATE,
  actual_exit_date DATE,
  type TEXT NOT NULL CHECK (type IN ('Preventiva', 'Preditiva', 'Corretiva')),
  status TEXT NOT NULL CHECK (status IN ('Aguardando orçamento', 'Orçamento aprovado', 'Serviço em execução', 'Concluído')),
  description TEXT,
  mechanic_name TEXT,
  estimated_cost NUMERIC(12,2) DEFAULT 0,
  approved_cost NUMERIC(12,2) DEFAULT 0,
  created_by_id UUID NOT NULL REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure OS number is unique per client
  UNIQUE (client_id, os_number)
);

-- Enable RLS
ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;

-- Post-join performance index
CREATE INDEX idx_maintenance_orders_client_status ON public.maintenance_orders(client_id, status);
CREATE INDEX idx_maintenance_orders_vehicle ON public.maintenance_orders(vehicle_id);

-- RLS Policies
CREATE POLICY "tenant_assistant_read_maintenance" ON public.maintenance_orders
  FOR SELECT TO authenticated
  USING (
    (SELECT public.role_rank(role) FROM profiles WHERE id = auth.uid()) >= 3 -- Fleet Assistant+
    AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "tenant_assistant_write_maintenance" ON public.maintenance_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.role_rank(role) FROM profiles WHERE id = auth.uid()) >= 3 -- Fleet Assistant+
    AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "tenant_assistant_update_maintenance" ON public.maintenance_orders
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.role_rank(role) FROM profiles WHERE id = auth.uid()) >= 3 -- Fleet Assistant+
    AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT public.role_rank(role) FROM profiles WHERE id = auth.uid()) >= 3 -- Fleet Assistant+
  );

CREATE POLICY "tenant_manager_delete_maintenance" ON public.maintenance_orders
  FOR DELETE TO authenticated
  USING (
    (SELECT public.role_rank(role) FROM profiles WHERE id = auth.uid()) >= 5 -- Manager+
    AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER set_maintenance_updated_at
  BEFORE UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
