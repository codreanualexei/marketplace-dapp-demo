import React from 'react';

interface ErrorDisplayProps {
  error: string | null;
  onDismiss: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onDismiss }) => {
  if (!error) return null;

  return (
    <div className="error-display">
      <div className="error-content">
        <div className="error-header">
          <h3>Connection Error</h3>
          <button onClick={onDismiss} className="error-close">×</button>
        </div>
        <div className="error-message">
          {error}
        </div>
        <div className="error-actions">
          <button onClick={onDismiss} className="error-dismiss">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;
