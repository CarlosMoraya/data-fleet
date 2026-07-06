import { afterEach, describe, expect, it, vi } from 'vitest';

import { capturePosition } from './geolocation';

describe('capturePosition', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves captured with coordinates on success', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: { latitude: -23.5, longitude: -46.6 },
          } as GeolocationPosition);
        },
      },
    });

    await expect(capturePosition()).resolves.toEqual({
      latitude: -23.5,
      longitude: -46.6,
      status: 'captured',
    });
  });

  it('resolves denied when permission is refused', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback,
        ) => {
          error({ code: 1 } as GeolocationPositionError);
        },
      },
    });

    await expect(capturePosition()).resolves.toEqual({
      latitude: null,
      longitude: null,
      status: 'denied',
    });
  });

  it('resolves unavailable when position is unavailable or times out', async () => {
    for (const code of [2, 3]) {
      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: (
            _success: PositionCallback,
            error: PositionErrorCallback,
          ) => {
            error({ code } as GeolocationPositionError);
          },
        },
      });

      await expect(capturePosition()).resolves.toEqual({
        latitude: null,
        longitude: null,
        status: 'unavailable',
      });
    }
  });

  it('resolves unavailable when geolocation API does not exist', async () => {
    vi.stubGlobal('navigator', {});

    await expect(capturePosition()).resolves.toEqual({
      latitude: null,
      longitude: null,
      status: 'unavailable',
    });
  });
});
