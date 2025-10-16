import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Handle uncaught promise rejections from WalletConnect
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error && typeof error === 'object' && error.message) {
    // Handle WalletConnect session errors gracefully
    if (error.message.includes('No matching key. session topic doesn\'t exist') ||
        error.message.includes('Pending session not found') ||
        error.message.includes('No matching key. proposal')) {
      console.log('WalletConnect session error handled gracefully:', error.message);
      event.preventDefault(); // Prevent the error from being logged to console
      return;
    }
  }
  // Let other errors pass through normally
});

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
