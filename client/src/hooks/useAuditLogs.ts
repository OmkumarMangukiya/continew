/*
  useAuditLogs.ts — Custom hook for managing audit log retrieval, filtering, and event lookup.
  Supports both endpoint-level paginated history and targeted event lifecycle tracking.
*/

import { useState, useEffect, useCallback } from 'react';
import { api, type EndpointItem, type DeliveryAttempt } from '../services/api';

interface UseAuditLogsOptions {
  initialEndpointId?: string | null;
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { initialEndpointId } = options;

  const [endpoints, setEndpoints] = useState<EndpointItem[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(true);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>(initialEndpointId || '');

  const [attempts, setAttempts] = useState<DeliveryAttempt[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination for endpoint attempts
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Event search mode
  const [isEventSearchMode, setIsEventSearchMode] = useState<boolean>(false);
  const [searchedEventId, setSearchedEventId] = useState<string>('');

  // Track previous initialEndpointId prop to synchronize without setState in effect body
  const [prevInitialId, setPrevInitialId] = useState<string | null | undefined>(initialEndpointId);
  if (initialEndpointId !== prevInitialId) {
    setPrevInitialId(initialEndpointId);
    if (initialEndpointId) {
      setSelectedEndpointId(initialEndpointId);
      setIsEventSearchMode(false);
      setSearchedEventId('');
      setPage(1);
    }
  }

  // 1. Fetch user's registered endpoints on mount
  const loadEndpoints = useCallback(async () => {
    setIsLoadingEndpoints(true);
    const res = await api.endpoints.getAll();
    setIsLoadingEndpoints(false);

    if (res.ok && res.data?.rows) {
      const rows = res.data.rows;
      setEndpoints(rows);
      setSelectedEndpointId((prev) => {
        if (prev && rows.some((e) => e.id === prev)) return prev;
        if (initialEndpointId && rows.some((e) => e.id === initialEndpointId)) return initialEndpointId;
        return rows.length > 0 ? rows[0].id : '';
      });
    }
  }, [initialEndpointId]);

  useEffect(() => {
    let ignore = false;
    api.endpoints.getAll().then((res) => {
      if (!ignore) {
        setIsLoadingEndpoints(false);
        if (res.ok && res.data?.rows) {
          const rows = res.data.rows;
          setEndpoints(rows);
          setSelectedEndpointId((prev) => {
            if (prev && rows.some((e) => e.id === prev)) return prev;
            if (initialEndpointId && rows.some((e) => e.id === initialEndpointId)) return initialEndpointId;
            return rows.length > 0 ? rows[0].id : '';
          });
        }
      }
    });

    return () => {
      ignore = true;
    };
  }, [initialEndpointId]);

  // 2. Fetch attempts for the selected endpoint asynchronously via effect
  useEffect(() => {
    if (isEventSearchMode || !selectedEndpointId) {
      return;
    }

    let ignore = false;
    api.audit.getEndpointAttempts(selectedEndpointId, page, limit).then((res) => {
      if (!ignore) {
        setIsLoadingAttempts(false);
        if (res.ok && res.data) {
          const fetchedAttempts = res.data.attempts || [];
          setAttempts(fetchedAttempts);
          setHasMore(fetchedAttempts.length === limit);
        } else {
          setError(res.error || 'Failed to fetch audit logs for endpoint');
          setAttempts([]);
        }
      }
    });

    return () => {
      ignore = true;
    };
  }, [isEventSearchMode, selectedEndpointId, page, limit]);

  // Search attempts for a specific event ID
  const searchByEventId = useCallback(async (eventId: string) => {
    const trimmed = eventId.trim();
    if (!trimmed) return;

    setIsEventSearchMode(true);
    setSearchedEventId(trimmed);
    setIsLoadingAttempts(true);
    setError(null);

    const res = await api.audit.getEventAttempts(trimmed);
    setIsLoadingAttempts(false);

    if (res.ok && res.data) {
      setAttempts(res.data.attempts || []);
      setHasMore(false);
    } else {
      setError(res.error || `No audit logs found for event ID "${trimmed}"`);
      setAttempts([]);
    }
  }, []);

  // Return from event search mode back to endpoint browsing
  const clearEventSearch = useCallback(() => {
    setIsEventSearchMode(false);
    setSearchedEventId('');
    setError(null);
    setIsLoadingAttempts(true);
  }, []);

  const selectEndpoint = useCallback((id: string) => {
    setSelectedEndpointId(id);
    setIsEventSearchMode(false);
    setSearchedEventId('');
    setPage(1);
    setIsLoadingAttempts(true);
  }, []);

  const changePage = useCallback((newPage: number) => {
    setPage(Math.max(1, newPage));
    setIsLoadingAttempts(true);
  }, []);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    setIsLoadingAttempts(true);
  }, []);

  const refresh = useCallback(() => {
    if (isEventSearchMode && searchedEventId) {
      searchByEventId(searchedEventId);
    } else if (selectedEndpointId) {
      setIsLoadingAttempts(true);
      api.audit.getEndpointAttempts(selectedEndpointId, page, limit).then((res) => {
        setIsLoadingAttempts(false);
        if (res.ok && res.data) {
          const fetchedAttempts = res.data.attempts || [];
          setAttempts(fetchedAttempts);
          setHasMore(fetchedAttempts.length === limit);
        } else {
          setError(res.error || 'Failed to fetch audit logs for endpoint');
        }
      });
    }
  }, [isEventSearchMode, searchedEventId, selectedEndpointId, page, limit, searchByEventId]);

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpointId);

  return {
    endpoints,
    isLoadingEndpoints,
    selectedEndpointId,
    currentEndpoint,
    attempts,
    isLoadingAttempts,
    error,
    page,
    limit,
    hasMore,
    isEventSearchMode,
    searchedEventId,
    selectEndpoint,
    searchByEventId,
    clearEventSearch,
    setPage: changePage,
    setLimit: changeLimit,
    refresh,
    loadEndpoints,
  };
}
