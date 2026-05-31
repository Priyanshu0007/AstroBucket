import React, { useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';

interface DocxPreviewProps {
  docxBlob: Blob | null;
  loading: boolean;
}

export const DocxPreview: React.FC<DocxPreviewProps> = ({ docxBlob, loading }) => {
  const docxContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (docxBlob && docxContainerRef.current) {
      docxContainerRef.current.innerHTML = '';
      renderAsync(docxBlob, docxContainerRef.current, undefined, {
        className: 'docx-preview-output',
        inWrapper: false
      }).catch(err => {
        console.error('Docx rendering error:', err);
        if (docxContainerRef.current) {
          docxContainerRef.current.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--danger);">Failed to render document visual preview.</div>`;
        }
      });
    }
  }, [docxBlob, loading]);

  return (
    <div className="preview-docx-container">
      <div ref={docxContainerRef} className="docx-render-target" />
    </div>
  );
};
