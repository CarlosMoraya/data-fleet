-- ============================================================
-- MIGRATION: schedule_veloe_fuel_sync
-- Descrição: agenda a sincronização diária do módulo de
--   Abastecimento chamando a Edge Function `veloe-fuel-sync`.
--
-- Horário: 06:00 UTC = 03:00 de Brasília — fora do horário
-- operacional da frota.
--
-- ⚠️ PASSO MANUAL OBRIGATÓRIO ANTES DE APLICAR (SQL Editor,
-- não versionado — a service_role key nunca entra no Git):
--
--   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'veloe_sync_service_key');
--   SELECT vault.create_secret('https://vvbnbzzhpiksacqudmfu.supabase.co', 'veloe_sync_project_url');
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('veloe-fuel-sync-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'veloe-fuel-sync-daily');

SELECT cron.schedule(
  'veloe-fuel-sync-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'veloe_sync_project_url') || '/functions/v1/veloe-fuel-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets
                                     WHERE name = 'veloe_sync_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
