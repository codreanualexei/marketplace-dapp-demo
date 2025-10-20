import React, { useState } from "react";
import { useWallet, WalletType } from "../contexts/WalletContext";
import "./WalletButton.css";

const WalletButton: React.FC = () => {
  const {
    account,
    balance,
    connectWallet,
    disconnectWallet,
    isConnecting,
    error,
    walletType,
  } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleWalletConnect = async (walletType: WalletType) => {
    setShowWalletOptions(false);
    await connectWallet(walletType);
  };

  const getWalletDisplayName = (type: WalletType | null) => {
    switch (type) {
      case "metamask":
        return "MetaMask";
      case "walletconnect":
        return "WalletConnect";
      default:
        return "Wallet";
    }
  };

  if (!account) {
    return (
      <div className="wallet-button-container">
        <button
          className="wallet-connect-button"
          onClick={() => setShowWalletOptions(!showWalletOptions)}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>

        {showWalletOptions && (
          <div className="wallet-options-dropdown">
            <button
              className="wallet-option-button"
              onClick={() => handleWalletConnect("metamask")}
              disabled={isConnecting}
            >
              <span className="wallet-icon">🦊</span>
              MetaMask
            </button>
            <button
              className="wallet-option-button"
              onClick={() => handleWalletConnect("walletconnect")}
              disabled={isConnecting}
            >
              <span className="wallet-icon">🔗</span>
              WalletConnect
            </button>
          </div>
        )}

        {error && <div className="wallet-error">{error}</div>}
        {showWalletOptions && (
          <div
            className="dropdown-overlay"
            onClick={() => setShowWalletOptions(false)}
          />
        )}
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
          <span className="wallet-type">
            {getWalletDisplayName(walletType)}
          </span>
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
            <div className="dropdown-item">
              <span className="dropdown-label">Wallet:</span>
              <span className="dropdown-value">
                {getWalletDisplayName(walletType)}
              </span>
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
