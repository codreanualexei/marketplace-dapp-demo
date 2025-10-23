import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast, { ToastProps } from '../Components/Toast';

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
  showSuccess: (title: string, message: string, txHash?: string) => void;
  showError: (title: string, message: string, txHash?: string) => void;
  showInfo: (title: string, message: string, txHash?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastProps = {
      ...toast,
      id,
      onClose: removeToast,
    };
    
    setToasts(prev => [...prev, newToast]);
  };

  const showSuccess = (title: string, message: string, txHash?: string) => {
    showToast({
      type: 'success',
      title,
      message,
      txHash,
      duration: txHash ? 8000 : 5000, // Longer duration for transactions
    });
  };

  const showError = (title: string, message: string, txHash?: string) => {
    showToast({
      type: 'error',
      title,
      message,
      txHash,
      duration: 6000,
    });
  };

  const showInfo = (title: string, message: string, txHash?: string) => {
    showToast({
      type: 'info',
      title,
      message,
      txHash,
      duration: 5000,
    });
  };

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
