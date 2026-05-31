import React from 'react';
import { Check } from 'lucide-react';

interface ToastNotificationProps {
  copiedFileUrl: string | null;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ copiedFileUrl }) => {
  if (!copiedFileUrl) return null;

  return (
    <div className="toast-container">
      <div className="toast success">
        <Check size={18} style={{ color: '#10b981' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Link Copied!</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {copiedFileUrl}
          </span>
        </div>
      </div>
    </div>
  );
};
