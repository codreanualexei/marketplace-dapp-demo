import React, { useEffect } from 'react';

interface GlobalErrorHandlerProps {
  children: React.ReactNode;
}

const GlobalErrorHandler: React.FC<GlobalErrorHandlerProps> = ({ children }) => {
  useEffect(() => {
    // Override the global error handler for uncaught errors
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.error?.message || event.message || '';
      
      if (errorMessage.includes('No matching key. session topic doesn\'t exist') ||
          errorMessage.includes('session topic doesn\'t exist') ||
          errorMessage.includes('isValidSessionTopic') ||
          errorMessage.includes('isValidUpdate') ||
          errorMessage.includes('onSessionUpdateRequest') ||
          errorMessage.includes('onSessionEventRequest') ||
          errorMessage.includes('isValidEmit') ||
          errorMessage.includes('Connection request reset') ||
          errorMessage.includes('Please try again') ||
          errorMessage.includes('connection was reset') ||
          errorMessage.includes('request was reset')) {
        console.log('GlobalErrorHandler: Suppressing WalletConnect session error:', errorMessage);
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    // Override the global unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || event.reason?.toString() || '';
      
      if (errorMessage.includes('No matching key. session topic doesn\'t exist') ||
          errorMessage.includes('session topic doesn\'t exist') ||
          errorMessage.includes('isValidSessionTopic') ||
          errorMessage.includes('isValidUpdate') ||
          errorMessage.includes('onSessionUpdateRequest') ||
          errorMessage.includes('onSessionEventRequest') ||
          errorMessage.includes('isValidEmit') ||
          errorMessage.includes('Connection request reset') ||
          errorMessage.includes('Please try again') ||
          errorMessage.includes('connection was reset') ||
          errorMessage.includes('request was reset')) {
        console.log('GlobalErrorHandler: Suppressing WalletConnect session promise rejection:', errorMessage);
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    // Add event listeners
    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
    };
  }, []);

  return <>{children}</>;
};

export default GlobalErrorHandler;
