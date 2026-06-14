-- Adiciona a data real de vencimento do CRLV ao cadastro de veículos.
-- Aditiva, nullable, sem backfill (veículos existentes permanecem NULL).
-- A coluna herda o RLS existente da tabela vehicles (client_id + Admin Master).
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS crlv_expiration_date DATE DEFAULT NULL;