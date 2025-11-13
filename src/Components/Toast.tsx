import React, { useState, useEffect, useCallback } from 'react';
import { NETWORK_CONFIG } from '../config/network';
import './Toast.css';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  txHash?: string;
  onClose: (id: string) => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  txHash,
  onClose,
  duration = 5000
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onClose(id), 300); // Wait for animation
  }, [id, onClose]);

  useEffect(() => {
    // Auto close after duration
    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  const getExplorerUrl = (hash: string) => {
    // Use the configured block explorer URL from network config
    return `${NETWORK_CONFIG.blockExplorerUrl}/tx/${hash}`;
  };

  return (
    <div className={`toast ${type} ${isVisible ? 'visible' : ''}`}>
      <div className="toast-content">
        <div className="toast-message">
          {type === 'success' && '✅ '}
          {type === 'error' && '❌ '}
          {type === 'info' && 'ℹ️ '}
          {message}
        </div>
        
        {txHash && (
          <a
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="tx-link"
            title={`View transaction on ${NETWORK_CONFIG.name} Explorer`}
          >
            View TX
          </a>
        )}
        
        <button className="toast-close" onClick={handleClose}>
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
