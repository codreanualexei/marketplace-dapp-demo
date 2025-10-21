import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { ListedToken } from "../sdk/MarketplaceSDK";
import Pagination from "../Components/Pagination";
import "./Marketplace.css";

const ITEMS_PER_PAGE = 12;

const Marketplace: React.FC = () => {
  const { account } = useWallet();
  const { sdk, isLoading: sdkLoading, error: sdkError } = useMarketplaceSDK();
  const [listedDomains, setListedDomains] = useState<ListedToken[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingListingId, setBuyingListingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Use refs to track loading states and prevent infinite loops
  const isLoadingCountRef = useRef(false);
  const isLoadingPageRef = useRef(false);
  const hasLoadedCountRef = useRef(false);

  const loadTotalCount = useCallback(async () => {
    if (!sdk || isLoadingCountRef.current) return;

    isLoadingCountRef.current = true;
    try {
      console.log("Loading total listing count with optimized Alchemy-enhanced SDK...");
      const startTime = Date.now();
      
      const count = await sdk.getActiveListingCountOptimized();
      
      const endTime = Date.now();
      console.log(`Loaded listing count in ${endTime - startTime}ms:`, count);

      setTotalListings(count);
      setCurrentPage(1);
      hasLoadedCountRef.current = true;
    } catch (err: any) {
      console.error("Error loading count:", err);
      setError("Failed to load listing count");
    } finally {
      isLoadingCountRef.current = false;
    }
  }, [sdk]);

  const loadCurrentPage = useCallback(async () => {
    if (!sdk || isLoadingPageRef.current) return;

    isLoadingPageRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Loading page ${currentPage} with optimized Alchemy-enhanced SDK...`);
      const startTime = Date.now();
      
      const domains = await sdk.getActiveListingsPageOptimized(
        currentPage,
        ITEMS_PER_PAGE,
      );
      
      const endTime = Date.now();
      console.log(`Loaded page ${currentPage} in ${endTime - startTime}ms:`, domains);

      setListedDomains(domains);
    } catch (err: any) {
      console.error("Error loading marketplace:", err);
      setError("Failed to load marketplace listings");
    } finally {
      setIsLoading(false);
      isLoadingPageRef.current = false;
    }
  }, [sdk, currentPage]);

  // Reset marketplace data when wallet changes
  useEffect(() => {
    if (!sdk || !account) {
      console.log("Marketplace: Clearing data due to wallet change");
      setListedDomains([]);
      setTotalListings(0);
      setCurrentPage(1);
      setError(null);
      // Reset refs
      isLoadingCountRef.current = false;
      isLoadingPageRef.current = false;
      hasLoadedCountRef.current = false;
    }
  }, [sdk, account]);

  // Load total active count first - only run once when SDK and account are available
  useEffect(() => {
    if (sdk && account && !hasLoadedCountRef.current && !isLoadingCountRef.current) {
      console.log("Marketplace: SDK and account available, loading total count");
      loadTotalCount();
    } else if (!sdk || !account) {
      console.log("Marketplace: SDK or account not available:", {
        hasSDK: !!sdk,
        hasAccount: !!account,
      });
      setIsLoading(false);
    }
  }, [sdk, account]); // Removed loadTotalCount from dependencies

  // Load page data when page changes or when totalListings is available
  useEffect(() => {
    if (sdk && account && totalListings > 0 && !isLoadingPageRef.current) {
      loadCurrentPage();
    } else if (sdk && account && totalListings === 0 && hasLoadedCountRef.current) {
      // If we have SDK and account but no listings, stop loading
      setIsLoading(false);
    }
  }, [sdk, account, currentPage, totalListings]); // Removed loadCurrentPage from dependencies

  const handleBuy = async (listing: ListedToken) => {
    if (!sdk || !account) {
      alert("Please connect your wallet first");
      return;
    }

    const confirmed = window.confirm(
      `Buy Domain #${listing.tokenId} for ${listing.price} MATIC?`,
    );

    if (!confirmed) return;

    setBuyingListingId(listing.listingId);

    try {
      console.log(`Starting purchase for listing ${listing.listingId}...`);
      const txHash = await sdk.buyToken(listing.listingId);

      if (txHash) {
        console.log(`Purchase successful! Transaction: ${txHash}`);
        alert(`Purchase successful! Transaction: ${txHash}`);
        // Reload current page
        await loadCurrentPage();
      } else {
        console.error("Purchase failed - no transaction hash returned");
        alert("Purchase failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Error buying token:", err);
      
      // Show more detailed error message
      let errorMessage = "Failed to buy domain";
      
      if (err.message) {
        errorMessage = err.message;
        
        // Add helpful suggestions based on error type
        if (err.message.includes("insufficient")) {
          errorMessage += "\n\n💡 Tip: Get testnet MATIC from https://faucet.polygon.technology/";
        } else if (err.message.includes("rejected")) {
          errorMessage += "\n\n💡 Tip: Make sure to approve the transaction in your wallet.";
        } else if (err.message.includes("timeout")) {
          errorMessage += "\n\n💡 Tip: The transaction may still be processing. Check your wallet or try again in a few minutes.";
        } else if (err.message.includes("network")) {
          errorMessage += "\n\n💡 Tip: Check your internet connection and try again.";
        } else if (err.message.includes("confirmation failed")) {
          errorMessage += "\n\n💡 Tip: The transaction may have succeeded but confirmation failed. Check your wallet or refresh the page.";
        }
      }
      
      alert(`Error: ${errorMessage}`);
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

  // Pagination logic
  const totalPages = Math.ceil(totalListings / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (sdkLoading) {
    return (
      <div className="marketplace">
        <div className="loading">
          <div className="spinner"></div>
          <p>Initializing Alchemy SDK...</p>
        </div>
      </div>
    );
  }

  if (sdkError) {
    return (
      <div className="marketplace">
        <div className="error-message">
          <h3>SDK Error</h3>
          <p>{sdkError}</p>
        </div>
      </div>
    );
  }

  if (!sdk) {
    return (
      <div className="marketplace">
        <div className="empty-state">
          <h3>Marketplace unavailable</h3>
          <p>
            Connect your wallet or set REACT_APP_RPC_URL and contract addresses.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="marketplace">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading marketplace with Alchemy...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace">
        <div className="error-message">
          <p>{error}</p>
          <button
            onClick={() => {
              loadTotalCount();
              loadCurrentPage();
            }}
          >
            Try Again
          </button>
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
          <button
            className="refresh-button"
            onClick={() => {
              loadTotalCount();
              loadCurrentPage();
            }}
          >
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
                onClick={() => (window.location.hash = "#my-domains")}
                style={{ marginTop: "20px" }}
              >
                List Your Domains
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="marketplace-stats">
              <div className="stat-card">
                <span className="stat-value">{totalListings}</span>
                <span className="stat-label">Active Listings</span>
              </div>
            </div>

            <div className="nft-grid">
              {listedDomains.map((listing) => (
                <div key={listing.listingId} className="nft-card">
                  <div className="nft-card-image">
                    <img
                      src={
                        listing.tokenData?.uri ||
                        "https://via.placeholder.com/400x400/667eea/ffffff?text=Domain"
                      }
                      alt={`Domain #${listing.tokenId}`}
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://via.placeholder.com/400x400/667eea/ffffff?text=Domain";
                      }}
                    />
                  </div>

                  <div className="nft-card-content">
                    <div className="nft-card-header">
                      <h3 className="nft-card-title">
                        Domain #{listing.tokenId}
                      </h3>
                      <span className="listing-badge">
                        #{listing.listingId}
                      </span>
                    </div>

                    <div className="nft-info">
                      <div className="info-row">
                        <span className="label">Seller:</span>
                        <span className="value">
                          {formatAddress(listing.seller)}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="label">Price:</span>
                        <span className="value price">
                          {listing.price} MATIC
                        </span>
                      </div>
                      {listing.tokenData && (
                        <div className="info-row">
                          <span className="label">Creator:</span>
                          <span className="value">
                            {formatAddress(listing.tokenData.creator)}
                          </span>
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
                          disabled={
                            buyingListingId === listing.listingId || !account
                          }
                        >
                          {buyingListingId === listing.listingId
                            ? "Buying..."
                            : "Buy Now"}
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
