// Utility to suppress WalletConnect session topic errors
export const suppressWalletConnectErrors = () => {
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
      console.log('WalletConnect Error Suppression: Suppressing session error:', errorMessage);
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
      console.log('WalletConnect Error Suppression: Suppressing session promise rejection:', errorMessage);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  };

  // Add event listeners with capture to catch errors early
  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

  // Return cleanup function
  return () => {
    window.removeEventListener('error', handleError, true);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
  };
};

// Wrapper function to suppress errors during WalletConnect operations
export const withWalletConnectErrorSuppression = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  const cleanup = suppressWalletConnectErrors();
  
  try {
    return await operation();
  } finally {
    cleanup();
  }
};
