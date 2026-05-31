import React, { useState } from 'react';
import { X } from 'lucide-react';

interface FolderCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (folderName: string) => Promise<void>;
}

export const FolderCreationModal: React.FC<FolderCreationModalProps> = ({
  isOpen,
  onClose,
  onCreateFolder
}) => {
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Create New Folder</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleCreateFolderSubmit}>
          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label">Folder Name</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. assets" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
