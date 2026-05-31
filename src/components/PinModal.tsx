import React, { useState, useEffect } from 'react';
import { Shield, Delete, X } from 'lucide-react';
import { AstroBucketLogo } from './AstroBucketLogo';
import '../styles/components/pin-modal.css';

interface PinModalProps {
  mode: 'create' | 'unlock';
  onComplete: (pin: string) => Promise<void>;
  onClose?: () => void;
  isClosable?: boolean;
  onResetSession?: () => void; // Used for "Disconnect Account" on forgot PIN
}

export const PinModal: React.FC<PinModalProps> = ({
  mode,
  onComplete,
  onClose,
  isClosable = false,
  onResetSession
}) => {
  const [pin, setPin] = useState('');
  const [tempPin, setTempPin] = useState(''); // Stores initial PIN during 'create' flow
  const [step, setStep] = useState<'create' | 'confirm'>(mode === 'create' ? 'create' : 'confirm');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Trigger shake animation
  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  // Handle number keystrokes & actions
  const handleNumClick = (num: string) => {
    if (loading) return;
    setError('');
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  // Keyboard listener for physical keypad input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setError('');
        if (pin.length < 4) {
          setPin(prev => prev + e.key);
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setError('');
        setPin(prev => prev.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, loading]);

  // Monitor PIN entry length to auto-advance
  useEffect(() => {
    if (pin.length === 4) {
      const processPin = async () => {
        setLoading(true);
        if (mode === 'create') {
          if (step === 'create') {
            // Store the first PIN, switch to confirm step
            setTempPin(pin);
            setPin('');
            setStep('confirm');
            setLoading(false);
          } else {
            // Confirming PIN
            if (pin === tempPin) {
              try {
                await onComplete(pin);
              } catch (err: any) {
                setError(err.message || 'Failed to encrypt token.');
                setPin('');
                setStep('create');
                setTempPin('');
                triggerShake();
              }
            } else {
              setError('PINs do not match. Please try again.');
              setPin('');
              setStep('create');
              setTempPin('');
              triggerShake();
            }
            setLoading(false);
          }
        } else {
          // Unlock mode
          try {
            await onComplete(pin);
          } catch (err: any) {
            setError(err.message || 'Incorrect security PIN.');
            setPin('');
            triggerShake();
          } finally {
            setLoading(false);
          }
        }
      };
      
      // Delay slightly for visual feedback before auto-submitting
      const timer = setTimeout(processPin, 200);
      return () => clearTimeout(timer);
    }
  }, [pin, step, tempPin, mode, onComplete]);

  return (
    <div className="pin-modal-overlay">
      <div className={`pin-modal-card glass-panel ${isShaking ? 'shake' : ''}`}>
        {isClosable && onClose && (
          <button 
            type="button" 
            className="modal-close-btn"
            style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}
            onClick={onClose}
            aria-label="Close modal"
            disabled={loading}
          >
            <X size={20} />
          </button>
        )}

        <div className="pin-header">
          <div className="pin-logo-wrapper">
            <AstroBucketLogo size={36} style={{ color: '#60a5fa' }} />
          </div>
          <h2 className="pin-title">
            {mode === 'create'
              ? step === 'create'
                ? 'Create Secure PIN'
                : 'Confirm Secure PIN'
              : 'Enter Security PIN'}
          </h2>
          <p className="pin-subtitle">
            {mode === 'create'
              ? step === 'create'
                ? 'Create a quick 4-digit PIN to encrypt your access token locally.'
                : 'Re-enter your 4-digit PIN to confirm.'
              : 'Provide your security PIN to decrypt your GitHub session.'}
          </p>
        </div>

        {error && <div className="pin-error-text">{error}</div>}

        {/* Input Dots */}
        <div className="pin-dots-container">
          {[0, 1, 2, 3].map(index => {
            const isFilled = pin.length > index;
            const isActive = pin.length === index && !loading;
            return (
              <div
                key={index}
                className={`pin-dot ${isFilled ? 'filled' : ''} ${isActive ? 'active' : ''}`}
              />
            );
          })}
        </div>

        {/* Digital Numpad */}
        <div className="pin-keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              className="keypad-btn"
              onClick={() => handleNumClick(num)}
              disabled={loading}
            >
              {num}
            </button>
          ))}
          {/* Numpad Footer (Blank, 0, Del) */}
          <div style={{ width: 64, height: 64 }} />
          <button
            type="button"
            className="keypad-btn"
            onClick={() => handleNumClick('0')}
            disabled={loading}
          >
            0
          </button>
          <button
            type="button"
            className="keypad-btn action-btn"
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            title="Delete last digit"
          >
            <Delete size={22} />
          </button>
        </div>

        {/* Extra Actions */}
        <div className="pin-actions">
          {mode === 'unlock' && onResetSession && (
            <button
              type="button"
              className="pin-reset-link"
              onClick={() => {
                if (confirm('Disconnecting will clear your local encrypted session. You will need to sign in again. Continue?')) {
                  onResetSession();
                }
              }}
            >
              Forgot PIN? Disconnect Account
            </button>
          )}
          {mode === 'create' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Shield size={12} style={{ color: '#10b981' }} />
              <span>Token is encrypted client-side using AES-GCM-256</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
