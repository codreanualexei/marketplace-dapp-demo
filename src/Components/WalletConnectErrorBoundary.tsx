import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class WalletConnectErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a WalletConnect session topic error
    if (error.message && (
        error.message.includes('No matching key. session topic doesn\'t exist') ||
        error.message.includes('session topic doesn\'t exist') ||
        error.message.includes('isValidSessionTopic') ||
        error.message.includes('isValidUpdate') ||
        error.message.includes('onSessionUpdateRequest')
      )) {
      console.log('Suppressing WalletConnect session topic error in error boundary:', error.message);
      // Don't update state for WalletConnect session errors
      return { hasError: false };
    }
    
    // For other errors, update state to show error UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if this is a WalletConnect session topic error
    if (error.message && (
        error.message.includes('No matching key. session topic doesn\'t exist') ||
        error.message.includes('session topic doesn\'t exist') ||
        error.message.includes('isValidSessionTopic') ||
        error.message.includes('isValidUpdate') ||
        error.message.includes('onSessionUpdateRequest')
      )) {
      console.log('Suppressing WalletConnect session topic error in componentDidCatch:', error.message);
      // Don't log or handle WalletConnect session errors
      return;
    }
    
    // Log other errors normally
    console.error('Error caught by WalletConnectErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Only show error UI for non-WalletConnect session errors
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WalletConnectErrorBoundary;
