import React from 'react';
import { Check, AlertCircle } from 'lucide-react';

interface ToastNotificationProps {
  copiedFileUrl: string | null;
  isPrivate?: boolean;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ copiedFileUrl, isPrivate }) => {
  if (!copiedFileUrl) return null;

  return (
    <div className="toast-container">
      <div className={`toast ${isPrivate ? 'error' : 'success'}`}>
        {isPrivate ? (
          <AlertCircle size={18} style={{ color: '#f87171' }} />
        ) : (
          <Check size={18} style={{ color: '#10b981' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ fontSize: '0.85rem', color: '#fff' }}>
            {isPrivate ? 'CDN Link Copied (Private)' : 'Link Copied!'}
          </strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.1rem' }}>
            {copiedFileUrl}
          </span>
          {isPrivate && (
            <span style={{ fontSize: '0.675rem', color: '#f87171', fontWeight: 500 }}>
              🔒 Note: CDN links will not resolve publicly for private repos.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
