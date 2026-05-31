import React, { useState, useEffect, useRef } from 'react';
import type { GithubFile } from '../../api/types';
import { getCdnUrl, fetchFileRaw } from '../../api/client';
import { 
  Folder, 
  File as FileIcon, 
  Code, 
  RefreshCw, 
  Music, 
  Play, 
  Pause, 
  FileText 
} from 'lucide-react';

interface MediaThumbnailProps {
  file: GithubFile;
  creds: {
    token: string;
    owner: string;
    repo: string;
    branch: string;
  };
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({ file, creds }) => {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
  const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];

  useEffect(() => {
    if (file.type === 'dir') return;

    let active = true;
    let localUrl = '';
    const cdnUrl = getCdnUrl(creds.owner, creds.repo, creds.branch, file.path);

    const checkAndLoad = async () => {
      if (imageExts.includes(ext) || videoExts.includes(ext) || audioExts.includes(ext)) {
        // Try the CDN URL first
        try {
          const res = await fetch(cdnUrl, { method: 'HEAD' });
          if (res.ok && active) {
            setSrc(cdnUrl);
            setLoading(false);
            return;
          }
        } catch (e) {
          // If HEAD request fails, fallback to loading via raw file fetch (e.g. private repo)
        }

        // Fallback for private repository or failed CDN
        try {
          const blob = await fetchFileRaw(creds, file.path);
          if (active) {
            localUrl = URL.createObjectURL(blob);
            setSrc(localUrl);
            setLoading(false);
          }
        } catch (err) {
          console.error("Failed to load thumbnail for", file.name, err);
          if (active) {
            setError(true);
            setLoading(false);
          }
        }
      } else {
        setLoading(false);
      }
    };

    checkAndLoad();

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [file.path, file.sha, creds.owner, creds.repo, creds.branch]);

  // Clean up audio ref on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAudioPlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!src) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.addEventListener('ended', () => {
        setPlaying(false);
      });
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      setPlaying(true);
    }
  };

  if (file.type === 'dir') {
    return <Folder size={40} className="file-icon" style={{ color: 'var(--primary)' }} />;
  }

  if (loading) {
    return (
      <div className="thumbnail-spinner">
        <RefreshCw size={18} className="spin text-muted" />
      </div>
    );
  }

  if (error) {
    return <FileIcon size={36} className="text-muted" style={{ opacity: 0.5 }} />;
  }

  if (imageExts.includes(ext)) {
    return (
      <img 
        src={src} 
        alt={file.name} 
        className="file-thumbnail-img" 
        loading="lazy"
      />
    );
  }

  if (videoExts.includes(ext)) {
    return (
      <div 
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onMouseEnter={(e) => {
          const video = e.currentTarget.querySelector('video');
          if (video) video.play().catch(() => {});
        }}
        onMouseLeave={(e) => {
          const video = e.currentTarget.querySelector('video');
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
        }}
      >
        <video 
          src={src} 
          className="file-thumbnail-video" 
          muted 
          playsInline 
          loop 
          preload="metadata"
        />
        <div className="video-preview-badge">
          <span>PREVIEW</span>
        </div>
      </div>
    );
  }

  if (audioExts.includes(ext)) {
    return (
      <div className="file-thumbnail-audio">
        <Music size={30} style={{ color: '#a855f7', opacity: playing ? 1 : 0.6 }} />
        <button 
          className="audio-preview-btn" 
          onClick={handleAudioPlayToggle}
          title={playing ? "Pause preview" : "Play preview"}
          type="button"
        >
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: '1px' }} />}
        </button>
      </div>
    );
  }

  // Fallback for code, docx, pdf, spreadsheets, etc.
  const codeExts = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'py', 'java', 'go', 'rs'];
  const sheetExts = ['xlsx', 'xls', 'csv'];
  const docxExts = ['docx'];

  if (ext === 'pdf') return <FileText size={36} style={{ color: '#f43f5e' }} />;
  if (sheetExts.includes(ext)) return <FileText size={36} style={{ color: '#10b981' }} />;
  if (docxExts.includes(ext)) return <FileText size={36} style={{ color: '#3b82f6' }} />;
  if (codeExts.includes(ext)) return <Code size={36} style={{ color: '#f59e0b' }} />;

  return <FileIcon size={36} className="text-muted" />;
};
