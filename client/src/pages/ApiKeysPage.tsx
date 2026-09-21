/*
  ApiKeysPage.tsx — API Key management page.
  Allows generating new keys, one-time raw secret display, active status toggling, and key revocation.
*/

import React, { useState } from 'react';
import { useApiKeys } from '../hooks/useApiKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { CopyField } from '../components/CopyField';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { CreatedApiKey } from '../services/api';
import {
  Key,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react';
import './ApiKeysPage.css';

export const ApiKeysPage: React.FC = () => {
  const { apiKeys, isLoading, error, refresh, createApiKey, toggleApiKey, deleteApiKey } =
    useApiKeys();

  // Create Modal State
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // One-time Key Display Modal State
  const [createdKeyData, setCreatedKeyData] = useState<CreatedApiKey | null>(null);

  // Delete Confirm Dialog State
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenGenerate = () => {
    setKeyName('');
    setFormError(null);
    setIsGenerateOpen(true);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const res = await createApiKey(keyName.trim() || undefined);
    setIsSubmitting(false);

    if (res.ok && res.apiKey) {
      setIsGenerateOpen(false);
      setCreatedKeyData(res.apiKey);
    } else {
      setFormError(res.error || 'Failed to generate API key');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return;
    setIsDeleting(true);
    await deleteApiKey(keyToDelete.id);
    setIsDeleting(false);
    setKeyToDelete(null);
  };

  const activeCount = apiKeys.filter((k) => k.isActive).length;

  return (
    <div className="api-keys-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">API Keys</h1>
          <p className="page-subtitle">
            Create and manage authentication keys to dispatch event ingestion requests via Continew's REST API.
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
            onClick={handleOpenGenerate}
          >
            <Plus size={16} />
            <span>Generate Key</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="metrics-strip">
        <div className="metric-item">
          <span className="metric-label">Total Keys</span>
          <span className="metric-value">{apiKeys.length}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Active</span>
          <span className="metric-value metric-value--green">{activeCount}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Inactive</span>
          <span className="metric-value metric-value--muted">
            {apiKeys.length - activeCount}
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

      {/* API Key List */}
      {isLoading && apiKeys.length === 0 ? (
        <div className="loading-state">
          <RefreshCw size={20} className="spin-icon" />
          <span>Loading API keys...</span>
        </div>
      ) : apiKeys.length === 0 ? (
        <EmptyState
          icon={<Key size={36} />}
          title="No API keys generated"
          description="Generate your first API key to authenticate your server's outbound event payloads to Continew."
          actionLabel="Generate Key"
          onAction={handleOpenGenerate}
        />
      ) : (
        <div className="api-keys-list">
          {apiKeys.map((key) => (
            <div key={key.id} className="api-key-card">
              <div className="api-key-card__top">
                <div className="api-key-card__title-wrap">
                  <Key size={16} className="key-icon" />
                  <span className="api-key-name">{key.name || 'API Key'}</span>
                </div>
                <div className="api-key-card__status-wrap">
                  <StatusBadge
                    status={key.isActive ? 'active' : 'inactive'}
                    size="sm"
                  />
                  <button
                    type="button"
                    className="key-toggle-btn"
                    onClick={() => toggleApiKey(key.id, !key.isActive)}
                    title={key.isActive ? 'Deactivate key' : 'Activate key'}
                  >
                    {key.isActive ? (
                      <ToggleRight size={22} className="toggle-icon--active" />
                    ) : (
                      <ToggleLeft size={22} className="toggle-icon--inactive" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="key-delete-btn"
                    onClick={() => setKeyToDelete({ id: key.id, name: key.name || 'API Key' })}
                    title="Revoke / Delete Key"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="api-key-card__meta">
                <div className="api-key-card__field">
                  <span className="meta-label">Key ID</span>
                  <CopyField value={key.id} size="sm" />
                </div>

                <div className="api-key-card__footer">
                  <span className="meta-created">
                    Created on{' '}
                    {new Date(key.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="meta-note">
                    Secret hash stored securely in database
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Generate New API Key */}
      <Modal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title="Generate New API Key"
        maxWidth="480px"
      >
        <form onSubmit={handleGenerateSubmit} className="key-form">
          <p className="form-description">
            API keys authenticate POST requests sent to <code>/api/v1/events</code> via the <code>x-api-key</code> header.
          </p>

          {formError && (
            <div className="form-alert form-alert--error">
              <AlertCircle size={15} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="key-name">Key Label / Name (Optional)</label>
            <input
              id="key-name"
              type="text"
              placeholder="e.g. Production Ingestion Service"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              autoFocus
            />
            <span className="form-hint">
              A recognizable name to identify where this key is used.
            </span>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setIsGenerateOpen(false)}
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
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  <span>Generate Key</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: One-Time Key Display Callout */}
      <Modal
        isOpen={!!createdKeyData}
        onClose={() => setCreatedKeyData(null)}
        title="Save Your API Key"
        maxWidth="500px"
      >
        {createdKeyData && (
          <div className="one-time-key-view">
            <div className="one-time-warning">
              <AlertTriangle size={20} className="warning-icon" />
              <div className="warning-text">
                <strong>Please copy and save this secret key now.</strong>
                <p>
                  For security reasons, Continew does not store raw keys and you will not be able to view it again.
                </p>
              </div>
            </div>

            <div className="key-display-box">
              <span className="meta-label">Raw Secret Key</span>
              <CopyField value={createdKeyData.rawApiKey} />
            </div>

            <div className="key-meta-strip">
              <div>
                <span className="meta-label">Key ID</span>
                <code className="mono-text">{createdKeyData.id}</code>
              </div>
              <div>
                <span className="meta-label">Label</span>
                <span className="text-sm">{createdKeyData.name || 'Default'}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setCreatedKeyData(null)}
              >
                I have saved this key
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Dialog for Revoking API Key */}
      <ConfirmDialog
        isOpen={!!keyToDelete}
        title="Revoke API Key"
        message={`Are you sure you want to revoke "${keyToDelete?.name}"? Any external systems or background workers using this key will immediately lose access.`}
        confirmLabel="Revoke Key"
        cancelLabel="Keep Key"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setKeyToDelete(null)}
      />
    </div>
  );
};
