import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { offlineDb } from './offlineDb';
import {
  clearVehicleDraftFiles,
  loadVehicleDraftFiles,
  removeVehicleDraftFile,
  saveVehicleDraftFile,
} from './vehicleDraftFiles';

describe('vehicleDraftFiles', () => {
  beforeEach(async () => {
    await clearVehicleDraftFiles();
  });

  it('saves and loads a file with the same metadata and content', async () => {
    const file = new File(['document-content'], 'crlv.pdf', { type: 'application/pdf' });

    await saveVehicleDraftFile('crlv', file);
    const files = await loadVehicleDraftFiles();

    expect(files.crlv).toBeInstanceOf(File);
    expect(files.crlv?.name).toBe('crlv.pdf');
    expect(files.crlv?.type).toBe('application/pdf');
    expect(await files.crlv?.text()).toBe('document-content');
  });

  it('overwrites the same key instead of duplicating entries', async () => {
    const firstFile = new File(['first'], 'first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['second'], 'second.pdf', { type: 'application/pdf' });

    await saveVehicleDraftFile('crlv', firstFile);
    await saveVehicleDraftFile('crlv', secondFile);

    const files = await loadVehicleDraftFiles();
    const rows = await offlineDb.vehicleDraftFiles.toArray();

    expect(rows).toHaveLength(1);
    expect(files.crlv?.name).toBe('second.pdf');
    expect(await files.crlv?.text()).toBe('second');
  });

  it('removes only the requested key', async () => {
    const crlvFile = new File(['crlv'], 'crlv.pdf', { type: 'application/pdf' });
    const grFile = new File(['gr'], 'gr.pdf', { type: 'application/pdf' });

    await saveVehicleDraftFile('crlv', crlvFile);
    await saveVehicleDraftFile('gr', grFile);
    await removeVehicleDraftFile('crlv');

    const files = await loadVehicleDraftFiles();

    expect(files.crlv).toBeUndefined();
    expect(files.gr?.name).toBe('gr.pdf');
  });

  it('clears all stored draft files', async () => {
    await saveVehicleDraftFile('crlv', new File(['crlv'], 'crlv.pdf', { type: 'application/pdf' }));
    await saveVehicleDraftFile('gr', new File(['gr'], 'gr.pdf', { type: 'application/pdf' }));

    await clearVehicleDraftFiles();

    await expect(loadVehicleDraftFiles()).resolves.toEqual({});
  });
});
