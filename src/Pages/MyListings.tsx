import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useMarketplaceSDK } from '../hooks/useMarketplaceSDK';
import { ListedToken } from '../sdk/MarketplaceSDK';
import Pagination from '../Components/Pagination';
import './MyListings.css';

const ITEMS_PER_PAGE = 12;

const MyListings: React.FC = () => {
  const { account } = useWallet();
  const sdk = useMarketplaceSDK();
  const [myListings, setMyListings] = useState<ListedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingListingId, setUpdatingListingId] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState<string>('');
  const [cancelingListingId, setCancelingListingId] = useState<number | null>(null);
  const [activeCurrentPage, setActiveCurrentPage] = useState(1);
  const [soldCurrentPage, setSoldCurrentPage] = useState(1);

  useEffect(() => {
    if (sdk && account) {
      loadMyListings();
    }
  }, [sdk, account]);

  const loadMyListings = async () => {
    if (!sdk) return;

    setIsLoading(true);
    setError(null);

    try {
      const listings = await sdk.getMyAllListedDomainsOnMarketplaceWithTokenData();
      setMyListings(listings);
    } catch (err: any) {
      console.error('Error loading listings:', err);
      setError('Failed to load your listings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePrice = (listingId: number, currentPrice: string) => {
    setUpdatingListingId(listingId);
    setNewPrice(currentPrice);
  };

  const handleCancelUpdate = () => {
    setUpdatingListingId(null);
    setNewPrice('');
  };

  const handleConfirmUpdate = async (listingId: number) => {
    if (!sdk || !newPrice || parseFloat(newPrice) <= 0) {
      alert('Please enter a valid price');
      return;
    }

    const confirmed = window.confirm(
      `Update listing #${listingId} to ${newPrice} MATIC?`
    );
    
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const txHash = await sdk.updateListing(listingId, newPrice);
      
      if (txHash) {
        alert(`Price updated successfully! Transaction: ${txHash}`);
        setUpdatingListingId(null);
        setNewPrice('');
        await loadMyListings();
      } else {
        alert('Failed to update price. Please try again.');
      }
    } catch (err: any) {
      console.error('Error updating listing:', err);
      alert(`Error: ${err.message || 'Failed to update price'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelListing = async (listingId: number) => {
    if (!sdk) return;

    const confirmed = window.confirm(
      `Cancel listing #${listingId}? This will remove it from the marketplace.`
    );
    
    if (!confirmed) return;

    setCancelingListingId(listingId);

    try {
      const txHash = await sdk.cancelListing(listingId);
      
      if (txHash) {
        alert(`Listing cancelled successfully! Transaction: ${txHash}`);
        await loadMyListings();
      } else {
        alert('Failed to cancel listing. Please try again.');
      }
    } catch (err: any) {
      console.error('Error cancelling listing:', err);
      alert(`Error: ${err.message || 'Failed to cancel listing'}`);
    } finally {
      setCancelingListingId(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!account) {
    return (
      <div className="my-listings">
        <div className="connect-prompt">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to view your listings</p>
        </div>
      </div>
    );
  }

  if (isLoading && myListings.length === 0) {
    return (
      <div className="my-listings">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your listings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-listings">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadMyListings}>Try Again</button>
        </div>
      </div>
    );
  }

  const activeListings = myListings.filter(l => l.active);
  const historyListings = myListings.filter(l => !l.active);

  // Pagination for active listings
  const activeTotalPages = Math.ceil(activeListings.length / ITEMS_PER_PAGE);
  const activeStartIndex = (activeCurrentPage - 1) * ITEMS_PER_PAGE;
  const activeEndIndex = activeStartIndex + ITEMS_PER_PAGE;
  const paginatedActiveListings = activeListings.slice(activeStartIndex, activeEndIndex);

  // Pagination for sold listings
  const soldTotalPages = Math.ceil(historyListings.length / ITEMS_PER_PAGE);
  const soldStartIndex = (soldCurrentPage - 1) * ITEMS_PER_PAGE;
  const soldEndIndex = soldStartIndex + ITEMS_PER_PAGE;
  const paginatedSoldListings = historyListings.slice(soldStartIndex, soldEndIndex);

  const handleActivePageChange = (page: number) => {
    setActiveCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSoldPageChange = (page: number) => {
    setSoldCurrentPage(page);
    const soldSection = document.getElementById('sold-section');
    if (soldSection) {
      soldSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="my-listings">
      <div className="my-listings-container">
        <div className="page-header">
          <h1>My Listings</h1>
          <p>Manage your marketplace listings</p>
        </div>

        <div className="listings-stats">
          <div className="stat-card">
            <span className="stat-value">{activeListings.length}</span>
            <span className="stat-label">Active Listings</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{historyListings.length}</span>
            <span className="stat-label">Listing History</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{myListings.length}</span>
            <span className="stat-label">Total Listings</span>
          </div>
        </div>

        {myListings.length === 0 ? (
          <div className="empty-state">
            <h3>No listings found</h3>
            <p>You haven't listed any domains for sale yet</p>
          </div>
        ) : (
          <>
            {activeListings.length > 0 && (
              <section className="listings-section" id="active-section">
                <h2 className="section-title">
                  Active Listings ({activeListings.length})
                </h2>
                <div className="nft-grid">
                  {paginatedActiveListings.map((listing) => (
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
                          <span className="listing-badge">#{listing.listingId}</span>
                        </div>
                        
                        <div className="nft-info">
                          <div className="info-row">
                            <span className="label">Current Price:</span>
                            <span className="value price">{listing.price} MATIC</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Status:</span>
                            <span className="value status active">Active</span>
                          </div>
                        </div>
                        
                        {updatingListingId === listing.listingId ? (
                          <div className="update-form">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="New price in MATIC"
                              value={newPrice}
                              onChange={(e) => setNewPrice(e.target.value)}
                              className="price-input"
                            />
                            <div className="form-actions">
                              <button 
                                className="action-button secondary"
                                onClick={handleCancelUpdate}
                              >
                                Cancel
                              </button>
                              <button 
                                className="action-button primary"
                                onClick={() => handleConfirmUpdate(listing.listingId)}
                                disabled={!newPrice || isLoading}
                              >
                                {isLoading ? 'Updating...' : 'Update'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="nft-card-footer">
                            <button 
                              className="action-button secondary"
                              onClick={() => handleUpdatePrice(listing.listingId, listing.price)}
                              disabled={isLoading}
                            >
                              Update Price
                            </button>
                            <button 
                              className="action-button danger"
                              onClick={() => handleCancelListing(listing.listingId)}
                              disabled={cancelingListingId === listing.listingId}
                            >
                              {cancelingListingId === listing.listingId ? 'Cancelling...' : 'Cancel Listing'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={activeCurrentPage}
                  totalPages={activeTotalPages}
                  onPageChange={handleActivePageChange}
                  itemsPerPage={ITEMS_PER_PAGE}
                  totalItems={activeListings.length}
                />
              </section>
            )}

            {historyListings.length > 0 && (
              <section className="listings-section" id="sold-section">
                <h2 className="section-title">
                  Listing History ({historyListings.length})
                </h2>
                <div className="nft-grid">
                  {paginatedSoldListings.map((listing) => (
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
                          <span className="listing-badge">#{listing.listingId}</span>
                        </div>
                        
                        <div className="nft-info">
                          <div className="info-row">
                            <span className="label">Last Price:</span>
                            <span className="value price">{listing.price} MATIC</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Status:</span>
                            <span className="value status">Inactive</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={soldCurrentPage}
                  totalPages={soldTotalPages}
                  onPageChange={handleSoldPageChange}
                  itemsPerPage={ITEMS_PER_PAGE}
                  totalItems={historyListings.length}
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyListings;

