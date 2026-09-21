/*
  StatusBadge.tsx — Renders status indicator with a colored dot and text label.
  Supports active, inactive, success, failed, pending, and circuit breaker states.
*/

import React from 'react';
import './StatusBadge.css';

export type BadgeStatus =
  | 'active'
  | 'inactive'
  | 'succeeded'
  | 'failed'
  | 'pending'
  | 'closed'
  | 'open'
  | 'half_open'
  | string;

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  pulse = false,
}) => {
  const normalized = status.toLowerCase();

  let variant = 'default';
  if (['active', 'succeeded', 'success', 'closed', '200'].includes(normalized)) {
    variant = 'success';
  } else if (['inactive', 'failed', 'error', 'open', 'exhausted'].includes(normalized)) {
    variant = 'danger';
  } else if (['pending', 'half_open', 'retry'].includes(normalized)) {
    variant = 'warning';
  }

  const displayLabel = label || status;

  return (
    <span className={`status-badge status-badge--${variant} status-badge--${size}`}>
      <span className={`status-badge__dot ${pulse ? 'status-badge__dot--pulse' : ''}`} />
      <span className="status-badge__label">{displayLabel}</span>
    </span>
  );
};
