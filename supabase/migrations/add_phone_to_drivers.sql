-- Adiciona telefone de contato ao cadastro de motoristas
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL;
