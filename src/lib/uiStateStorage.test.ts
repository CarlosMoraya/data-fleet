import { describe, it, expect, beforeEach } from 'vitest';

import {
  buildUiStateKey,
  safeParseJson,
  readUiState,
  writeUiState,
  removeUiState,
  removeUiStateByPrefix,
  sanitizeDraft,
  clearCurrentUserUiState,

} from './uiStateStorage';

const mockStorage = (): Storage => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    clear: () => { store = {}; },
  };
};

describe('buildUiStateKey', () => {
  it('builds key with all fields', () => {
    const key = buildUiStateKey({
      scope: 'session',
      userId: 'user-1',
      clientId: 'client-1',
      module: 'vehicles',
      stateKind: 'filter',
      name: 'search',
    });
    expect(key).toBe('bf:v1:ui:session:user-1:client-1:vehicles:filter:search');
  });

  it('uses all-clients for null clientId', () => {
    const key = buildUiStateKey({
      scope: 'session',
      userId: 'user-1',
      clientId: null,
      module: 'checklists',
      stateKind: 'tab',
      name: 'active',
    });
    expect(key).toBe('bf:v1:ui:session:user-1:all-clients:checklists:tab:active');
  });

  it('builds preference key', () => {
    const key = buildUiStateKey({
      scope: 'preference',
      userId: 'user-123',
      clientId: 'client-456',
      module: 'dashboard',
      stateKind: 'filter',
      name: 'date-range',
    });
    expect(key).toBe('bf:v1:ui:preference:user-123:client-456:dashboard:filter:date-range');
  });

  it('builds draft key', () => {
    const key = buildUiStateKey({
      scope: 'draft',
      userId: 'user-1',
      clientId: 'client-1',
      module: 'vehicles',
      stateKind: 'draft',
      name: 'form',
    });
    expect(key).toBe('bf:v1:ui:draft:user-1:client-1:vehicles:draft:form');
  });
});

