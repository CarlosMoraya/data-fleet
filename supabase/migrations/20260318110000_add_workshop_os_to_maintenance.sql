-- Add workshop_os_number column to maintenance_orders
-- This field stores the OS number provided by the external workshop/supplier
-- The internal os_number is auto-generated and immutable
ALTER TABLE maintenance_orders
  ADD COLUMN IF NOT EXISTS workshop_os_number VARCHAR(100) NULL;
