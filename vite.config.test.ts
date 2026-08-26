import { describe, expect, it } from 'vitest';

import { pwaOptions } from './vite.config';

describe('pwaOptions', () => {
  it('mantém a atualização do Service Worker sob decisão do usuário', () => {
    expect(pwaOptions.registerType).toBe('prompt');
    expect(pwaOptions.workbox.skipWaiting).toBe(false);
    expect(pwaOptions.workbox.clientsClaim).toBe(false);
    expect(pwaOptions.injectRegister).toBeNull();
  });

  it('preserva o precache e mantém o Service Worker desligado em desenvolvimento', () => {
    expect(pwaOptions.workbox.cleanupOutdatedCaches).toBe(true);
    expect(pwaOptions.devOptions.enabled).toBe(false);
  });
});
