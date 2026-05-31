import React from 'react';
import { marked } from 'marked';

interface MarkdownPreviewProps {
  textContent: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ textContent }) => {
  return (
    <div className="preview-markdown-container markdown-body">
      <div 
        dangerouslySetInnerHTML={{ __html: marked.parse(textContent, { async: false }) }} 
      />
    </div>
  );
};
