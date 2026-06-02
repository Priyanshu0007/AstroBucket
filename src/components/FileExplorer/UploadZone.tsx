import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

interface UploadZoneProps {
  uploading: boolean;
  onUpload: (files: { file: File; relativePath: string }[]) => void;
}

const getFilesFromEntry = async (entry: FileSystemEntry): Promise<{ file: File; relativePath: string }[]> => {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve) => {
      fileEntry.file((file: File) => {
        const cleanPath = entry.fullPath.startsWith('/') 
          ? entry.fullPath.substring(1) 
          : entry.fullPath;
        resolve([{ file, relativePath: cleanPath }]);
      });
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const dirReader = dirEntry.createReader();
    const readEntries = (): Promise<FileSystemEntry[]> => {
      return new Promise((resolve, reject) => {
        dirReader.readEntries(resolve, reject);
      });
    };

    try {
      let entries: FileSystemEntry[] = [];
      let readBatch = await readEntries();
      while (readBatch.length > 0) {
        entries = entries.concat(readBatch);
        readBatch = await readEntries();
      }

      const results = await Promise.all(
        entries.map((childEntry) => getFilesFromEntry(childEntry))
      );
      return results.flat();
    } catch (err) {
      console.error('Error reading directory entries', err);
      return [];
    }
  }
  return [];
};

const parseDroppedItems = async (items: DataTransferItemList): Promise<{ file: File; relativePath: string }[]> => {
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        entries.push(entry);
      }
    }
  }

  if (entries.length > 0) {
    const fileLists = await Promise.all(entries.map(entry => getFilesFromEntry(entry)));
    return fileLists.flat();
  }
  return [];
};

export const UploadZone: React.FC<UploadZoneProps> = ({ uploading, onUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (uploading) return;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      try {
        const filesList = await parseDroppedItems(e.dataTransfer.items);
        if (filesList.length > 0) {
          onUpload(filesList);
        }
      } catch (err) {
        console.error('Error scanning dropped files:', err);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesList = Array.from(e.dataTransfer.files).map(file => ({
        file,
        relativePath: file.name
      }));
      onUpload(filesList);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    if (e.target.files && e.target.files.length > 0) {
      const filesList = Array.from(e.target.files).map(file => ({
        file,
        relativePath: file.name
      }));
      onUpload(filesList);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div 
      className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
      style={{ marginBottom: '1.5rem' }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleFileDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        style={{ display: 'none' }} 
        ref={fileInputRef} 
        onChange={handleFileInput}
        multiple
      />
      <Upload size={40} className={uploading ? 'spin' : ''} style={{ color: uploading ? 'var(--primary)' : 'var(--text-muted)' }} />
      {uploading ? (
        <h3 className="text-primary" style={{ fontSize: '1.1rem' }}>Uploading files... (see progress panel)</h3>
      ) : (
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Drag & Drop to upload files or folders</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>or click to select multiple files from your machine</p>
        </div>
      )}
    </div>
  );
};
