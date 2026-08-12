import React from 'react';

import { getPrivateDocumentSignedUrl, type PrivateDocumentBucket } from '../lib/storageHelpers';

export interface StorageFileUrlState {
  /** Signed URL ready to be used as `href`/`src`, or null while unresolved. */
  url: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Resolves a persisted document pointer (canonical path or legacy public URL)
 * into a short-lived signed URL for a private bucket.
 *
 * The signed URL is kept in component state only — it must never be persisted
 * in the database or in localStorage. When resolution fails, `url` stays null
 * so the raw path is never leaked into an `href`/`src`.
 */
export function useStorageFileUrl(
  value: string | null | undefined,
  bucket: PrivateDocumentBucket,
): StorageFileUrlState {
  const [state, setState] = React.useState<StorageFileUrlState>({
    url: null,
    isLoading: false,
    error: null,
  });

  React.useEffect(() => {
    if (!value) {
      setState({ url: null, isLoading: false, error: null });
      return;
    }

    let active = true;
    setState({ url: null, isLoading: true, error: null });

    getPrivateDocumentSignedUrl(value, bucket)
      .then((signedUrl) => {
        if (!active) return;
        setState({ url: signedUrl, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Erro ao abrir o documento.';
        setState({ url: null, isLoading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [value, bucket]);

  return state;
}

/**
 * Batch variant of {@link useStorageFileUrl}: resolves several pointers of the
 * same bucket and returns a map from the original pointer to its signed URL.
 * Pointers that fail to resolve are simply absent from the map.
 */
export function useStorageFileUrls(
  values: readonly (string | null | undefined)[],
  bucket: PrivateDocumentBucket,
): { urls: Record<string, string>; isLoading: boolean } {
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = React.useState(false);

  const pointers = React.useMemo(
    () => values.filter((value): value is string => !!value),
    // Stable dependency: the joined list changes only when the pointers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.filter(Boolean).join('|')],
  );

  React.useEffect(() => {
    if (pointers.length === 0) {
      setUrls({});
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    void Promise.all(
      pointers.map(async (pointer) => {
        try {
          return [pointer, await getPrivateDocumentSignedUrl(pointer, bucket)] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (!active) return;
      const next: Record<string, string> = {};
      entries.forEach((entry) => {
        if (entry) next[entry[0]] = entry[1];
      });
      setUrls(next);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [pointers, bucket]);

  return { urls, isLoading };
}
