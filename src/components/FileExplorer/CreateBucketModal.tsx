import React, { useState } from 'react';
import axios from 'axios';
import { X, RefreshCw, Check, AlertCircle, Lock, Globe, FolderPlus } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { GithubSession } from '../../App';

interface CreateBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: GithubSession;
  onSuccess: (repoName: string, branchName: string) => void;
}

interface GithubRepoCreateResponse {
  name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}

export const CreateBucketModal: React.FC<CreateBucketModalProps> = ({
  isOpen,
  onClose,
  session,
  onSuccess,
}) => {
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [branchName, setBranchName] = useState('main');

  // Wizard state: idle | creating | initializing | finalizing | success | error
  const [status, setStatus] = useState<'idle' | 'creating' | 'initializing' | 'finalizing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [nameError, setNameError] = useState('');

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setRepoName(val);
    if (!val.trim()) {
      setNameError('Repository name is required.');
      return;
    }

    // GitHub repository name constraints: only alphanumeric characters, hyphens, and underscores
    const regex = /^[a-zA-Z0-9-_]+$/;
    if (!regex.test(val)) {
      setNameError('Only letters, numbers, hyphens (-), and underscores (_) are allowed.');
    } else {
      setNameError('');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError || !repoName.trim()) return;

    setStatus('creating');
    setErrorMessage('');

    try {
      // Step 1: Create repository on GitHub
      const createResponse = await apiClient.post<GithubRepoCreateResponse>(
        '/user/repos',
        {
          name: repoName.trim(),
          description: description.trim(),
          private: isPrivate,
          auto_init: true, // Creates initial commit with README.md so default branch is initialized
        }
      );

      const defaultBranch = createResponse.data.default_branch || branchName.trim() || 'main';

      // Step 2: Initialize with .gitkeep file
      setStatus('initializing');
      
      // We will wait 1 second to make sure GitHub has provisioned the repository contents structure
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await apiClient.put(
        `/repos/${session.owner}/${repoName.trim()}/contents/.gitkeep`,
        {
          message: 'Initialize repository with .gitkeep',
          content: '', // empty base64 string
          branch: defaultBranch,
        }
      );

      // Step 3: Attach to AstroBucket
      setStatus('finalizing');
      await new Promise((resolve) => setTimeout(resolve, 800));

      setStatus('success');
      onSuccess(repoName.trim(), defaultBranch);
      onClose();
    } catch (err) {
      console.error('Failed to create repository wizard', err);
      setStatus('error');
      if (axios.isAxiosError(err)) {
        const resData = err.response?.data as { message?: string } | undefined;
        setErrorMessage(resData?.message || err.message || 'API request failed.');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create and initialize repository.');
      }
    }
  };

  const isProcessing = status !== 'idle' && status !== 'error' && status !== 'success';

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card create-bucket-dialog">
        <header className="create-bucket-header">
          <div className="create-bucket-title text-gradient">
            <FolderPlus size={20} />
            <span>Create New Bucket</span>
          </div>
          {!isProcessing && (
            <button className="btn-icon" onClick={onClose} aria-label="Close modal">
              <X size={16} />
            </button>
          )}
        </header>

        <p className="create-bucket-subtitle">
          Instantly provision a new repository on your GitHub account configured as a CDN storage bucket.
        </p>

        {status === 'idle' || status === 'error' ? (
          <form onSubmit={handleCreate}>
            {status === 'error' && (
              <div className="error-banner" style={{ marginBottom: '1.25rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="input-group">
              <label className="input-label" htmlFor="repo-name">Repository Name</label>
              <input
                id="repo-name"
                type="text"
                className="input-field"
                placeholder="e.g. my-cdn-bucket"
                value={repoName}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                disabled={isProcessing}
                autoFocus
              />
              {nameError && (
                <span className="input-validation-msg">
                  <AlertCircle size={12} /> {nameError}
                </span>
              )}
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="repo-desc">Description (Optional)</label>
              <textarea
                id="repo-desc"
                className="input-field"
                placeholder="Brief description of your storage bucket assets"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isProcessing}
                style={{ resize: 'vertical', minHeight: '60px', maxHeight: '120px' }}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Bucket Visibility</label>
              <div className="visibility-options">
                <button
                  type="button"
                  className={`visibility-card ${!isPrivate ? 'active-public' : ''}`}
                  onClick={() => setIsPrivate(false)}
                  disabled={isProcessing}
                >
                  <div className="visibility-card-header public-text">
                    <Globe size={16} />
                    <span>Public</span>
                  </div>
                  <span className="visibility-card-desc">
                    Allows public access via jsDelivr edge CDN links. Recommended for web assets.
                  </span>
                </button>

                <button
                  type="button"
                  className={`visibility-card ${isPrivate ? 'active-private' : ''}`}
                  onClick={() => setIsPrivate(true)}
                  disabled={isProcessing}
                >
                  <div className="visibility-card-header private-text">
                    <Lock size={16} />
                    <span>Private</span>
                  </div>
                  <span className="visibility-card-desc">
                    Fully secure. Files are private, but public CDN links will not resolve.
                  </span>
                </button>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label className="input-label" htmlFor="branch-name">Default Branch Name</label>
              <input
                id="branch-name"
                type="text"
                className="input-field"
                placeholder="main"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={isProcessing || !!nameError || !repoName.trim()}
            >
              Create and Attach Bucket
            </button>
          </form>
        ) : (
          <div>
            <div className="wizard-steps">
              <div className={`wizard-step ${status === 'creating' ? 'active' : 'completed'}`}>
                <div className="step-icon-container">
                  {status === 'creating' ? <RefreshCw size={12} className="spin" /> : <Check size={12} />}
                </div>
                <span>Create repository on GitHub</span>
              </div>

              <div className={`wizard-step ${
                status === 'initializing' ? 'active' : status === 'creating' ? 'idle' : 'completed'
              }`}>
                <div className="step-icon-container">
                  {status === 'initializing' ? (
                    <RefreshCw size={12} className="spin" />
                  ) : status === 'creating' ? (
                    '2'
                  ) : (
                    <Check size={12} />
                  )}
                </div>
                <span>Initialize with .gitkeep file</span>
              </div>

              <div className={`wizard-step ${
                status === 'finalizing' ? 'active' : status === 'success' ? 'completed' : 'idle'
              }`}>
                <div className="step-icon-container">
                  {status === 'finalizing' ? (
                    <RefreshCw size={12} className="spin" />
                  ) : status === 'success' ? (
                    <Check size={12} />
                  ) : (
                    '3'
                  )}
                </div>
                <span>Attach to AstroBucket console</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span>Provisioning in progress, please do not close...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
