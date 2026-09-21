/*
  EndpointsPage.tsx — Webhook endpoint management page.
  Allows developers to register endpoints, toggle status, view circuit breaker state, and copy IDs.
*/

import React, { useState } from 'react';
import { useEndpoints } from '../hooks/useEndpoints';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { CopyField } from '../components/CopyField';
import type { EndpointDetailData } from '../services/api';
import {
  Webhook,
  Plus,
  RefreshCw,
  Activity,
  Globe,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import './EndpointsPage.css';

export const EndpointsPage: React.FC = () => {
  const { endpoints, isLoading, error, refresh, createEndpoint, toggleEndpoint, getDetails } =
    useEndpoints();

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Endpoint Details & Circuit Breaker Inspector Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDetailData | null>(null);
  const [circuitState, setCircuitState] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleOpenCreate = () => {
    setTargetUrl('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!targetUrl.trim()) {
      setFormError('Target URL is required');
      return;
    }

    try {
      new URL(targetUrl.trim());
    } catch {
      setFormError('Please enter a valid absolute URL (e.g. https://api.yoursite.com/webhook)');
      return;
    }

    setIsSubmitting(true);
    const res = await createEndpoint(targetUrl.trim());
    setIsSubmitting(false);

    if (res.ok) {
      setIsModalOpen(false);
      setTargetUrl('');
    } else {
      setFormError(res.error || 'Failed to create endpoint');
    }
  };

  const handleInspectDetails = async (id: string) => {
    setIsLoadingDetails(true);
    setDetailModalOpen(true);
    const details = await getDetails(id);
    setIsLoadingDetails(false);
    if (details) {
      setSelectedEndpoint(details.endpointData);
      setCircuitState(details.circuitBreaker.status);
    }
  };

  const activeCount = endpoints.filter((e) => e.isActive).length;

  return (
    <div className="endpoints-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">Webhook Endpoints</h1>
          <p className="page-subtitle">
            Configure destination URLs where Continew delivers real-time webhook payloads with automatic retries and circuit breaker protection.
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={refresh}
            title="Refresh list"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} />
            <span>Register Endpoint</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="metrics-strip">
        <div className="metric-item">
          <span className="metric-label">Total Endpoints</span>
          <span className="metric-value">{endpoints.length}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Active</span>
          <span className="metric-value metric-value--green">{activeCount}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Inactive</span>
          <span className="metric-value metric-value--muted">
            {endpoints.length - activeCount}
          </span>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="page-alert page-alert--error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Endpoints List */}
      {isLoading && endpoints.length === 0 ? (
        <div className="loading-state">
          <RefreshCw size={20} className="spin-icon" />
          <span>Loading webhook endpoints...</span>
        </div>
      ) : endpoints.length === 0 ? (
        <EmptyState
          icon={<Webhook size={36} />}
          title="No webhook endpoints registered"
          description="Register your first HTTP or HTTPS endpoint to begin receiving webhook deliveries with exponential backoff."
          actionLabel="Register Endpoint"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="endpoint-list">
          {endpoints.map((ep) => (
            <div key={ep.id} className="endpoint-card">
              <div className="endpoint-card__top">
                <div className="endpoint-card__url-wrap">
                  <Globe size={16} className="endpoint-icon" />
                  <span className="endpoint-url" title={ep.url}>
                    {ep.url}
                  </span>
                </div>
                <div className="endpoint-card__status-wrap">
                  <StatusBadge
                    status={ep.isActive ? 'active' : 'inactive'}
                    size="sm"
                  />
                  <button
                    type="button"
                    className="endpoint-toggle-btn"
                    onClick={() => toggleEndpoint(ep.id, !ep.isActive)}
                    title={ep.isActive ? 'Deactivate endpoint' : 'Activate endpoint'}
                  >
                    {ep.isActive ? (
                      <ToggleRight size={22} className="toggle-icon--active" />
                    ) : (
                      <ToggleLeft size={22} className="toggle-icon--inactive" />
                    )}
                  </button>
                </div>
              </div>

              <div className="endpoint-card__meta">
                <div className="endpoint-card__field">
                  <span className="meta-label">Endpoint ID</span>
                  <CopyField value={ep.id} size="sm" />
                </div>

                <div className="endpoint-card__footer">
                  <span className="meta-created">
                    Registered on{' '}
                    {new Date(ep.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>

                  <button
                    type="button"
                    className="btn btn--subtle"
                    onClick={() => handleInspectDetails(ep.id)}
                  >
                    <Activity size={14} />
                    <span>Circuit Status</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Register Endpoint */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Webhook Endpoint"
        maxWidth="480px"
      >
        <form onSubmit={handleCreateSubmit} className="endpoint-form">
          <p className="form-description">
            Continew will dispatch HTTP POST requests to this target URL. Each request is signed with a cryptographic HMAC secret.
          </p>

          {formError && (
            <div className="form-alert form-alert--error">
              <AlertCircle size={15} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="target-url">Webhook Destination URL</label>
            <input
              id="target-url"
              type="url"
              placeholder="https://api.yourdomain.com/webhooks"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
              autoFocus
            />
            <span className="form-hint">
              Must be a reachable HTTPS or HTTP endpoint accepting POST requests.
            </span>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="spin-icon" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Register</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Circuit Breaker Inspection */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Endpoint Circuit Breaker Diagnostics"
        maxWidth="460px"
      >
        {isLoadingDetails ? (
          <div className="loading-state">
            <RefreshCw size={18} className="spin-icon" />
            <span>Querying Redis circuit breaker state...</span>
          </div>
        ) : selectedEndpoint ? (
          <div className="circuit-diagnostics">
            <div className="diagnostic-row">
              <span className="diagnostic-label">Target URL:</span>
              <span className="diagnostic-value" title={selectedEndpoint.url}>
                {selectedEndpoint.url}
              </span>
            </div>
            <div className="diagnostic-row">
              <span className="diagnostic-label">Endpoint Status:</span>
              <StatusBadge
                status={selectedEndpoint.isActive ? 'active' : 'inactive'}
                size="sm"
              />
            </div>
            <div className="diagnostic-row">
              <span className="diagnostic-label">Circuit Breaker:</span>
              <StatusBadge
                status={circuitState || 'CLOSED'}
                label={circuitState === 'CLOSED' ? 'Healthy (Closed)' : circuitState || 'Closed'}
                size="sm"
                pulse={circuitState === 'OPEN'}
              />
            </div>

            <div className="circuit-explainer">
              {circuitState === 'OPEN' ? (
                <p className="circuit-explainer--open">
                  ⚠️ The circuit is <strong>OPEN</strong> due to consecutive failed deliveries. Deliveries are temporarily paused to protect the downstream receiver.
                </p>
              ) : circuitState === 'HALF_OPEN' ? (
                <p className="circuit-explainer--half">
                  ⚡ The circuit is <strong>HALF-OPEN</strong> testing canary traffic to confirm recovery.
                </p>
              ) : (
                <p className="circuit-explainer--closed">
                  ✅ The circuit is <strong>CLOSED</strong> (Normal). All deliveries are flowing as scheduled.
                </p>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setDetailModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
