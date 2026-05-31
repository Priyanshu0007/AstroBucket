import React from 'react';
import { Home, ChevronRight } from 'lucide-react';

interface BreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onBreadcrumbClick: (index: number) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  currentPath,
  onNavigate,
  onBreadcrumbClick
}) => {
  const breadcrumbParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="breadcrumbs">
      <div 
        className={`breadcrumb-item ${breadcrumbParts.length === 0 ? 'breadcrumb-active' : ''}`}
        onClick={() => onNavigate('')}
        style={{ display: 'flex', alignItems: 'center' }}
      >
        <Home size={14} style={{ marginRight: '4px' }}/> Root
      </div>
      
      {breadcrumbParts.map((part, index) => (
        <React.Fragment key={index}>
          <ChevronRight size={14} className="breadcrumb-separator" />
          <div 
            className={`breadcrumb-item ${index === breadcrumbParts.length - 1 ? 'breadcrumb-active' : ''}`}
            onClick={() => onBreadcrumbClick(index)}
          >
            {part}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
