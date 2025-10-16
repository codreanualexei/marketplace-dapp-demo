import React, { useState, useEffect, useCallback } from 'react';
import Hero from '../Components/Hero';
import { useMarketplaceSDK } from '../hooks/useMarketplaceSDK';
import { useWallet } from '../contexts/WalletContext';
import { ListedToken } from '../sdk/MarketplaceSDK';
import './Home.css';

interface HomeProps {
  onNavigate?: (page: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const sdk = useMarketplaceSDK();
  const { account } = useWallet();
  const [featuredNFTs, setFeaturedNFTs] = useState<ListedToken[]>([]);

  const loadFeaturedNFTs = useCallback(async () => {
    if (!sdk) return;
    
    // Only load featured NFTs if wallet is connected
    if (!account) {
      return;
    }
    
    try {
      const listings = await sdk.getAllActiveListedDomainsOnMarketplaceWithTokenData();
      // Show first 6 as featured
      setFeaturedNFTs(listings.slice(0, 6));
    } catch (err) {
      console.error('Error loading featured NFTs:', err);
    }
  }, [sdk, account]);

  useEffect(() => {
    if (sdk) {
      loadFeaturedNFTs();
    }
  }, [sdk, loadFeaturedNFTs]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="home">
      <Hero onNavigate={onNavigate} />
      
      <section className="featured-section">
        <div className="featured-container">
          <div className="section-header">
            <h2 className="section-title">Featured Domains</h2>
            <p className="section-description">
              Discover and buy premium domain NFTs on the marketplace
            </p>
          </div>
          
          {featuredNFTs.length > 0 ? (
            <>
              <div className="nft-grid">
                {featuredNFTs.map((listing) => (
                  <div key={listing.listingId} className="nft-card">
                    <div className="nft-card-image">
                      <img 
                        src={listing.tokenData?.uri || `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`}
                        alt={`Domain #${listing.tokenId}`}
                        onError={(e) => {
                          e.currentTarget.src = `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`;
                        }}
                      />
                    </div>
                    <div className="nft-card-content">
                      <div className="nft-card-header">
                        <h3 className="nft-card-title">Domain #{listing.tokenId}</h3>
                      </div>
                      <div className="nft-info">
                        <div className="info-row">
                          <span className="label">Price:</span>
                          <span className="value price">{listing.price} MATIC</span>
                        </div>
                        <div className="info-row">
                          <span className="label">Seller:</span>
                          <span className="value">{formatAddress(listing.seller)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="section-footer">
                <button 
                  className="load-more-button"
                  onClick={() => onNavigate && onNavigate('marketplace')}
                >
                  View Marketplace
                </button>
              </div>
            </>
          ) : (
            <div className="empty-featured">
              <p>No domains listed yet. Be the first to list your domain!</p>
              <button 
                className="cta-button"
                onClick={() => onNavigate && onNavigate('my-domains')}
              >
                List Your Domains
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;

