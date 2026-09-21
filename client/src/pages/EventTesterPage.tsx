/*
  EventTesterPage.tsx — Interactive event dispatch tester.
  Allows developers to test sending authenticated webhooks using their API keys and registered endpoints.
*/

import React, { useState } from 'react';
import { api, type SendEventResponse } from '../services/api';
import { useEndpoints } from '../hooks/useEndpoints';
import { CopyField } from '../components/CopyField';
import { StatusBadge } from '../components/StatusBadge';
import {
  Send,
  Key,
  Globe,
  Code,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import './EventTesterPage.css';

interface EventTesterPageProps {
  onNavigateToLiveDelivery?: () => void;
}

const DEFAULT_SAMPLE_PAYLOAD = JSON.stringify(
  {
    event: 'order.created',
    timestamp: new Date().toISOString(),
    order: {
      id: 'ord_' + Math.random().toString(36).substring(2, 9),
      amount_cents: 4999,
      currency: 'USD',
      customer: {
        id: 'cust_8102',
        email: 'developer@continew.dev',
      },
    },
  },
  null,
  2
);

export const EventTesterPage: React.FC<EventTesterPageProps> = ({
  onNavigateToLiveDelivery,
}) => {
  const { endpoints, isLoading: isLoadingEndpoints } = useEndpoints();

  // Form State
  const [apiKey, setApiKey] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [eventType, setEventType] = useState('order.created');
  const [jsonPayload, setJsonPayload] = useState(DEFAULT_SAMPLE_PAYLOAD);

  // Status & Feedback
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SendEventResponse | null>(null);

  // Automatically default to first endpoint if none explicitly picked
  const activeEndpointId = selectedEndpointId || (endpoints.length > 0 ? endpoints[0].id : '');

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonPayload);
      setJsonPayload(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Invalid JSON syntax: ${msg}`);
    }
  };

  const handleResetSample = () => {
    setJsonPayload(DEFAULT_SAMPLE_PAYLOAD);
    setError(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLastResult(null);

    if (!apiKey.trim()) {
      setError('Please paste your API key');
      return;
    }

    if (!activeEndpointId) {
      setError('Please select or enter a destination endpoint ID');
      return;
    }

    if (!eventType.trim()) {
      setError('Please specify an event type');
      return;
    }

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(jsonPayload) as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`JSON payload is invalid: ${msg}`);
      return;
    }

    setIsSending(true);
    const res = await api.events.send(apiKey.trim(), {
      endpointId: activeEndpointId,
      type: eventType.trim(),
      payload: parsedPayload,
    });
    setIsSending(false);

    if (res.ok && res.data) {
      setLastResult(res.data);
    } else {
      setError(res.error || 'Failed to dispatch webhook event');
    }
  };

  return (
    <div className="event-tester-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">Send Test Event</h1>
          <p className="page-subtitle">
            Simulate incoming events to verify signature validation, endpoint routing, and downstream delivery handling.
          </p>
        </div>
      </div>

      <div className="tester-layout">
        {/* Left: Input Form */}
        <form onSubmit={handleSend} className="tester-form">
          {/* API Key */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="test-api-key">API Key (x-api-key)</label>
              <span className="label-hint">Paste your raw API key</span>
            </div>
            <div className="input-wrapper">
              <Key size={16} className="input-icon" />
              <input
                id="test-api-key"
                type="password"
                placeholder="cnew_live_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Endpoint Dropdown */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="test-endpoint">Destination Endpoint</label>
              {endpoints.length === 0 && !isLoadingEndpoints && (
                <span className="label-warning">No endpoints registered yet</span>
              )}
            </div>
            <div className="input-wrapper">
              <Globe size={16} className="input-icon" />
              <select
                id="test-endpoint"
                value={activeEndpointId}
                onChange={(e) => setSelectedEndpointId(e.target.value)}
                required
              >
                {endpoints.length === 0 ? (
                  <option value="">No registered endpoints found</option>
                ) : (
                  endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.url} ({ep.id.substring(0, 8)}...) {ep.isActive ? '' : '[INACTIVE]'}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Event Type */}
          <div className="form-group">
            <label htmlFor="test-event-type">Event Type</label>
            <input
              id="test-event-type"
              type="text"
              placeholder="e.g. order.created, invoice.paid, user.verified"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              required
            />
          </div>

          {/* Payload Editor */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="test-payload">JSON Payload</label>
              <div className="editor-controls">
                <button
                  type="button"
                  className="editor-btn"
                  onClick={handleFormatJson}
                  title="Format / Prettify JSON"
                >
                  <Code size={13} />
                  <span>Prettify</span>
                </button>
                <button
                  type="button"
                  className="editor-btn"
                  onClick={handleResetSample}
                  title="Reset to default sample"
                >
                  <Sliders size={13} />
                  <span>Sample</span>
                </button>
              </div>
            </div>
            <textarea
              id="test-payload"
              rows={10}
              className="payload-textarea"
              value={jsonPayload}
              onChange={(e) => setJsonPayload(e.target.value)}
              required
              spellCheck={false}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={isSending || endpoints.length === 0}
          >
            {isSending ? (
              <>
                <RefreshCw size={15} className="spin-icon" />
                <span>Dispatching Webhook...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Dispatch Event</span>
              </>
            )}
          </button>
        </form>

        {/* Right: Response / Result Pane */}
        <div className="tester-result-pane">
          <h2 className="result-title">Execution Result</h2>

          {error && (
            <div className="result-card result-card--error">
              <div className="result-header">
                <AlertCircle size={18} className="text-danger" />
                <span className="result-status-text">Dispatch Failed</span>
              </div>
              <p className="result-error-msg">{error}</p>
            </div>
          )}

          {lastResult && (
            <div className="result-card result-card--success">
              <div className="result-header">
                <div className="result-status-row">
                  <CheckCircle2 size={18} className="text-success" />
                  <span className="result-status-text">Webhook Ingested</span>
                </div>
                <StatusBadge status="succeeded" label="202 ACCEPTED" size="sm" />
              </div>

              <div className="result-fields">
                <div className="result-field">
                  <span className="meta-label">Generated Event ID</span>
                  <CopyField value={lastResult.eventId} size="sm" />
                </div>
                <div className="result-field">
                  <span className="meta-label">Queue Status</span>
                  <span className="result-mono-val">{lastResult.status}</span>
                </div>
              </div>

              <p className="result-note">
                The Continew worker has queued this event for immediate dispatch with exponential backoff retries.
              </p>

              {onNavigateToLiveDelivery && (
                <button
                  type="button"
                  className="btn btn--primary result-action-btn"
                  onClick={onNavigateToLiveDelivery}
                >
                  <span>Watch Live Delivery Feed</span>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}

          {!error && !lastResult && (
            <div className="result-placeholder">
              <Code size={36} className="placeholder-icon" />
              <p className="placeholder-title">Awaiting Execution</p>
              <p className="placeholder-text">
                Fill in the event parameters and click <strong>Dispatch Event</strong>. Delivery attempts, status codes, and latency will stream in real time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
