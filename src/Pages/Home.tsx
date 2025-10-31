import React, { useState, useEffect, useCallback } from "react";
import Hero from "../Components/Hero";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { ListedToken } from "../sdk/MarketplaceSDK";
import "./Home.css";

interface HomeProps {
  onNavigate?: (page: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const { sdk } = useMarketplaceSDK();
  const [featuredNFTs, setFeaturedNFTs] = useState<ListedToken[]>([]);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(true);

  const loadFeaturedNFTs = useCallback(async () => {
    if (!sdk) return;

    try {
      setHeroLoading(true);
      setIsLoadingFeatured(true);
      setFeaturedNFTs([]);
      const listings = await sdk.getAllActiveListingsOptimized();
      const activeListings = listings
        .filter((listing) => listing.active)
        .sort((a, b) => b.listingId - a.listingId)
        .slice(0, 10);

      const enhancedListings: ListedToken[] = [];

      for (const listing of activeListings) {
        let enhancedListing = listing;

        if (!listing.tokenData?.image) {
          try {
            const tokenData = await sdk.getTokenData(Number(listing.tokenId));
            if (tokenData) {
              enhancedListing = {
                ...listing,
                tokenData: {
                  ...listing.tokenData,
                  ...tokenData,
                },
              };
            }
          } catch (error) {
            console.warn(`Failed to load token data for listing ${listing.listingId}`, error);
          }
        }

        enhancedListings.push(enhancedListing);
        setFeaturedNFTs((prev) => [...prev, enhancedListing]);

        // Small delay for progressive loading effect similar to marketplace page
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      const heroListing = enhancedListings.length > 0 ? enhancedListings[enhancedListings.length - 1] : undefined;
      if (heroListing) {
        const image = heroListing.tokenData?.image || heroListing.tokenData?.uri;
        const placeholder = `https://via.placeholder.com/600x600/667eea/ffffff?text=Domain+${heroListing.tokenId}`;
        setHeroImage(image || placeholder);
      } else {
        setHeroImage(null);
      }
      setHeroLoading(false);
      setIsLoadingFeatured(false);
    } catch (err) {
      console.error("Error loading featured NFTs:", err);
      setHeroLoading(false);
      setIsLoadingFeatured(false);
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

  return (
    <div className="home">
      <Hero onNavigate={onNavigate} heroImage={heroImage} isHeroLoading={heroLoading} />

      <section className="featured-section">
        <div className="featured-container">
          <div className="section-header">
            <h2 className="section-title">Featured Domains</h2>
          </div>

          {featuredNFTs.length > 0 || isLoadingFeatured ? (
            <>
              <div className="nft-grid">
                {featuredNFTs.map((listing) => (
                  <div key={listing.listingId} className="nft-card">
                    <div className="nft-card-image">
                      <img
                        src={
                          listing.tokenData?.image ||
                          listing.tokenData?.uri ||
                          `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`
                        }
                        alt={`Domain #${listing.tokenId}`}
                        onError={(e) => {
                          e.currentTarget.src = `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`;
                        }}
                      />
                    </div>
                    <div className="nft-card-content">
                      <div className="nft-card-header">
                        <h3 className="nft-card-title">
                          Domain #{listing.tokenId}
                        </h3>
                      </div>
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
                ))}

                {isLoadingFeatured && (
                  <div className="nft-card loading-card">
                    <div className="nft-card-image">
                      <div className="loading-placeholder">
                        <div className="spinner"></div>
                      </div>
                    </div>
                    <div className="nft-card-content">
                      <div className="nft-card-header">
                        <div className="loading-text"></div>
                      </div>
                      <div className="nft-info">
                        <div className="info-row">
                          <div className="loading-bar"></div>
                        </div>
                        <div className="info-row">
                          <div className="loading-bar"></div>
                        </div>
                        <div className="info-row">
                          <div className="loading-bar"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!isLoadingFeatured && (
                <div className="section-footer">
                  <button
                    className="load-more-button"
                    onClick={() => onNavigate && onNavigate("marketplace")}
                  >
                    View Marketplace
                  </button>
                </div>
              )}
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
