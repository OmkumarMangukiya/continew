/*
  CopyField.tsx — Read-only field with single-click clipboard copying and confirmation feedback.
*/

import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';
import './CopyField.css';

interface CopyFieldProps {
  value: string;
  label?: string;
  masked?: boolean;
  canToggleMask?: boolean;
  size?: 'sm' | 'md';
}

export const CopyField: React.FC<CopyFieldProps> = ({
  value,
  label,
  masked = false,
  canToggleMask = false,
  size = 'md',
}) => {
  const [copied, setCopied] = useState(false);
  const [isMasked, setIsMasked] = useState(masked);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const displayValue = isMasked
    ? '••••••••••••••••••••••••••••••••'
    : value || '—';

  return (
    <div className={`copy-field copy-field--${size}`}>
      {label && <label className="copy-field__label">{label}</label>}
      <div className="copy-field__container">
        <code className="copy-field__text">{displayValue}</code>
        <div className="copy-field__actions">
          {canToggleMask && (
            <button
              type="button"
              className="copy-field__btn"
              onClick={() => setIsMasked(!isMasked)}
              title={isMasked ? 'Show secret' : 'Hide secret'}
            >
              {isMasked ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
          <button
            type="button"
            className={`copy-field__btn ${copied ? 'copy-field__btn--copied' : ''}`}
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check size={14} />
                <span className="copy-field__feedback">Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span className="copy-field__btn-label">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
