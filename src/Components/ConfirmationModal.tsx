import React from "react";
import "./ConfirmationModal.css";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
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
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "default",
  isLoading = false,
}) => {
  if (!isOpen) return null;

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
            {message}
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

