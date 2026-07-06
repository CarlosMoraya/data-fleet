import type { ChecklistLocationStatus } from '../types';

export interface LocationCapture {
  latitude: number | null;
  longitude: number | null;
  status: ChecklistLocationStatus;
}

export function capturePosition(): Promise<LocationCapture> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null, status: 'unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          status: 'captured',
        });
      },
      (error) => {
        if (error.code === 1) {
          resolve({ latitude: null, longitude: null, status: 'denied' });
        } else {
          resolve({ latitude: null, longitude: null, status: 'unavailable' });
        }
      },
      { timeout: 8000 },
    );
  });
}
