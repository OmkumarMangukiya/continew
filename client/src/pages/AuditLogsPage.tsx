/*
  AuditLogsPage.tsx — Audit Logs Explorer & Delivery History.
  Provides developers with searchable, filterable historical logs of webhook delivery attempts,
  HTTP status codes, latencies, and retry traces per endpoint or per event ID.
*/

import React, { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { CopyField } from '../components/CopyField';
import { EmptyState } from '../components/EmptyState';
import type { DeliveryAttempt } from '../services/api';
import {
  History,
  Globe,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Radio,
  Webhook,
  Send,
} from 'lucide-react';
import './AuditLogsPage.css';

interface AuditLogsPageProps {
  initialEndpointId?: string | null;
  onNavigateToEndpoints?: () => void;
  onNavigateToSendEvent?: () => void;
}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({
  initialEndpointId,
  onNavigateToEndpoints,
  onNavigateToSendEvent,
}) => {
  const {
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
    setPage,
    setLimit,
    refresh,
  } = useAuditLogs({ initialEndpointId });

  // Local filter & search form state
  const [searchInput, setSearchInput] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedAttempt, setSelectedAttempt] = useState<DeliveryAttempt | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      searchByEventId(searchInput.trim());
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    clearEventSearch();
  };

  const handleInspectAttempt = (attempt: DeliveryAttempt) => {
    setSelectedAttempt(attempt);
  };

  const handleTraceEventFromModal = (eventId: string) => {
    setSelectedAttempt(null);
    setSearchInput(eventId);
    searchByEventId(eventId);
  };

  // Format timestamp
  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const formatFullDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} ${d.toLocaleTimeString([], { hour12: false })}`;
    } catch {
      return isoString;
    }
  };

  // HTTP code styling helper
  const getHttpCodeClass = (code?: number) => {
    if (!code) return 'http-code-badge--muted';
    if (code >= 200 && code < 300) return 'http-code-badge--success';
    if (code >= 400 && code < 600) return 'http-code-badge--danger';
    return 'http-code-badge--warning';
  };

  // Filter attempts in view
  const filteredAttempts = attempts.filter((attempt) => {
    const attemptStatus = (attempt.status || '').toLowerCase();
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'SUCCEEDED') return attemptStatus === 'succeeded';
    if (filterStatus === 'FAILED') return ['failed', 'exhausted', 'error'].includes(attemptStatus);
    if (filterStatus === 'PENDING') return ['pending', 'retry'].includes(attemptStatus);
    return true;
  });

  // Calculate live summary stats for the current loaded view
  const stats = React.useMemo(() => {
    const total = attempts.length;
    const succeeded = attempts.filter((a) => (a.status || '').toLowerCase() === 'succeeded').length;
    const failed = attempts.filter((a) =>
      ['failed', 'exhausted', 'error'].includes((a.status || '').toLowerCase())
    ).length;
    const withLatency = attempts.filter(
      (a) => typeof a.latencyMs === 'number' && a.latencyMs >= 0
    );
    const avgLatency =
      withLatency.length > 0
        ? Math.round(
            withLatency.reduce((acc, curr) => acc + (curr.latencyMs || 0), 0) /
              withLatency.length
          )
        : 0;

    return { total, succeeded, failed, avgLatency };
  }, [attempts]);

  // Loading state when initially fetching endpoints
  if (isLoadingEndpoints && endpoints.length === 0) {
    return (
      <div className="audit-logs-page">
        <div className="audit-table__empty">
          <RefreshCw size={24} className="spin-icon empty-icon" />
          <p className="empty-title">Loading Webhook Infrastructure...</p>
        </div>
      </div>
    );
  }

  // When user has no endpoints at all registered
  if (!isLoadingEndpoints && endpoints.length === 0) {
    return (
      <div className="audit-logs-page">
        <div className="page-header">
          <div className="page-header__info">
            <h1 className="page-title">Delivery Audit Logs</h1>
            <p className="page-subtitle">
              Audit logs capture every webhook delivery attempt, HTTP status code, latency, and retry trace.
            </p>
          </div>
        </div>
        <EmptyState
          icon={<Webhook size={36} />}
          title="No webhook endpoints registered yet"
          description="You need to register at least one webhook destination URL before Continew can record delivery audit logs."
          actionLabel="Go to Endpoints"
          onAction={onNavigateToEndpoints}
        />
      </div>
    );
  }

  return (
    <div className="audit-logs-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__info">
          <div className="page-title-row">
            <h1 className="page-title">Delivery Audit Logs</h1>
            <span className="audit-mode-badge">
              {isEventSearchMode ? 'Event Lifecycle Mode' : 'Endpoint History'}
            </span>
          </div>
          <p className="page-subtitle">
            Comprehensive audit trail of past webhook deliveries. Query attempts across endpoints, inspect retry lifecycles, and diagnose delivery errors.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="audit-metrics-grid">
        <div className="audit-metric-card">
          <div className="audit-metric-card__header">
            <span className="audit-metric-card__label">Logged Attempts</span>
            <Activity size={16} className="audit-metric-card__icon" />
          </div>
          <span className="audit-metric-card__value">{stats.total}</span>
        </div>

        <div className="audit-metric-card">
          <div className="audit-metric-card__header">
            <span className="audit-metric-card__label">Delivered (2xx)</span>
            <CheckCircle2 size={16} className="audit-metric-card__icon text-success" />
          </div>
          <span className="audit-metric-card__value text-success">{stats.succeeded}</span>
        </div>

        <div className="audit-metric-card">
          <div className="audit-metric-card__header">
            <span className="audit-metric-card__label">Failed / Exhausted</span>
            <XCircle size={16} className="audit-metric-card__icon text-danger" />
          </div>
          <span className="audit-metric-card__value text-danger">{stats.failed}</span>
        </div>

        <div className="audit-metric-card">
          <div className="audit-metric-card__header">
            <span className="audit-metric-card__label">Avg Latency</span>
            <Zap size={16} className="audit-metric-card__icon text-warning" />
          </div>
          <span className="audit-metric-card__value">
            {stats.avgLatency}
            <span className="audit-metric-unit">ms</span>
          </span>
        </div>
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="audit-controls">
        <div className="audit-controls__left">
          {/* Endpoint Selector Dropdown */}
          <div className="endpoint-select-wrap" title="Select endpoint to inspect">
            <Globe size={14} className="select-icon" />
            <select
              className="endpoint-select"
              value={selectedEndpointId}
              onChange={(e) => selectEndpoint(e.target.value)}
              disabled={isEventSearchMode}
            >
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.url} ({ep.id.substring(0, 8)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Event ID Search Box */}
          <form onSubmit={handleSearchSubmit} className="audit-search-form">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search by Event ID..."
              className="search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClearSearch}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="submit"
              className="search-submit-btn"
              title="Lookup Event Attempts"
            >
              <History size={14} />
            </button>
          </form>
        </div>

        <div className="audit-controls__right">
          {/* Status Filter */}
          <div className="status-filter-wrap">
            <Filter size={14} className="select-icon" />
            <select
              className="status-filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCEEDED">Delivered (2xx)</option>
              <option value="FAILED">Failed / Exhausted</option>
              <option value="PENDING">Pending / Retrying</option>
            </select>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            className="btn btn--secondary"
            onClick={refresh}
            title="Refresh logs"
          >
            <RefreshCw size={13} className={isLoadingAttempts ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Event Search Mode Banner */}
      {isEventSearchMode && (
        <div className="event-search-banner">
          <div className="event-search-banner__text">
            <History size={15} />
            <span>
              Inspecting complete retry lifecycle for Event ID:{' '}
              <span className="event-search-banner__id">{searchedEventId}</span>
              {' '}({attempts.length} attempts recorded)
            </span>
          </div>
          <button
            type="button"
            className="event-search-banner__dismiss"
            onClick={handleClearSearch}
          >
            Back to Endpoint Logs
          </button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="page-alert page-alert--error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="audit-table-card">
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event ID</th>
                <th>Event Type</th>
                <th>Attempt</th>
                <th>Status</th>
                <th>HTTP Code</th>
                <th>Latency</th>
                <th>Trace</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingAttempts && attempts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="audit-table__empty">
                    <RefreshCw size={22} className="spin-icon empty-icon" />
                    <p className="empty-title">Fetching audit records...</p>
                  </td>
                </tr>
              ) : filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="audit-table__empty">
                    <Radio size={28} className="empty-icon" />
                    <p className="empty-title">
                      {isEventSearchMode
                        ? `No attempts recorded for event "${searchedEventId}"`
                        : 'No delivery logs found'}
                    </p>
                    <p className="empty-desc">
                      {isEventSearchMode
                        ? 'Verify the event ID or dispatch a test event to this endpoint.'
                        : 'This endpoint has not processed any webhook dispatches yet.'}
                    </p>
                    {onNavigateToSendEvent && !isEventSearchMode && (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={onNavigateToSendEvent}
                      >
                        <Send size={13} />
                        <span>Send Test Webhook Event</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAttempts.map((attempt) => {
                  const eventId = attempt.eventId || '—';
                  const attemptNum = attempt.attemptNumber || 1;
                  const responseCode = attempt.responseCode;
                  const latency = attempt.latencyMs;

                  return (
                    <tr
                      key={attempt.id}
                      className="audit-row"
                      onClick={() => handleInspectAttempt(attempt)}
                    >
                      <td className="mono-cell cell-time">
                        <Clock size={12} />
                        {formatTime(attempt.createdAt)}
                      </td>
                      <td className="mono-cell cell-event-id" title={eventId}>
                        {eventId}
                      </td>
                      <td>
                        <span className="event-type-tag">
                          {attempt.eventType || 'webhook.event'}
                        </span>
                      </td>
                      <td>
                        <span className="attempt-pill">#{attemptNum}</span>
                      </td>
                      <td>
                        <StatusBadge
                          status={attempt.status}
                          size="sm"
                          pulse={attempt.status?.toLowerCase() === 'pending'}
                        />
                      </td>
                      <td>
                        <span
                          className={`http-code-badge ${getHttpCodeClass(responseCode)}`}
                        >
                          {responseCode || '—'}
                        </span>
                      </td>
                      <td className="mono-cell">
                        {latency !== undefined ? `${latency} ms` : '—'}
                      </td>
                      <td>
                        <span className="inspect-action">
                          Inspect
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Only active in endpoint browsing mode) */}
        {!isEventSearchMode && (
          <div className="audit-pagination">
            <div className="audit-pagination__left">
              <span>Rows per page:</span>
              <select
                className="page-size-select"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>
                (Endpoint: {currentEndpoint ? currentEndpoint.url : selectedEndpointId})
              </span>
            </div>

            <div className="audit-pagination__controls">
              <button
                type="button"
                className="page-btn"
                disabled={page <= 1 || isLoadingAttempts}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <span className="page-indicator">Page {page}</span>
              <button
                type="button"
                className="page-btn"
                disabled={!hasMore || isLoadingAttempts}
                onClick={() => setPage(page + 1)}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Attempt Inspector Modal */}
      {selectedAttempt && (
        <Modal
          isOpen={Boolean(selectedAttempt)}
          onClose={() => setSelectedAttempt(null)}
          title={`Delivery Attempt #${selectedAttempt.attemptNumber} Details`}
          maxWidth="560px"
        >
          <div className="attempt-inspector">
            <div className="inspector-grid">
              <div className="inspector-field inspector-field--full">
                <span className="inspector-label">Event ID</span>
                <CopyField value={selectedAttempt.eventId} size="sm" />
              </div>

              <div className="inspector-field">
                <span className="inspector-label">Event Type</span>
                <span className="inspector-value inspector-value--mono">
                  {selectedAttempt.eventType || 'webhook.event'}
                </span>
              </div>

              <div className="inspector-field">
                <span className="inspector-label">Attempt Number</span>
                <span className="inspector-value inspector-value--mono">
                  #{selectedAttempt.attemptNumber}
                </span>
              </div>

              <div className="inspector-field">
                <span className="inspector-label">Delivery Status</span>
                <div>
                  <StatusBadge status={selectedAttempt.status} size="sm" />
                </div>
              </div>

              <div className="inspector-field">
                <span className="inspector-label">HTTP Response Code</span>
                <div>
                  <span
                    className={`http-code-badge ${getHttpCodeClass(
                      selectedAttempt.responseCode
                    )}`}
                  >
                    {selectedAttempt.responseCode || 'No Response (Timeout / Unreachable)'}
                  </span>
                </div>
              </div>

              <div className="inspector-field">
                <span className="inspector-label">Response Latency</span>
                <span className="inspector-value inspector-value--mono">
                  {selectedAttempt.latencyMs !== undefined
                    ? `${selectedAttempt.latencyMs} ms`
                    : '—'}
                </span>
              </div>

              <div className="inspector-field">
                <span className="inspector-label">Attempt Timestamp</span>
                <span className="inspector-value inspector-value--mono">
                  {formatFullDate(selectedAttempt.createdAt)}
                </span>
              </div>

              {currentEndpoint && (
                <div className="inspector-field inspector-field--full">
                  <span className="inspector-label">Destination URL</span>
                  <span className="inspector-value inspector-value--mono">
                    {currentEndpoint.url}
                  </span>
                </div>
              )}
            </div>

            {/* Error Message Box if attempt failed */}
            {selectedAttempt.error && (
              <div className="inspector-error-box">
                <div className="inspector-error-title">
                  <AlertCircle size={14} />
                  <span>Delivery Error Trace</span>
                </div>
                <div className="inspector-error-text">
                  {selectedAttempt.error}
                </div>
              </div>
            )}

            {/* Inspector Modal Footer Actions */}
            <div className="inspector-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setSelectedAttempt(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="inspector-trace-btn"
                onClick={() => handleTraceEventFromModal(selectedAttempt.eventId)}
                title="View all retry attempts for this specific event"
              >
                <History size={14} />
                <span>Trace All Retries for this Event</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
