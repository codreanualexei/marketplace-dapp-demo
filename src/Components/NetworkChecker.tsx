import React, { useEffect, useState } from "react";
import { useWallet } from "../contexts/WalletContext";
import { NETWORK_CONFIG } from "../config/network";
import "./NetworkChecker.css";

const NetworkChecker: React.FC = () => {
  const { chainId, account, switchNetwork, walletType, isNetworkSwitching } =
    useWallet();
  const [showBanner, setShowBanner] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showManualHelp, setShowManualHelp] = useState(false);

  useEffect(() => {
    if (account && chainId && chainId !== NETWORK_CONFIG.chainId) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [chainId, account]);

  const switchToTargetNetwork = async () => {
    setIsSwitching(true);
    try {
      await switchNetwork(NETWORK_CONFIG.chainId);
    } catch (error: any) {
      console.error("Error switching network:", error);

      // Show more helpful error message based on the actual error
      let errorMessage = error.message || "Failed to switch network.";

      // If it's a user rejection, don't show alert
      if (!errorMessage.includes("cancelled by user")) {
        alert(errorMessage);
      }
    } finally {
      setIsSwitching(false);
    }
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="network-banner">
      <div className="network-banner-content">
        <span className="warning-icon">⚠️</span>
        <div className="banner-text">
          <strong>Wrong Network!</strong>
          <p>
            You're on {chainId ? `Chain ID ${chainId}` : "wrong network"} using{" "}
            {walletType || "wallet"}. This marketplace requires{" "}
            <strong>{NETWORK_CONFIG.name} (Chain ID: {NETWORK_CONFIG.chainId})</strong>
          </p>
          {walletType === "walletconnect" && (
            <p className="walletconnect-help">
              💡 <strong>Mobile Wallet Tip:</strong> If automatic switching
              doesn't work, manually switch to {NETWORK_CONFIG.name} in your wallet app.
            </p>
          )}
        </div>
        <div className="switch-actions">
          <button
            className="switch-button"
            onClick={switchToTargetNetwork}
            disabled={isSwitching || isNetworkSwitching}
          >
            {isSwitching || isNetworkSwitching
              ? "Switching..."
              : `Switch to ${NETWORK_CONFIG.name}`}
          </button>
          {walletType === "walletconnect" && (
            <button
              className="help-button"
              onClick={() => setShowManualHelp(!showManualHelp)}
            >
              {showManualHelp ? "Hide Help" : "Need Help?"}
            </button>
          )}
        </div>

        {showManualHelp && walletType === "walletconnect" && (
          <div className="manual-help">
            <h4>Manual Network Setup for Mobile Wallets:</h4>
            <div className="network-config">
              <p>
                <strong>Network Name:</strong> Polygon Amoy Testnet
              </p>
              <p>
                <strong>RPC URL:</strong> https://rpc-amoy.polygon.technology
              </p>
              <p>
                <strong>Chain ID:</strong> 80002
              </p>
              <p>
                <strong>Currency Symbol:</strong> MATIC
              </p>
              <p>
                <strong>Block Explorer:</strong> https://amoy.polygonscan.com/
              </p>
            </div>
            <p className="help-instructions">
              1. Open your wallet app
              <br />
              2. Go to Settings → Networks
              <br />
              3. Add a custom network with the details above
              <br />
              4. Switch to the new network
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkChecker;
