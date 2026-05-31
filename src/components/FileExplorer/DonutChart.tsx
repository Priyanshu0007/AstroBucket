import React, { useState } from 'react';

interface CategoryDistribution {
  name: string;
  color: string;
  count: number;
  size: number;
  percentage: number;
}

interface DonutChartProps {
  distribution: CategoryDistribution[];
  totalSizeBytes: number;
  totalFiles: number;
  formatBytes: (bytes: number) => string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  distribution,
  totalSizeBytes,
  totalFiles,
  formatBytes
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  return (
    <div className="analytics-section glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="section-header">
        <h2 className="section-title">File-Type Distribution</h2>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>Interactive storage allocation by type</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flex: 1 }}>
        {/* SVG Donut Chart */}
        <div className="donut-chart-container">
          <div className="donut-chart-wrapper">
            <svg viewBox="0 0 200 200" className="donut-svg" style={{ width: '100%', height: '100%' }}>
              <defs>
                <filter id="cyber-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              
              {/* Background Circle */}
              <circle
                cx="100"
                cy="100"
                r="65"
                fill="none"
                stroke="rgba(255, 255, 255, 0.02)"
                strokeWidth="18"
              />
              
              {/* Segment Circles */}
              {(() => {
                let accumPct = 0;
                const R = 65;
                const C = 2 * Math.PI * R;
                return distribution.map((segment, idx) => {
                  if (segment.percentage <= 0) return null;
                  
                  const p = segment.percentage;
                  const strokeDasharray = `${(p / 100) * C} ${C}`;
                  const strokeDashoffset = -((accumPct / 100) * C);
                  
                  // Calculate bisecting angle
                  const startPct = accumPct;
                  const midPct = startPct + p / 2;
                  const midAngleDeg = (midPct / 100) * 360;
                  const angleRad = ((midAngleDeg - 90) * Math.PI) / 180;
                  
                  accumPct += p;
                  
                  const isHovered = hoveredSegment === idx;
                  const hoverDist = isHovered ? 6 : 0;
                  const dx = Math.cos(angleRad) * hoverDist;
                  const dy = Math.sin(angleRad) * hoverDist;
                  
                  return (
                    <circle
                      key={idx}
                      cx="100"
                      cy="100"
                      r="65"
                      fill="none"
                      stroke={segment.color}
                      strokeWidth={isHovered ? 24 : 18}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      transform={`rotate(-90 100 100) translate(${dx}, ${dy})`}
                      className={`donut-segment ${isHovered ? 'hovered' : ''}`}
                      style={{
                        filter: isHovered ? `drop-shadow(0 0 10px ${segment.color})` : 'none',
                      }}
                      onMouseEnter={() => setHoveredSegment(idx)}
                      onMouseLeave={() => setHoveredSegment(null)}
                    />
                  );
                });
              })()}
            </svg>
            
            {/* Center text overlay */}
            <div className="donut-center-text">
              {(() => {
                const data = hoveredSegment !== null ? distribution[hoveredSegment] : null;
                if (data) {
                  return (
                    <>
                      <span className="donut-center-label" style={{ color: data.color }}>{data.name}</span>
                      <span className="donut-center-val">{formatBytes(data.size)}</span>
                      <span className="donut-center-sub">{data.count} file{data.count !== 1 ? 's' : ''} ({data.percentage}%)</span>
                    </>
                  );
                }
                return (
                  <>
                    <span className="donut-center-label" style={{ color: 'var(--text-muted)' }}>TOTAL STORAGE</span>
                    <span className="donut-center-val">{formatBytes(totalSizeBytes)}</span>
                    <span className="donut-center-sub">{totalFiles} files</span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Distribution Legend Grid inside same panel */}
        <div className="distribution-legend-grid" style={{ width: '100%', marginTop: '0.5rem' }}>
          {distribution.map((segment, idx) => {
            const isHovered = hoveredSegment === idx;
            return (
              <div
                key={idx}
                className={`legend-item glass-card interactive ${isHovered ? 'highlighted' : ''}`}
                style={{
                  '--highlight-color': segment.color,
                  opacity: hoveredSegment !== null && !isHovered ? 0.55 : 1
                } as React.CSSProperties}
                onMouseEnter={() => setHoveredSegment(idx)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="legend-header">
                  <span className="legend-color-dot" style={{ backgroundColor: segment.color }} />
                  <span className="legend-name">{segment.name}</span>
                </div>
                <div className="legend-body">
                  <span className="legend-size">{formatBytes(segment.size)}</span>
                  <span className="legend-percentage">{segment.percentage}%</span>
                </div>
                <div className="legend-footer text-muted">
                  {segment.count} file{segment.count !== 1 ? 's' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
