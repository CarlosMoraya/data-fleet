import { useState, useCallback, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import {
  type UiStateScope,
  type UiStateKind,
  buildUiStateKey,
  readUiState,
  writeUiState,
  removeUiState,
  sanitizeDraft,
} from '../lib/uiStateStorage';

export interface UsePersistentUiStateOptions<T> {
  module: string;
  stateKind: UiStateKind;
  name: string;
  scope: UiStateScope;
  defaultValue: T;
  validator?: (value: unknown) => value is T;
  legacyKeys?: string[];
  sanitize?: boolean;
  removeOnDefault?: boolean;
}

export function usePersistentUiState<T>({
  module,
  stateKind,
  name,
  scope,
  defaultValue,
  validator,
  legacyKeys,
  sanitize,
  removeOnDefault = true,
}: UsePersistentUiStateOptions<T>): [T, (value: T | ((prev: T) => T)) => void, () => void, string] {
  const { user, currentClient } = useAuth();
  const storage = scope === 'preference' ? window.localStorage : window.sessionStorage;

  const userId = user?.id ?? 'anonymous';
  const clientId = user?.role === 'Admin Master' && !currentClient?.id
    ? 'all-clients'
    : (currentClient?.id ?? 'no-client');

  const key = buildUiStateKey({
    scope,
    userId,
    clientId,
    module,
    stateKind,
    name,
  });

  const canWrite = !!user?.id;

  const initialValueRef = useRef<T | null>(null);
  if (initialValueRef.current === null) {
    if (canWrite) {
      initialValueRef.current = readUiState<T>(storage, key, defaultValue, { validator, legacyKeys });
    } else {
      initialValueRef.current = defaultValue;
    }
  }

  const [value, setValueInternal] = useState<T>(initialValueRef.current);

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      if (!canWrite) return;
      setValueInternal((prev) => {
        const next = typeof updater === 'function'
          ? (updater as (prev: T) => T)(prev)
          : updater;
        if (sanitize && stateKind === 'draft' && typeof next === 'object' && next !== null) {
          const sanitized = sanitizeDraft(module, next as Record<string, unknown>);
          writeUiState(storage, key, sanitized as T, defaultValue, { removeOnDefault, removeLegacyKeys: legacyKeys });
          return sanitized as T;
        }
        writeUiState(storage, key, next, defaultValue, { removeOnDefault, removeLegacyKeys: legacyKeys });
        return next;
      });
    },
    [canWrite, storage, key, defaultValue, removeOnDefault, legacyKeys, sanitize, stateKind, module],
  );

  const clearValue = useCallback(() => {
    removeUiState(storage, key);
    if (legacyKeys) {
      for (const lk of legacyKeys) {
        removeUiState(storage, lk);
      }
    }
    setValueInternal(defaultValue);
  }, [storage, key, defaultValue, legacyKeys]);

  return [value, setValue, clearValue, key];
}

export function useSessionUiState<T>(
  module: string,
  stateKind: UiStateKind,
  name: string,
  defaultValue: T,
  options?: { validator?: (value: unknown) => value is T; legacyKeys?: string[] },
) {
  return usePersistentUiState<T>({
    module,
    stateKind,
    name,
    scope: 'session',
    defaultValue,
    ...options,
  });
}

export function useUiPreference<T>(
  module: string,
  stateKind: UiStateKind,
  name: string,
  defaultValue: T,
  options?: { validator?: (value: unknown) => value is T; legacyKeys?: string[] },
) {
  return usePersistentUiState<T>({
    module,
    stateKind,
    name,
    scope: 'preference',
    defaultValue,
    ...options,
  });
}

export function useFormDraftState<T>(
  module: string,
  name: string,
  defaultValue: T,
  options?: { validator?: (value: unknown) => value is T; legacyKeys?: string[]; sanitize?: boolean },
) {
  return usePersistentUiState<T>({
    module,
    stateKind: 'draft',
    name,
    scope: 'draft',
    defaultValue,
    ...options,
  });
}

export function usePersistentTabState(
  module: string,
  name: string,
  defaultValue: string,
  options?: { validator?: (value: unknown) => value is string; legacyKeys?: string[] },
) {
  return usePersistentUiState<string>({
    module,
    stateKind: 'tab',
    name,
    scope: 'session',
    defaultValue,
    ...options,
  });
}

export function usePersistentFilterState<T>(
  module: string,
  name: string,
  defaultValue: T,
  options?: { validator?: (value: unknown) => value is T; legacyKeys?: string[] },
) {
  return usePersistentUiState<T>({
    module,
    stateKind: 'filter',
    name,
    scope: 'session',
    defaultValue,
    ...options,
  });
}