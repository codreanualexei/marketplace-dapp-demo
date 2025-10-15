import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import './WalletButton.css';

const WalletButton: React.FC = () => {
  const { account, balance, connectWallet, disconnectWallet, isConnecting, error } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!account) {
    return (
      <div className="wallet-button-container">
        <button 
          className="wallet-connect-button"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {error && <div className="wallet-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="wallet-button-container">
      <div className="wallet-info-wrapper">
        <button 
          className="wallet-connected-button"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <span className="wallet-balance">{balance} ETH</span>
          <span className="wallet-address">{formatAddress(account)}</span>
        </button>
        
        {showDropdown && (
          <div className="wallet-dropdown">
            <div className="dropdown-item">
              <span className="dropdown-label">Address:</span>
              <span className="dropdown-value">{formatAddress(account)}</span>
            </div>
            <div className="dropdown-item">
              <span className="dropdown-label">Balance:</span>
              <span className="dropdown-value">{balance} ETH</span>
            </div>
            <button 
              className="disconnect-button"
              onClick={() => {
                disconnectWallet();
                setShowDropdown(false);
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
      {showDropdown && (
        <div 
          className="dropdown-overlay" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default WalletButton;

