-- Migration: Add axle_config and steps_count to vehicles table
-- Purpose: Store detailed per-axle configuration (type + rodagem) for tire management

-- Add axle_config JSONB column to store AxleConfigEntry[] array
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS axle_config JSONB DEFAULT NULL;

-- Add steps_count for factory-configured spare tire slots
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS steps_count INTEGER DEFAULT NULL;

-- Update position_type CHECK constraint in tires table to support triple rodagem
-- Triple rodagem adds 3 tire positions per side: internal, middle, external
ALTER TABLE public.tires DROP CONSTRAINT IF EXISTS tires_position_type_check;
ALTER TABLE public.tires ADD CONSTRAINT tires_position_type_check
  CHECK (position_type IN (
    'single',
    'dual_external',
    'dual_internal',
    'triple_external',
    'triple_middle',
    'triple_internal',
    'spare'
  ));
