import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { capturePosition } from '../lib/geolocation';
import { resolveDriverWeatherFallbackCoordinates } from '../services/driverWeatherFallbackService';
import { fetchWeatherForecast } from '../services/weatherService';

import { useOnlineStatus } from './useOnlineStatus';

import type { LocationCapture } from '../lib/geolocation';
import type { LocalWeatherResult, WeatherForecast, WeatherLocationSource } from '../types/weather';

type PermissionResult = PermissionState | 'unsupported';

interface WeatherLocation {
  source: WeatherLocationSource;
  latitude: number;
  longitude: number;
  locationLabel: string;
}

async function getGeolocationPermissionState(): Promise<PermissionResult> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unsupported';

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return permission.state;
  } catch {
    return 'unsupported';
  }
}

function shouldUseDriverFallback(userRole: string | undefined, status: LocationCapture['status'] | null): boolean {
  return userRole === 'Driver' && (status === 'denied' || status === 'unavailable');
}

export function useLocalWeather(): LocalWeatherResult {
  const { user, currentClient } = useAuth();
  const isOnline = useOnlineStatus();
  const [permissionState, setPermissionState] = useState<PermissionResult | null>(null);
  const [permissionRequestCount, setPermissionRequestCount] = useState(0);
  const [captureStatus, setCaptureStatus] = useState<LocationCapture['status'] | null>(null);
  const [location, setLocation] = useState<WeatherLocation | null>(null);

  useEffect(() => {
    if (!isOnline || !user) return;

    let active = true;
    void getGeolocationPermissionState().then((state) => {
      if (!active) return;
      setPermissionState(state);
      if (state === 'denied') setCaptureStatus('denied');
    });

    return () => {
      active = false;
    };
  }, [isOnline, user]);

  useEffect(() => {
    if (!isOnline || !user || (permissionState !== 'granted' && permissionRequestCount === 0)) return;

    let active = true;
    void capturePosition().then((capture) => {
      if (!active) return;

      const captured = capture.status === 'captured' && capture.latitude !== null && capture.longitude !== null;
      setCaptureStatus(captured ? 'captured' : capture.status === 'captured' ? 'unavailable' : capture.status);
      if (captured) {
        setLocation({
          source: 'browser',
          latitude: capture.latitude,
          longitude: capture.longitude,
          locationLabel: 'Sua localização',
        });
      } else {
        setLocation(null);
      }
    });

    return () => {
      active = false;
    };
  }, [isOnline, permissionRequestCount, permissionState, user]);

  const fallbackEnabled =
    isOnline &&
    !!user &&
    !!currentClient?.id &&
    shouldUseDriverFallback(user.role, captureStatus);
  const fallbackQuery = useQuery({
    queryKey: ['driverWeatherFallbackCoordinates', user?.id, currentClient?.id],
    queryFn: () => resolveDriverWeatherFallbackCoordinates({ profileId: user?.id ?? '', clientId: currentClient?.id ?? '' }),
    enabled: fallbackEnabled,
    retry: false,
  });

  useEffect(() => {
    if (!fallbackQuery.data) return;
    setLocation({
      source: 'driver-operational-unit',
      latitude: fallbackQuery.data.coordinates.latitude,
      longitude: fallbackQuery.data.coordinates.longitude,
      locationLabel: fallbackQuery.data.locationLabel,
    });
  }, [fallbackQuery.data]);

  const forecastQuery = useQuery<WeatherForecast, Error>({
    queryKey: [
      'localWeatherForecast',
      location?.source ?? 'browser',
      location?.latitude ?? null,
      location?.longitude ?? null,
    ],
    queryFn: () => {
      if (!location) throw new Error('WEATHER_LOCATION_UNAVAILABLE');
      return fetchWeatherForecast({
        source: location.source,
        latitude: location.latitude,
        longitude: location.longitude,
        locationLabel: location.locationLabel,
      });
    },
    enabled: isOnline && !!user && !!location,
    retry: false,
  });

  const requestPermission = useCallback(() => {
    setPermissionRequestCount((count) => count + 1);
  }, []);

  if (!isOnline || !user) {
    return { status: 'hidden', forecast: null, error: null, requestPermission };
  }
  if (forecastQuery.error) {
    return { status: 'error', forecast: null, error: forecastQuery.error, requestPermission };
  }
  if (forecastQuery.data) {
    return { status: 'ready', forecast: forecastQuery.data, error: null, requestPermission };
  }
  if (location || (fallbackEnabled && fallbackQuery.isPending)) {
    return { status: 'loading', forecast: null, error: null, requestPermission };
  }
  if (captureStatus && shouldUseDriverFallback(user.role, captureStatus) && currentClient?.id) {
    return { status: fallbackQuery.isPending ? 'loading' : 'hidden', forecast: null, error: null, requestPermission };
  }
  if (captureStatus === 'denied' || captureStatus === 'unavailable') {
    return { status: 'hidden', forecast: null, error: null, requestPermission };
  }
  if (permissionState === null) {
    return { status: 'loading', forecast: null, error: null, requestPermission };
  }
  if (permissionState === 'prompt' || permissionState === 'unsupported') {
    return { status: 'needsPermission', forecast: null, error: null, requestPermission };
  }
  return { status: 'hidden', forecast: null, error: null, requestPermission };
}
