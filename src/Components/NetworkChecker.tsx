import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import './NetworkChecker.css';

const AMOY_CHAIN_ID = 80002;
const AMOY_CHAIN_ID_HEX = '0x13882';

const NetworkChecker: React.FC = () => {
  const { chainId, account } = useWallet();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (account && chainId && chainId !== AMOY_CHAIN_ID) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [chainId, account]);

  const switchToAmoy = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask');
      return;
    }

    try {
      // Try to switch to Amoy
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: AMOY_CHAIN_ID_HEX }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: AMOY_CHAIN_ID_HEX,
                chainName: 'Polygon Amoy Testnet',
                nativeCurrency: {
                  name: 'MATIC',
                  symbol: 'MATIC',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc-amoy.polygon.technology'],
                blockExplorerUrls: ['https://amoy.polygonscan.com/'],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
          alert('Failed to add Polygon Amoy network. Please add it manually.');
        }
      } else {
        console.error('Error switching network:', switchError);
        alert('Failed to switch network. Please switch manually in MetaMask.');
      }
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
            You're on {chainId ? `Chain ID ${chainId}` : 'wrong network'}. 
            This marketplace requires <strong>Polygon Amoy (Chain ID: 80002)</strong>
          </p>
        </div>
        <button className="switch-button" onClick={switchToAmoy}>
          Switch to Amoy
        </button>
      </div>
    </div>
  );
};

export default NetworkChecker;

