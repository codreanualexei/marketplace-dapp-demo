import React, { useState, useEffect } from "react";
import { useWallet, WalletType } from "../contexts/WalletContext";
import { useNFTMetadata } from "../hooks/useNFTMetadata";
import "./Hero.css";

interface HeroProps {
  onNavigate?: (page: string) => void;
  heroImage?: string | null;
  heroTokenURI?: string | null;
}

const Hero: React.FC<HeroProps> = ({ onNavigate, heroImage, heroTokenURI }) => {
  // Fetch metadata for hero image if tokenURI is provided
  const { metadata } = useNFTMetadata(heroTokenURI);
  
  // Use image from metadata if available, otherwise fall back to heroImage prop
  const displayImage = metadata?.image || heroImage;
  const { account, connectWallet, isConnecting } = useWallet();
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  
  // Animated stats - start from 0 and animate to target values
  const [nftCount, setNftCount] = useState(0);
  const [artistCount, setArtistCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  
  // Target values (dummy values)
  const targetNFTs = 100;
  const targetArtists = 50;
  const targetCollections = 25;
  
  // Animate stats from 0 to target values
  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 60; // 60 steps for smooth animation
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      // Ease-out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setNftCount(Math.floor(targetNFTs * easeOut));
      setArtistCount(Math.floor(targetArtists * easeOut));
      setCollectionCount(Math.floor(targetCollections * easeOut));
      
      if (currentStep >= steps) {
        clearInterval(interval);
        // Ensure final values are set
        setNftCount(targetNFTs);
        setArtistCount(targetArtists);
        setCollectionCount(targetCollections);
      }
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, []);

  const handleWalletConnect = async (walletType: WalletType) => {
    setShowWalletOptions(false);
    await connectWallet(walletType);
  };

  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            Discover, Collect, and Sell
            <span className="gradient-text"> Extraordinary NFTs</span>
          </h1>
          <p className="hero-description">
            The world's first and largest digital marketplace for crypto
            collectibles and non-fungible tokens. Buy, sell, and discover
            exclusive digital items.
          </p>
          <div className="hero-actions">
            {!account ? (
              <div className="hero-wallet-connect">
                <button
                  className="hero-button primary"
                  onClick={() => setShowWalletOptions(!showWalletOptions)}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
                {showWalletOptions && (
                  <div className="hero-wallet-options">
                    <button
                      className="hero-wallet-option"
                      onClick={() => handleWalletConnect("metamask")}
                      disabled={isConnecting}
                    >
                      🦊 MetaMask
                    </button>
                    <button
                      className="hero-wallet-option"
                      onClick={() => handleWalletConnect("walletconnect")}
                      disabled={isConnecting}
                    >
                      🔗 WalletConnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  className="hero-button primary"
                  onClick={() => onNavigate && onNavigate("marketplace")}
                >
                  Explore Marketplace
                </button>
                <button
                  className="hero-button secondary"
                  onClick={() => onNavigate && onNavigate("my-domains")}
                >
                  My Domains
                </button>
              </>
            )}
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <h3>{nftCount}K+</h3>
              <p>NFTs</p>
            </div>
            <div className="stat-item">
              <h3>{artistCount}K+</h3>
              <p>Artists</p>
            </div>
            <div className="stat-item">
              <h3>{collectionCount}K+</h3>
              <p>Collections</p>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="nft-card-demo">
            <div className="nft-card-inner">
              <div className="nft-card-gradient"></div>
              {displayImage ? (
                <div className="hero-card-image-wrapper">
                  <img
                    src={displayImage}
                    alt={metadata?.name || "Featured NFT"}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
