import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import './NetworkChecker.css';

const AMOY_CHAIN_ID = 80002;
const AMOY_CHAIN_ID_HEX = '0x13882';

const NetworkChecker: React.FC = () => {
  const { chainId, account, switchNetwork, walletType, isNetworkSwitching } = useWallet();
  const [showBanner, setShowBanner] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showManualHelp, setShowManualHelp] = useState(false);

  useEffect(() => {
    console.log('NetworkChecker useEffect:', { account, chainId, AMOY_CHAIN_ID, shouldShow: account && chainId && chainId !== AMOY_CHAIN_ID });
    if (account && chainId && chainId !== AMOY_CHAIN_ID) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [chainId, account]);

  const switchToAmoy = async () => {
    console.log('switchToAmoy button clicked', { chainId, walletType, account });
    setIsSwitching(true);
    try {
      console.log('Calling switchNetwork with AMOY_CHAIN_ID:', AMOY_CHAIN_ID);
      await switchNetwork(AMOY_CHAIN_ID);
      console.log('switchNetwork call completed');
      
      // Show success message briefly
      setTimeout(() => {
        if (chainId === AMOY_CHAIN_ID) {
          console.log('Successfully switched to Polygon Amoy');
        }
      }, 2000);
      
    } catch (error: any) {
      console.error('Error switching network:', error);
      
      // Show more helpful error message based on the actual error
      let errorMessage = error.message || 'Failed to switch network.';
      
      // If it's a user rejection, don't show alert
      if (errorMessage.includes('cancelled by user')) {
        console.log('User cancelled network switch');
      } else {
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
            You're on {chainId ? `Chain ID ${chainId}` : 'wrong network'} using {walletType || 'wallet'}. 
            This marketplace requires <strong>Polygon Amoy (Chain ID: 80002)</strong>
          </p>
          {walletType === 'walletconnect' && (
            <p className="walletconnect-help">
              💡 <strong>Mobile Wallet Tip:</strong> If automatic switching doesn't work, 
              manually switch to Polygon Amoy in your wallet app.
            </p>
          )}
        </div>
        <div className="switch-actions">
          <button 
            className="switch-button" 
            onClick={switchToAmoy}
            disabled={isSwitching || isNetworkSwitching}
          >
            {isSwitching || isNetworkSwitching ? 'Switching...' : 'Switch to Amoy'}
          </button>
          {walletType === 'walletconnect' && (
            <button 
              className="help-button"
              onClick={() => setShowManualHelp(!showManualHelp)}
            >
              {showManualHelp ? 'Hide Help' : 'Need Help?'}
            </button>
          )}
        </div>
        
        {showManualHelp && walletType === 'walletconnect' && (
          <div className="manual-help">
            <h4>Manual Network Setup for Mobile Wallets:</h4>
            <div className="network-config">
              <p><strong>Network Name:</strong> Polygon Amoy Testnet</p>
              <p><strong>RPC URL:</strong> https://rpc-amoy.polygon.technology</p>
              <p><strong>Chain ID:</strong> 80002</p>
              <p><strong>Currency Symbol:</strong> MATIC</p>
              <p><strong>Block Explorer:</strong> https://amoy.polygonscan.com/</p>
            </div>
            <p className="help-instructions">
              1. Open your wallet app<br/>
              2. Go to Settings → Networks<br/>
              3. Add a custom network with the details above<br/>
              4. Switch to the new network
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkChecker;

