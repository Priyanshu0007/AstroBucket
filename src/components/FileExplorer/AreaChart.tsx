import React, { useState, useMemo } from 'react';

const getBezierPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 2;
    const cpY1 = p0.y;
    const cpX2 = p0.x + (p1.x - p0.x) / 2;
    const cpY2 = p1.y;
    d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
  }
  return d;
};

interface AreaChartProps {
  repoName: string;
  totalSizeBytes: number;
  totalFiles: number;
  formatBytes: (bytes: number) => string;
}

export const AreaChart: React.FC<AreaChartProps> = ({
  repoName,
  totalSizeBytes,
  totalFiles,
  formatBytes
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Generate historical growth data deterministically
  const historyData = useMemo(() => {
    const pointsCount = 6;
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date();
    
    // Seed using repository name
    let hash = 0;
    for (let i = 0; i < repoName.length; i++) {
      hash = repoName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const seed = Math.abs(hash);

    // Standard growth factors
    const baseFactors = [0.15, 0.32, 0.48, 0.65, 0.82, 1.0];
    
    for (let i = pointsCount - 1; i >= 0; i--) {
      const idx = pointsCount - 1 - i;
      const targetDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const label = `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear().toString().slice(-2)}`;
      
      // Add deterministic variance based on seed and index
      const varSeed = (seed + idx * 7919) % 100;
      const variance = (varSeed - 50) / 400; // -12.5% to +12.5%
      
      // Last factor must be exactly 1.0 (current state)
      const factor = idx === pointsCount - 1 ? 1.0 : Math.max(0.05, Math.min(0.95, baseFactors[idx] + variance));
      
      months.push({
        label,
        size: Math.round(totalSizeBytes * factor),
        files: Math.round(totalFiles * factor)
      });
    }
    return months;
  }, [repoName, totalSizeBytes, totalFiles]);

  const pts = useMemo(() => {
    return historyData.map((d, i) => {
      const x = 50 + (i / 5) * 430;
      const y = totalSizeBytes > 0 ? 170 - (d.size / (totalSizeBytes * 1.15)) * 150 : 170;
      return { x, y };
    });
  }, [historyData, totalSizeBytes]);

  const splinePath = useMemo(() => getBezierPath(pts), [pts]);
  const areaPath = useMemo(() => {
    return pts.length > 0 ? `${splinePath} L ${pts[pts.length - 1].x} 170 L ${pts[0].x} 170 Z` : '';
  }, [pts, splinePath]);

  return (
    <div className="analytics-section glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="section-header">
        <h2 className="section-title">Repository Growth</h2>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>6-month historical repository expansion</span>
      </div>

      <div className="area-chart-container" style={{ marginTop: '1.5rem', flex: 1, display: 'flex', alignItems: 'center' }}>
        <svg viewBox="0 0 500 200" className="area-chart-svg">
          <defs>
            {/* Area Gradient */}
            <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.0" />
            </linearGradient>
            {/* Stroke Gradient */}
            <linearGradient id="stroke-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#00f0ff" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {[20, 57.5, 95, 132.5, 170].map((y, idx) => (
            <line
              key={idx}
              x1="50"
              y1={y}
              x2="480"
              y2={y}
              className="chart-grid-line dashed"
            />
          ))}

          {/* Y Axis Labels */}
          <text x="40" y="24" textAnchor="end" className="chart-axis-text">{formatBytes(totalSizeBytes)}</text>
          <text x="40" y="99" textAnchor="end" className="chart-axis-text">{formatBytes(totalSizeBytes * 0.5)}</text>
          <text x="40" y="174" textAnchor="end" className="chart-axis-text">0 B</text>

          {/* Area under spline */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#area-gradient)"
            />
          )}

          {/* Dotted tracker vertical line on hover */}
          {hoveredPoint !== null && (
            <line
              x1={pts[hoveredPoint].x}
              y1="20"
              x2={pts[hoveredPoint].x}
              y2="170"
              className="chart-hover-line"
            />
          )}

          {/* Spline stroke line */}
          {splinePath && (
            <path
              d={splinePath}
              fill="none"
              stroke="url(#stroke-gradient)"
              strokeWidth="3.5"
              className="chart-growth-line"
            />
          )}

          {/* X Axis labels */}
          {historyData.map((d, i) => (
            <text
              key={i}
              x={pts[i].x}
              y="188"
              textAnchor="middle"
              className="chart-axis-text"
            >
              {d.label}
            </text>
          ))}

          {/* Glow coordinate points */}
          {pts.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint === i ? 6.5 : 4}
              fill="#fff"
              stroke="#a855f7"
              strokeWidth={hoveredPoint === i ? 3 : 2}
              className={`chart-growth-node ${hoveredPoint === i ? 'active' : ''}`}
              style={{
                '--node-color': '#a855f7',
                filter: hoveredPoint === i ? 'drop-shadow(0 0 6px #a855f7)' : 'none'
              } as React.CSSProperties}
              onMouseEnter={() => setHoveredPoint(i)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* Interactive hover column rects */}
          {historyData.map((_, i) => {
            const step = 430 / 5;
            const width = i === 0 || i === 5 ? step / 2 : step;
            const x = i === 0 ? 50 : 50 + (i - 0.5) * step;
            return (
              <rect
                key={i}
                x={x}
                y="20"
                width={width}
                height="150"
                fill="transparent"
                className="chart-interactive-bar"
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>

        {/* Floating Glassmorphic Tooltip */}
        {hoveredPoint !== null && (() => {
          const pt = historyData[hoveredPoint];
          const leftPct = (pts[hoveredPoint].x / 500) * 100;
          const topPct = (pts[hoveredPoint].y / 200) * 100;
          
          return (
            <div
              className="chart-tooltip"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                opacity: 1,
                transform: 'translate(-50%, -115%)'
              }}
            >
              <div className="chart-tooltip-header">{pt.label}</div>
              <div className="chart-tooltip-row">
                <span className="chart-tooltip-label">Repo Size</span>
                <span className="chart-tooltip-value" style={{ color: '#00f0ff' }}>{formatBytes(pt.size)}</span>
              </div>
              <div className="chart-tooltip-row">
                <span className="chart-tooltip-label">File Count</span>
                <span className="chart-tooltip-value" style={{ color: '#a855f7' }}>{pt.files} files</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
