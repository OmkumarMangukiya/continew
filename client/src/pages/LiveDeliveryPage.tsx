/*
  LiveDeliveryPage.tsx — Real-time webhook delivery monitoring stream.
  Streams live delivery attempts via WebSocket with latency calculation and status metrics.
*/

import React, { useState } from 'react';
import { useWebSocket, type LiveAttempt } from '../hooks/useWebSocket';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { CopyField } from '../components/CopyField';
import {
  Activity,
  Radio,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import './LiveDeliveryPage.css';

export const LiveDeliveryPage: React.FC = () => {
  const { attempts, status, stats, clearLogs, reconnect } = useWebSocket();

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAttempt, setSelectedAttempt] = useState<LiveAttempt | null>(null);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getCodeClass = (code?: number) => {
    if (!code) return 'code--muted';
    if (code >= 200 && code < 300) return 'code--success';
    if (code >= 400 && code < 600) return 'code--danger';
    return 'code--warning';
  };

  const filteredAttempts = attempts.filter((attempt) => {
    const attemptStatus = (attempt.status || '').toLowerCase();
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'SUCCEEDED' && attemptStatus === 'succeeded') ||
      (filterStatus === 'FAILED' && ['failed', 'exhausted'].includes(attemptStatus)) ||
      (filterStatus === 'PENDING' && ['pending', 'retry'].includes(attemptStatus));

    const eventId = (attempt.eventId || '').toLowerCase();
    const matchesSearch = !searchQuery || eventId.includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="live-delivery-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__info">
          <div className="live-status-row">
            <h1 className="page-title">Live Delivery Stream</h1>
            <div className="connection-pill">
              <span
                className={`connection-dot ${
                  status === 'connected'
                    ? 'connection-dot--connected'
                    : status === 'connecting'
                    ? 'connection-dot--connecting'
                    : 'connection-dot--disconnected'
                }`}
              />
              <span className="connection-label">
                {status === 'connected'
                  ? 'Live Connected'
                  : status === 'connecting'
                  ? 'Connecting...'
                  : 'Disconnected'}
              </span>
              {status === 'disconnected' && (
                <button
                  type="button"
                  className="reconnect-btn"
                  onClick={reconnect}
                  title="Reconnect to stream"
                >
                  <RefreshCw size={12} />
                </button>
              )}
            </div>
          </div>
          <p className="page-subtitle">
            Real-time feed of webhook dispatches across all endpoints, capturing HTTP response codes, latency, and retry transitions.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card__header">
            <span className="metric-card__label">Total Attempts</span>
            <Activity size={16} className="metric-card__icon" />
          </div>
          <span className="metric-card__value">{stats.total}</span>
        </div>

        <div className="metric-card">
          <div className="metric-card__header">
            <span className="metric-card__label">Delivered (2xx)</span>
            <CheckCircle2 size={16} className="metric-card__icon text-success" />
          </div>
          <span className="metric-card__value text-success">{stats.succeeded}</span>
        </div>

        <div className="metric-card">
          <div className="metric-card__header">
            <span className="metric-card__label">Failed / Exhausted</span>
            <XCircle size={16} className="metric-card__icon text-danger" />
          </div>
          <span className="metric-card__value text-danger">{stats.failed}</span>
        </div>

        <div className="metric-card">
          <div className="metric-card__header">
            <span className="metric-card__label">Avg Latency</span>
            <Zap size={16} className="metric-card__icon text-warning" />
          </div>
          <span className="metric-card__value">
            {stats.avgLatency} <span className="metric-unit">ms</span>
          </span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="stream-controls">
        <div className="stream-search">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Event ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="stream-filter-wrap">
          <Filter size={14} className="filter-icon" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCEEDED">Delivered (2xx)</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending / Retrying</option>
          </select>
        </div>

        <button
          type="button"
          className="btn btn--subtle clear-btn"
          onClick={clearLogs}
          title="Clear streaming table"
        >
          <Trash2 size={13} />
          <span>Clear Feed</span>
        </button>
      </div>

      {/* Delivery Table */}
      <div className="table-container">
        <table className="delivery-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event ID</th>
              <th>Attempt</th>
              <th>Status</th>
              <th>HTTP Code</th>
              <th>Latency</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredAttempts.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  <Radio size={24} className="pulse-icon" />
                  <p>
                    {attempts.length === 0
                      ? 'Waiting for incoming webhook delivery events...'
                      : 'No attempts match current filters'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredAttempts.map((attempt, index) => {
                const eventId = attempt.eventId || '—';
                const attemptNum = attempt.attemptNumber || 1;
                const responseCode = attempt.responseCode;
                const latency = attempt.latencyMs;
                const createdAt = attempt.createdAt;

                return (
                  <tr
                    key={attempt.id || `${eventId}-${attemptNum}-${index}`}
                    className="delivery-row"
                    onClick={() => setSelectedAttempt(attempt)}
                  >
                    <td className="mono-cell text-muted">
                      <Clock size={12} className="inline-icon" />
                      {formatTime(createdAt)}
                    </td>
                    <td className="mono-cell event-id-cell" title={eventId}>
                      {eventId.length > 12 ? `${eventId.substring(0, 10)}...` : eventId}
                    </td>
                    <td className="mono-cell">#{attemptNum}</td>
                    <td>
                      <StatusBadge
                        status={attempt.status}
                        size="sm"
                        pulse={attempt.status?.toLowerCase() === 'pending'}
                      />
                    </td>
                    <td>
                      <span className={`http-code-pill ${getCodeClass(responseCode)}`}>
                        {responseCode || '—'}
                      </span>
                    </td>
                    <td className="mono-cell">
                      {latency !== undefined ? `${latency} ms` : '—'}
                    </td>
                    <td className="details-cell">
                      <span className="details-link">Inspect</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Attempt Inspection Modal */}
      <Modal
        isOpen={!!selectedAttempt}
        onClose={() => setSelectedAttempt(null)}
        title="Delivery Attempt Diagnostics"
        maxWidth="520px"
      >
        {selectedAttempt && (
          <div className="attempt-modal-body">
            <div className="attempt-meta-grid">
              <div>
                <span className="meta-label">Event ID</span>
                <CopyField
                  value={selectedAttempt.eventId || '—'}
                  size="sm"
                />
              </div>
              <div>
                <span className="meta-label">Endpoint ID</span>
                <CopyField
                  value={selectedAttempt.endpointId || '—'}
                  size="sm"
                />
              </div>
            </div>

            <div className="diagnostic-row">
              <span className="diagnostic-label">Timestamp:</span>
              <span className="mono-cell">
                {selectedAttempt.createdAt || '—'}
              </span>
            </div>

            <div className="diagnostic-row">
              <span className="diagnostic-label">Attempt Number:</span>
              <span className="mono-cell">
                #{selectedAttempt.attemptNumber || 1}
              </span>
            </div>

            <div className="diagnostic-row">
              <span className="diagnostic-label">Delivery Status:</span>
              <StatusBadge status={selectedAttempt.status} size="sm" />
            </div>

            <div className="diagnostic-row">
              <span className="diagnostic-label">HTTP Response Code:</span>
              <span
                className={`http-code-pill ${getCodeClass(
                  selectedAttempt.responseCode
                )}`}
              >
                {selectedAttempt.responseCode || 'No response'}
              </span>
            </div>

            <div className="diagnostic-row">
              <span className="diagnostic-label">Execution Latency:</span>
              <span className="mono-cell">
                {selectedAttempt.latencyMs ?? 0} ms
              </span>
            </div>

            {selectedAttempt.error && (
              <div className="attempt-error-box">
                <span className="meta-label text-danger">Error / Failure Reason</span>
                <pre className="error-text">{selectedAttempt.error}</pre>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setSelectedAttempt(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
