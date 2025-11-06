import React from "react";
import "./ConfirmationModal.css";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  domainName?: string; // Optional domain name to highlight
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "default" | "danger" | "warning";
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  domainName,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "default",
  isLoading = false,
}) => {
  if (!isOpen) return null;

  // Replace domain name in message with styled version
  const renderMessage = () => {
    if (!domainName) {
      return message;
    }
    
    // Split message by domain name and wrap it with styled span
    const parts = message.split(domainName);
    if (parts.length === 1) {
      return message; // Domain name not found in message
    }
    
    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <span className="confirmation-modal-domain-name">{domainName}</span>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !isLoading) {
      onCancel();
    }
  };

  return (
    <div
      className="confirmation-modal-overlay"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      aria-describedby="confirmation-modal-message"
    >
      <div className={`confirmation-modal ${type}`}>
        <div className="confirmation-modal-header">
          <h3 id="confirmation-modal-title" className="confirmation-modal-title">
            {title}
          </h3>
          {!isLoading && (
            <button
              className="confirmation-modal-close"
              onClick={onCancel}
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        <div className="confirmation-modal-body">
          <p id="confirmation-modal-message" className="confirmation-modal-message">
            {renderMessage()}
          </p>
        </div>

        <div className="confirmation-modal-footer">
          <button
            className="confirmation-modal-button cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className={`confirmation-modal-button confirm ${type}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="button-loading">
                <span className="button-spinner"></span>
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

