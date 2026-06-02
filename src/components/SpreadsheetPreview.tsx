import React from 'react';

interface SpreadsheetPreviewProps {
  sheetNames: string[];
  sheetData: (string | number | boolean | null | undefined)[][];
  activeSheetIdx: number;
  onSheetChange: (idx: number) => void;
}

export const SpreadsheetPreview: React.FC<SpreadsheetPreviewProps> = ({
  sheetNames,
  sheetData,
  activeSheetIdx,
  onSheetChange
}) => {
  return (
    <div className="preview-spreadsheet-container">
      {sheetNames.length > 1 && (
        <div className="spreadsheet-tabs">
          {sheetNames.map((name, idx) => (
            <button 
              key={idx}
              className={`sheet-tab ${activeSheetIdx === idx ? 'active' : ''}`}
              onClick={() => onSheetChange(idx)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="spreadsheet-table-wrapper">
        <table className="excel-table">
          <tbody>
            {sheetData.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="row-number-cell">{rowIdx + 1}</td>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="excel-cell">
                    {cell !== undefined && cell !== null ? String(cell) : ''}
                  </td>
                ))}
              </tr>
            ))}
            {sheetData.length === 0 && (
              <tr>
                <td style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  This sheet is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