describe('safeParseJson', () => {
  it('returns fallback for null', () => {
    expect(safeParseJson(null, 'fallback')).toBe('fallback');
  });

  it('parses valid JSON', () => {
    expect(safeParseJson('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeParseJson('{invalid', 'fallback')).toBe('fallback');
  });

  it('parses string values', () => {
    expect(safeParseJson('"hello"', '')).toBe('hello');
  });

  it('parses boolean values', () => {
    expect(safeParseJson('true', false)).toBe(true);
  });
});

describe('readUiState', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it('returns fallback when key not found', () => {
    expect(readUiState(storage, 'bf:v1:ui:session:u:c:m:f:n', 'default')).toBe('default');
  });

  it('reads stored value', () => {
    storage.setItem('bf:v1:ui:session:u:c:m:f:n', JSON.stringify('hello'));
    expect(readUiState<string>(storage, 'bf:v1:ui:session:u:c:m:f:n', 'default')).toBe('hello');
  });

  it('returns fallback for invalid JSON', () => {
    storage.setItem('bf:v1:ui:session:u:c:m:f:n', '{bad');
    expect(readUiState(storage, 'bf:v1:ui:session:u:c:m:f:n', 'default')).toBe('default');
  });

  it('validates with custom validator', () => {
    storage.setItem('bf:v1:ui:session:u:c:m:f:n', JSON.stringify('invalid'));
    const validator = (v: unknown): v is 'valid' => v === 'valid';
    expect(readUiState<'valid'>(storage, 'bf:v1:ui:session:u:c:m:f:n', 'valid', { validator })).toBe('valid');
  });

  it('accepts value that passes validator', () => {
    storage.setItem('bf:v1:ui:session:u:c:m:f:n', JSON.stringify('valid'));
    const validator = (v: unknown): v is 'valid' => v === 'valid';
    expect(readUiState<'valid'>(storage, 'bf:v1:ui:session:u:c:m:f:n', 'valid', { validator })).toBe('valid');
  });

  it('migrates from legacy key when new key does not exist', () => {
    storage.setItem('legacyKey', JSON.stringify('migrated'));
    const result = readUiState<string>(storage, 'bf:v1:ui:session:u:c:m:f:n', 'default', {
      legacyKeys: ['legacyKey'],
    });
    expect(result).toBe('migrated');
    expect(storage.getItem('bf:v1:ui:session:u:c:m:f:n')).toBe(JSON.stringify('migrated'));
    expect(storage.getItem('legacyKey')).toBeNull();
  });

  it('does not migrate when new key exists', () => {
    storage.setItem('bf:v1:ui:session:u:c:m:f:n', JSON.stringify('new'));
    storage.setItem('legacyKey', JSON.stringify('old'));
    const result = readUiState<string>(storage, 'bf:v1:ui:session:u:c:m:f:n', 'default', {
      legacyKeys: ['legacyKey'],
    });
    expect(result).toBe('new');
    expect(storage.getItem('legacyKey')).toBe(JSON.stringify('old'));
  });

  it('tries multiple legacy keys in order', () => {
    storage.setItem('legacy2', JSON.stringify('second'));
    const result = readUiState<string>(storage, 'bf:v1:ui:session:u:c:m:f:n', 'default', {
      legacyKeys: ['legacy1', 'legacy2'],
    });
    expect(result).toBe('second');
  });
});

describe('writeUiState', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it('writes value to storage', () => {
    writeUiState(storage, 'testKey', { a: 1 }, { a: 0 });
    expect(storage.getItem('testKey')).toBe(JSON.stringify({ a: 1 }));
  });

  it('removes key when value equals default and removeOnDefault is true', () => {
    storage.setItem('testKey', 'old');
    writeUiState(storage, 'testKey', 'default', 'default', { removeOnDefault: true });
    expect(storage.getItem('testKey')).toBeNull();
  });

  it('removes key when value equals default by default', () => {
    storage.setItem('testKey', 'old');
    writeUiState(storage, 'testKey', 'default', 'default');
    expect(storage.getItem('testKey')).toBeNull();
  });

  it('keeps key when value equals default and removeOnDefault is false', () => {
    writeUiState(storage, 'testKey', 'default', 'default', { removeOnDefault: false });
    expect(storage.getItem('testKey')).toBe(JSON.stringify('default'));
  });

  it('removes legacy keys when specified', () => {
    storage.setItem('legacyKey1', 'old1');
    storage.setItem('legacyKey2', 'old2');
    writeUiState(storage, 'testKey', 'value', 'default', { removeLegacyKeys: ['legacyKey1', 'legacyKey2'] });
    expect(storage.getItem('legacyKey1')).toBeNull();
    expect(storage.getItem('legacyKey2')).toBeNull();
  });
});

describe('removeUiState', () => {
  it('removes key from storage', () => {
    const storage = mockStorage();
    storage.setItem('testKey', 'value');
    removeUiState(storage, 'testKey');
    expect(storage.getItem('testKey')).toBeNull();
  });
});

describe('removeUiStateByPrefix', () => {
  it('removes only keys with matching prefix', () => {
    const storage = mockStorage();
    storage.setItem('bf:v1:ui:session:user1:client1:vehicles:filter:search', 'search');
    storage.setItem('bf:v1:ui:session:user1:client1:vehicles:modal:form-open', 'true');
    storage.setItem('bf:v1:ui:session:user2:client1:vehicles:filter:search', 'other');
    storage.setItem('otherKey', 'keep');
    removeUiStateByPrefix(storage, 'bf:v1:ui:session:user1:');
    expect(storage.getItem('bf:v1:ui:session:user1:client1:vehicles:filter:search')).toBeNull();
    expect(storage.getItem('bf:v1:ui:session:user1:client1:vehicles:modal:form-open')).toBeNull();
    expect(storage.getItem('bf:v1:ui:session:user2:client1:vehicles:filter:search')).toBe('other');
    expect(storage.getItem('otherKey')).toBe('keep');
  });
});

describe('sanitizeDraft', () => {
  it('allows only fields in the module allowlist for vehicles', () => {
    const sanitized = sanitizeDraft('vehicles', {
      plate: 'ABC1234',
      brand: 'Toyota',
      renavam: '12345678901',
      password: 'secret',
      cpf: '12345678901',
      chassi: 'ABCDEFGH12345678',
    });
    expect(sanitized).toHaveProperty('plate');
    expect(sanitized).toHaveProperty('brand');
    expect(sanitized).toHaveProperty('renavam');
    expect(sanitized).not.toHaveProperty('password');
    expect(sanitized).not.toHaveProperty('cpf');
  });

  it('filters out sensitive fields regardless of module', () => {
    const sanitized = sanitizeDraft('drivers', {
      name: 'John',
      password: 'secret123',
      cpf: '12345678901',
      cnh: '98765432100',
    });
    expect(sanitized).toHaveProperty('name');
    expect(sanitized).not.toHaveProperty('password');
    expect(sanitized).not.toHaveProperty('cpf');
    expect(sanitized).not.toHaveProperty('cnh');
  });

  it('returns empty object for unknown module', () => {
    const sanitized = sanitizeDraft('unknown', { foo: 'bar' });
    expect(sanitized).toEqual({});
  });

  it('filters out File and Blob values', () => {
    const sanitized = sanitizeDraft('vehicles', {
      plate: 'ABC1234',
      document: new File([''], 'test.pdf'),
    });
    expect(sanitized).toHaveProperty('plate');
    expect(sanitized).not.toHaveProperty('document');
  });
});

describe('clearCurrentUserUiState', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('removes session and draft keys for user from sessionStorage', () => {
    window.sessionStorage.setItem('bf:v1:ui:session:user1:client1:vehicles:filter:search', 'search1');
    window.sessionStorage.setItem('bf:v1:ui:draft:user1:client1:vehicles:draft:form', 'data1');
    window.sessionStorage.setItem('bf:v1:ui:session:user2:client1:vehicles:filter:search', 'search2');
    window.localStorage.setItem('bf:v1:ui:preference:user1:client1:dashboard:filter:date-range', '{}');
    clearCurrentUserUiState('user1');
    expect(window.sessionStorage.getItem('bf:v1:ui:session:user1:client1:vehicles:filter:search')).toBeNull();
    expect(window.sessionStorage.getItem('bf:v1:ui:draft:user1:client1:vehicles:draft:form')).toBeNull();
    expect(window.sessionStorage.getItem('bf:v1:ui:session:user2:client1:vehicles:filter:search')).toBe('search2');
  });

  it('removes legacy keys from sessionStorage and localStorage', () => {
    window.sessionStorage.setItem('vehicleFormOpen', 'true');
    window.sessionStorage.setItem('driverFormPassword', 'secret');
    window.localStorage.setItem('dashboard_date_filter', '{}');
    window.localStorage.setItem('workshop_active_client', 'client1');
    clearCurrentUserUiState('user1');
    expect(window.sessionStorage.getItem('vehicleFormOpen')).toBeNull();
    expect(window.sessionStorage.getItem('driverFormPassword')).toBeNull();
    expect(window.localStorage.getItem('dashboard_date_filter')).toBeNull();
    expect(window.localStorage.getItem('workshop_active_client')).toBeNull();
  });
});