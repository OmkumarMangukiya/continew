/*
  useEndpoints.ts — Custom hook for managing webhook endpoints CRUD and status.
*/

import { useState, useEffect, useCallback } from 'react';
import { api, type EndpointItem, type EndpointDetailResponse } from '../services/api';

export function useEndpoints() {
  const [endpoints, setEndpoints] = useState<EndpointItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEndpoints = useCallback(async () => {
    setError(null);
    const res = await api.endpoints.getAll();
    setIsLoading(false);

    if (res.ok && res.data?.rows) {
      setEndpoints(res.data.rows);
    } else {
      setError(res.error || 'Failed to fetch endpoints');
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api.endpoints.getAll().then((res) => {
      if (!ignore) {
        setIsLoading(false);
        if (res.ok && res.data?.rows) {
          setEndpoints(res.data.rows);
        } else {
          setError(res.error || 'Failed to fetch endpoints');
        }
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchEndpoints();
  }, [fetchEndpoints]);

  const createEndpoint = async (url: string) => {
    setError(null);
    const res = await api.endpoints.create(url);
    if (res.ok) {
      await fetchEndpoints();
      return { ok: true, data: res.data?.endpoint };
    }
    return { ok: false, error: res.error || 'Failed to create endpoint' };
  };

  const toggleEndpoint = async (id: string, isActive?: boolean) => {
    // Optimistic UI update
    setEndpoints((prev) =>
      prev.map((ep) =>
        ep.id === id ? { ...ep, isActive: isActive !== undefined ? isActive : !ep.isActive } : ep
      )
    );

    const res = await api.endpoints.toggle(id, isActive);
    if (!res.ok) {
      // Revert on failure
      await fetchEndpoints();
      return { ok: false, error: res.error || 'Failed to toggle endpoint' };
    }
    return { ok: true };
  };

  const getDetails = async (id: string): Promise<EndpointDetailResponse | null> => {
    const res = await api.endpoints.getDetails(id);
    if (res.ok && res.data) {
      return res.data;
    }
    return null;
  };

  return {
    endpoints,
    isLoading,
    error,
    refresh,
    createEndpoint,
    toggleEndpoint,
    getDetails,
  };
}
