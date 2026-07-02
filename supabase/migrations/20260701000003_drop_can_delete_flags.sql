-- ⚠️ Só executar após: RLS da Etapa 3 aplicada, edge functions redeployadas,
--    e grep de can_delete_* limpo no código.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS can_delete_vehicles,
  DROP COLUMN IF EXISTS can_delete_drivers,
  DROP COLUMN IF EXISTS can_delete_workshops;
