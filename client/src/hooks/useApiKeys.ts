/*
  useApiKeys.ts — Custom hook for managing API keys CRUD and generation.
*/

import { useState, useEffect, useCallback } from 'react';
import { api, type ApiKeyItem, type CreatedApiKey } from '../services/api';

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    setError(null);
    const res = await api.apiKeys.getAll();
    setIsLoading(false);

    if (res.ok && res.data?.apiKeys) {
      setApiKeys(res.data.apiKeys);
    } else {
      setError(res.error || 'Failed to fetch API keys');
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api.apiKeys.getAll().then((res) => {
      if (!ignore) {
        setIsLoading(false);
        if (res.ok && res.data?.apiKeys) {
          setApiKeys(res.data.apiKeys);
        } else {
          setError(res.error || 'Failed to fetch API keys');
        }
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchApiKeys();
  }, [fetchApiKeys]);

  const createApiKey = async (name?: string): Promise<{ ok: boolean; apiKey?: CreatedApiKey; error?: string }> => {
    setError(null);
    const res = await api.apiKeys.create(name);
    if (res.ok && res.data?.apiKey) {
      await fetchApiKeys();
      return { ok: true, apiKey: res.data.apiKey };
    }
    return { ok: false, error: res.error || 'Failed to generate API key' };
  };

  const toggleApiKey = async (id: string, isActive?: boolean) => {
    // Optimistic UI update
    setApiKeys((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, isActive: isActive !== undefined ? isActive : !k.isActive } : k
      )
    );

    const res = await api.apiKeys.toggle(id, isActive);
    if (!res.ok) {
      await fetchApiKeys();
      return { ok: false, error: res.error || 'Failed to toggle API key' };
    }
    return { ok: true };
  };

  const deleteApiKey = async (id: string) => {
    const res = await api.apiKeys.delete(id);
    if (res.ok) {
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      return { ok: true };
    }
    return { ok: false, error: res.error || 'Failed to delete API key' };
  };

  return {
    apiKeys,
    isLoading,
    error,
    refresh,
    createApiKey,
    toggleApiKey,
    deleteApiKey,
  };
}
