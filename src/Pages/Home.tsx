import React, { useState, useEffect, useCallback } from "react";
import Hero from "../Components/Hero";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { ListedToken } from "../sdk/MarketplaceSDK";
import { useNFTMetadata, getTokenURI } from "../hooks/useNFTMetadata";
import { NFTMetadataDisplay } from "../Components/NFTMetadata";
import "./Home.css";

interface HomeProps {
  onNavigate?: (page: string) => void;
}

// Featured card component with metadata
const FeaturedCard: React.FC<{
  listing: ListedToken;
  tokenURI: string | null;
  formatAddress: (address?: string) => string;
}> = ({ listing, tokenURI, formatAddress }) => {
  const { metadata, isLoading: metadataLoading } = useNFTMetadata(tokenURI);
  
  // Get image from metadata or fallback
  const imageSrc = metadata?.image ||
    listing.tokenData?.image ||
    listing.tokenData?.uri ||
    `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`;

  return (
    <div className="nft-card">
      <div className="nft-card-image">
        <img
          src={imageSrc}
          alt={metadata?.name || `Domain #${listing.tokenId}`}
          onError={(e) => {
            e.currentTarget.src = `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`;
          }}
        />
      </div>
      <div className="nft-card-content">
        <div className="nft-card-header">
          <h3 className="nft-card-title">
            {metadata?.name || `Domain #${listing.tokenId}`}
          </h3>
        </div>

        <NFTMetadataDisplay 
          metadata={metadata} 
          isLoading={metadataLoading}
          fallbackName={`Domain #${listing.tokenId}`}
        />

        <div className="nft-info">
          <div className="info-row">
            <span className="label">Price:</span>
            <span className="value price">
              {listing.price} MATIC
            </span>
          </div>
          <div className="info-row">
            <span className="label">Seller:</span>
            <span className="value">
              {formatAddress(listing.seller)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const { sdk } = useMarketplaceSDK();
  const [featuredNFTs, setFeaturedNFTs] = useState<ListedToken[]>([]);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [heroTokenURI, setHeroTokenURI] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadFeaturedNFTs = useCallback(async () => {
    if (!sdk) return;

    try {
      setIsLoading(true);
      setFeaturedNFTs([]);
      const listings = await sdk.getAllActiveListingsOptimized();
      const activeListings = listings
        .filter((listing) => listing.active)
        .sort((a, b) => b.listingId - a.listingId)
        .slice(0, 10);

      // The subgraph already includes tokenData, so we can use listings directly
      setFeaturedNFTs(activeListings);

      // Set hero image from the last listing
      const heroListing = activeListings.length > 0 ? activeListings[activeListings.length - 1] : undefined;
      if (heroListing) {
        const tokenURI = getTokenURI(heroListing.tokenData);
        setHeroTokenURI(tokenURI);
        // Set a placeholder for now, Hero component will load the actual image from metadata
        const placeholder = `https://via.placeholder.com/600x600/667eea/ffffff?text=Domain+${heroListing.tokenId}`;
        setHeroImage(placeholder);
      } else {
        setHeroImage(null);
        setHeroTokenURI(null);
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading featured NFTs:", err);
      setIsLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    if (sdk) {
      loadFeaturedNFTs();
    }
  }, [sdk, loadFeaturedNFTs]);

  const formatAddress = (address?: string) => {
    if (!address) return "Unknown";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Show full page loading screen until all data is ready
  if (isLoading) {
    return (
      <div className="home">
        <div className="loading-overlay">
          <div className="loading">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      <Hero onNavigate={onNavigate} heroImage={heroImage} heroTokenURI={heroTokenURI} />

      <section className="featured-section">
        <div className="featured-container">
          <div className="section-header">
            <h2 className="section-title">Featured Domains</h2>
          </div>

          {featuredNFTs.length > 0 ? (
            <>
              <div className="nft-grid">
                {featuredNFTs.map((listing) => {
                  const tokenURI = getTokenURI(listing.tokenData);
                  return <FeaturedCard key={listing.listingId} listing={listing} tokenURI={tokenURI} formatAddress={formatAddress} />;
                })}
              </div>

              <div className="section-footer">
                <button
                  className="load-more-button"
                  onClick={() => onNavigate && onNavigate("marketplace")}
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
                onClick={() => onNavigate && onNavigate("my-domains")}
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
