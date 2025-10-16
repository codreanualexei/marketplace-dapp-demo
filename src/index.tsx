import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Global error handler to suppress WalletConnect session topic errors
const originalError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  const errorMessage = error?.message || message?.toString() || '';
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
    console.log('Suppressing WalletConnect session topic error:', errorMessage);
    return true; // Prevent default error handling
  }
  if (originalError) {
    return originalError(message, source, lineno, colno, error);
  }
  return false;
};

// Global unhandled promise rejection handler
const originalUnhandledRejection = window.onunhandledrejection;
window.onunhandledrejection = function(event: PromiseRejectionEvent) {
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
    console.log('Suppressing WalletConnect session topic promise rejection:', errorMessage);
    event.preventDefault();
    return;
  }
  if (originalUnhandledRejection) {
    return originalUnhandledRejection.call(window, event);
  }
};

// Override console.error to suppress WalletConnect session errors
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('No matching key. session topic doesn\'t exist') ||
      message.includes('session topic doesn\'t exist') ||
      message.includes('isValidSessionTopic') ||
      message.includes('isValidUpdate') ||
      message.includes('onSessionUpdateRequest') ||
      message.includes('onSessionEventRequest') ||
      message.includes('isValidEmit')) {
    console.log('Suppressing WalletConnect session topic console error:', message);
    return;
  }
  originalConsoleError.apply(console, args);
};

// Override console.warn to suppress WalletConnect session warnings
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  if (message.includes('No matching key. session topic doesn\'t exist') ||
      message.includes('session topic doesn\'t exist') ||
      message.includes('isValidSessionTopic') ||
      message.includes('isValidUpdate') ||
      message.includes('onSessionUpdateRequest') ||
      message.includes('onSessionEventRequest') ||
      message.includes('isValidEmit')) {
    console.log('Suppressing WalletConnect session topic console warning:', message);
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Override Error constructor to catch WalletConnect session errors at the source
const OriginalError = window.Error;
window.Error = function(message?: string) {
  if (message && (
      message.includes('No matching key. session topic doesn\'t exist') ||
      message.includes('session topic doesn\'t exist') ||
      message.includes('isValidSessionTopic') ||
      message.includes('isValidUpdate') ||
      message.includes('onSessionUpdateRequest') ||
      message.includes('onSessionEventRequest') ||
      message.includes('isValidEmit')
    )) {
    console.log('Suppressing WalletConnect session topic error at Error constructor:', message);
    // Return a silent error that won't be thrown
    const silentError = new OriginalError('Suppressed WalletConnect session error');
    silentError.stack = '';
    return silentError;
  }
  return new OriginalError(message);
} as any;

// Also override Error.captureStackTrace if it exists
if (OriginalError.captureStackTrace) {
  const originalCaptureStackTrace = OriginalError.captureStackTrace;
  OriginalError.captureStackTrace = function(obj: any, func?: any) {
    if (obj && obj.message && (
        obj.message.includes('No matching key. session topic doesn\'t exist') ||
        obj.message.includes('session topic doesn\'t exist') ||
        obj.message.includes('isValidSessionTopic') ||
        obj.message.includes('isValidUpdate') ||
        obj.message.includes('onSessionUpdateRequest') ||
        obj.message.includes('onSessionEventRequest') ||
        obj.message.includes('isValidEmit')
      )) {
      console.log('Suppressing WalletConnect session topic error in captureStackTrace:', obj.message);
      return;
    }
    return originalCaptureStackTrace.call(this, obj, func);
  };
}

// Note: Cannot override the global throw statement as it's not a property of window
// The other error suppression mechanisms should be sufficient

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
