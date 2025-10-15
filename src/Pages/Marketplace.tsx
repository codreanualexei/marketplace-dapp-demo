import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useMarketplaceSDK } from '../hooks/useMarketplaceSDK';
import { ListedToken } from '../sdk/MarketplaceSDK';
import Pagination from '../Components/Pagination';
import './Marketplace.css';

const ITEMS_PER_PAGE = 1;

const Marketplace: React.FC = () => {
  const { account } = useWallet();
  const sdk = useMarketplaceSDK();
  const [listedDomains, setListedDomains] = useState<ListedToken[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Marketplace shows only active listings
  const [buyingListingId, setBuyingListingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Load total active count first
  useEffect(() => {
    if (sdk) {
      loadTotalCount();
    }
  }, [sdk]);

  // Load page data when page changes
  useEffect(() => {
    if (sdk && totalListings > 0) {
      loadCurrentPage();
    } else if (sdk) {
      setIsLoading(false);
    }
  }, [sdk, currentPage, totalListings]);

  const loadTotalCount = async () => {
    if (!sdk) return;
    
    setIsLoading(true);
    try {
      // Count only active listings (scan-based)
      const count = await sdk.getActiveListingCount();

      setTotalListings(count);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Error loading count:', err);
      setError('Failed to load listing count');
    }
  };

  const loadCurrentPage = async () => {
    if (!sdk) return;

    setIsLoading(true);
    setError(null);

    try {
      // Calculate which listings to fetch for current page
      const startId = (currentPage - 1) * ITEMS_PER_PAGE + 1;
      
      // Fetch only the active listings for this page (scan from last)
      const domains = await sdk.getActiveListingsPage(
        currentPage,
        ITEMS_PER_PAGE
      );
      
      setListedDomains(domains);
      console.log(`Loaded page ${currentPage}: listings ${startId}-${startId + ITEMS_PER_PAGE - 1}`, domains);
    } catch (err: any) {
      console.error('Error loading marketplace:', err);
      setError('Failed to load marketplace listings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuy = async (listing: ListedToken) => {
    if (!sdk || !account) {
      alert('Please connect your wallet first');
      return;
    }

    const confirmed = window.confirm(
      `Buy Domain #${listing.tokenId} for ${listing.price} MATIC?`
    );
    
    if (!confirmed) return;

    setBuyingListingId(listing.listingId);

    try {
      const txHash = await sdk.buyToken(listing.listingId);
      
      if (txHash) {
        alert(`Purchase successful! Transaction: ${txHash}`);
        // Reload current page
        await loadCurrentPage();
      } else {
        alert('Purchase failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Error buying token:', err);
      alert(`Error: ${err.message || 'Failed to buy domain'}`);
    } finally {
      setBuyingListingId(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isOwnListing = (seller: string) => {
    return account && seller.toLowerCase() === account.toLowerCase();
  };

  // Pagination logic (smart - data already paginated from SDK)
  const totalPages = Math.ceil(totalListings / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Data will reload via useEffect
  };

  if (isLoading) {
    return (
      <div className="marketplace">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading marketplace...</p>
        </div>
      </div>
    );
  }

  if (!sdk) {
    return (
      <div className="marketplace">
        <div className="empty-state">
          <h3>Marketplace unavailable</h3>
          <p>Connect your wallet or set REACT_APP_RPC_URL and contract addresses.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => {
            loadTotalCount();
            loadCurrentPage();
          }}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace">
      <div className="marketplace-container">
        <div className="page-header">
          <h1>Domain Marketplace</h1>
          <p>Discover and buy domain NFTs</p>
        </div>

        <div className="marketplace-controls">
          <button className="refresh-button" onClick={() => {
            loadTotalCount();
            loadCurrentPage();
          }}>
            🔄 Refresh
          </button>
        </div>

        {totalListings === 0 ? (
          <div className="empty-state">
            <h3>No listings found</h3>
            <p>The marketplace is empty. Be the first to list a domain!</p>
            {account && (
              <button 
                className="action-button primary"
                onClick={() => window.location.hash = '#my-domains'}
                style={{ marginTop: '20px' }}
              >
                List Your Domains
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="nft-grid">
              {listedDomains.map((listing) => (
              <div key={listing.listingId} className="nft-card">
                <div className="nft-card-image">
                  <img 
                    src={listing.tokenData?.uri || 'https://via.placeholder.com/400x400/667eea/ffffff?text=Domain'} 
                    alt={`Domain #${listing.tokenId}`}
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/400x400/667eea/ffffff?text=Domain';
                    }}
                  />
                </div>
                
                <div className="nft-card-content">
                  <div className="nft-card-header">
                    <h3 className="nft-card-title">Domain #{listing.tokenId}</h3>
                    <span className="listing-badge">#{listing.listingId}</span>
                  </div>
                  
                  <div className="nft-info">
                    <div className="info-row">
                      <span className="label">Seller:</span>
                      <span className="value">{formatAddress(listing.seller)}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Price:</span>
                      <span className="value price">{listing.price} MATIC</span>
                    </div>
                    {listing.tokenData && (
                      <div className="info-row">
                        <span className="label">Creator:</span>
                        <span className="value">{formatAddress(listing.tokenData.creator)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="nft-card-footer">
                    {isOwnListing(listing.seller) ? (
                      <button className="action-button secondary" disabled>
                        Your Listing
                      </button>
                    ) : (
                      <button 
                        className="action-button primary"
                        onClick={() => handleBuy(listing)}
                        disabled={buyingListingId === listing.listingId || !account}
                      >
                        {buyingListingId === listing.listingId ? 'Buying...' : 'Buy Now'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={totalListings}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
