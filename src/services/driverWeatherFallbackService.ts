import { supabase } from '../lib/supabase';

import { geocodeCityState } from './weatherService';

import type { WeatherCoordinates } from '../types/weather';

interface DriverRow {
  id: string;
  client_id: string;
}

interface OperationalUnitRow {
  city: string | null;
  state: string | null;
}

interface VehicleRow {
  id: string;
  operational_unit_id: string | null;
  operational_units: OperationalUnitRow | null;
}

export async function resolveDriverWeatherFallbackCoordinates(input: {
  profileId: string;
  clientId: string;
}): Promise<{ coordinates: WeatherCoordinates; locationLabel: string } | null> {
  try {
    const driverResult = await supabase
      .from('drivers')
      .select('id, client_id')
      .eq('profile_id', input.profileId)
      .eq('client_id', input.clientId)
      .maybeSingle();
    const driver = driverResult.data as DriverRow | null;
    if (driverResult.error || !driver) return null;

    const vehicleResult = await supabase
      .from('vehicles')
      .select('id, operational_unit_id, operational_units(city, state)')
      .eq('driver_id', driver.id)
      .eq('client_id', driver.client_id)
      .maybeSingle();
    const vehicle = vehicleResult.data as unknown as VehicleRow | null;
    const unit = vehicle?.operational_units;
    if (vehicleResult.error || !vehicle || !unit?.city?.trim()) return null;

    const city = unit.city.trim();
    const state = unit.state?.trim() || null;
    const coordinates = await geocodeCityState({ city, state });
    if (!coordinates) return null;

    return { coordinates, locationLabel: state ? `${city}/${state}` : city };
  } catch {
    return null;
  }
}
