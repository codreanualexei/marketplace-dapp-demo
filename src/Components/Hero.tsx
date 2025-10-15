import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import './Hero.css';

interface HeroProps {
  onNavigate?: (page: string) => void;
}

const Hero: React.FC<HeroProps> = ({ onNavigate }) => {
  const { account, connectWallet } = useWallet();

  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            Discover, Collect, and Sell
            <span className="gradient-text"> Extraordinary NFTs</span>
          </h1>
          <p className="hero-description">
            The world's first and largest digital marketplace for crypto collectibles and non-fungible tokens.
            Buy, sell, and discover exclusive digital items.
          </p>
          <div className="hero-actions">
            {!account ? (
              <button className="hero-button primary" onClick={connectWallet}>
                Connect Wallet
              </button>
            ) : (
              <>
                <button 
                  className="hero-button primary"
                  onClick={() => onNavigate && onNavigate('marketplace')}
                >
                  Explore Marketplace
                </button>
                <button 
                  className="hero-button secondary"
                  onClick={() => onNavigate && onNavigate('my-domains')}
                >
                  My Domains
                </button>
              </>
            )}
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <h3>100K+</h3>
              <p>NFTs</p>
            </div>
            <div className="stat-item">
              <h3>50K+</h3>
              <p>Artists</p>
            </div>
            <div className="stat-item">
              <h3>25K+</h3>
              <p>Collections</p>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="nft-card-demo">
            <div className="nft-card-inner">
              <div className="nft-card-gradient"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

