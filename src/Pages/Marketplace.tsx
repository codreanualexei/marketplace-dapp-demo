import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useToast } from "../contexts/ToastContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { ListedToken } from "../sdk/MarketplaceSDK";
import { NETWORK_CONFIG } from "../config/network";
import { ethers } from "ethers";
import Pagination from "../Components/Pagination";
import "./Marketplace.css";

const ITEMS_PER_PAGE = 12;

const Marketplace: React.FC = () => {
  const { account } = useWallet();
  const { showSuccess, showError } = useToast();
  const { sdk, isLoading: sdkLoading, error: sdkError } = useMarketplaceSDK();
  const [listedDomains, setListedDomains] = useState<ListedToken[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyingListingId, setBuyingListingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedDomainsCount, setLoadedDomainsCount] = useState(0);
  
  // Use refs to track loading states and prevent infinite loops
  const isLoadingCountRef = useRef(false);
  const isLoadingPageRef = useRef(false);
  const hasLoadedCountRef = useRef(false);
  const isLoadingIndividualRef = useRef(false);

  const loadTotalCount = useCallback(async () => {
    if (!sdk || isLoadingCountRef.current) return;

    isLoadingCountRef.current = true;
    setIsLoadingCount(true);
    try {
      console.log("Loading total listing count efficiently...");
      const startTime = Date.now();
      
      // Get just the count without loading all listings
      const count = await sdk.getActiveListingCountOptimized();
      
      const endTime = Date.now();
      console.log(`Loaded listing count in ${endTime - startTime}ms:`, count);
      console.log(`Total active listings in marketplace: ${count}`);

      setTotalListings(count);
      // Don't set allListingIds here - we'll fetch them page by page
      setCurrentPage(1);
      hasLoadedCountRef.current = true;
      
      // Load the first page after count is loaded
      setTimeout(() => {
        if (!isLoadingPageRef.current) {
          loadCurrentPage();
        }
      }, 100);
    } catch (err: any) {
      console.error("Error loading count:", err);
      setError("Failed to load listing count");
    } finally {
      setIsLoadingCount(false);
      isLoadingCountRef.current = false;
    }
  }, [sdk]);

  const loadCurrentPage = useCallback(async () => {
    console.log(`loadCurrentPage called - sdk: ${!!sdk}, isLoadingPage: ${isLoadingPageRef.current}, currentPage: ${currentPage}`);
    if (!sdk || isLoadingPageRef.current) {
      console.log("loadCurrentPage early return - sdk or loading check failed");
      return;
    }

    isLoadingPageRef.current = true;
    setIsLoadingPage(true);
    setError(null);
    setListedDomains([]);
    setLoadedDomainsCount(0);

    try {
      console.log(`Loading page ${currentPage} efficiently (${ITEMS_PER_PAGE} items)...`);
      const startTime = Date.now();
      
      // Use the SDK's optimized page method to get only what we need
      const pageListings = await sdk.getActiveListingsPageOptimized(currentPage, ITEMS_PER_PAGE);
      
      console.log(`SDK returned ${pageListings.length} listings for page ${currentPage}:`, pageListings.map(l => l.listingId));

      // Load listings one by one with a small delay for visual effect
      const loadedDomains: ListedToken[] = [];
      
      for (let i = 0; i < pageListings.length; i++) {
        const listing = pageListings[i];
        
        try {
          if (listing && listing.active && listing.seller && listing.strCollectionAddress) {
            // Get token data (with caching)
            const tokenData = await sdk.getTokenData(Number(listing.tokenId));
            
            // Debug: Log the tokenData to see what we're working with
            console.log(`Token ${listing.tokenId} tokenData:`, tokenData);
            console.log(`Token ${listing.tokenId} uri:`, tokenData?.uri);
            console.log(`Token ${listing.tokenId} listing data:`, {
              seller: listing.seller,
              price: listing.price,
              active: listing.active,
              strCollectionAddress: listing.strCollectionAddress
            });
            
            // Log cache stats periodically
            if (i === 0) {
              const cacheStats = sdk.getCacheStats();
              console.log(`Cache stats:`, cacheStats);
            }
            
            // Create the ListedToken object with proper null checks
            const listedToken: ListedToken = {
              listingId: listing.listingId,
              tokenId: Number(listing.tokenId),
              seller: listing.seller || '0x0000000000000000000000000000000000000000', // Fallback to zero address
              price: listing.price || '0',
              active: listing.active || false,
              strCollectionAddress: listing.strCollectionAddress || '0x0000000000000000000000000000000000000000', // Fallback to zero address
              tokenData: tokenData
            };
            
            loadedDomains.push(listedToken);
            setListedDomains([...loadedDomains]);
            setLoadedDomainsCount(loadedDomains.length);
            
            // Small delay to show progressive loading effect
            if (i < pageListings.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } else {
            console.warn(`Listing ${listing.listingId} is invalid or inactive:`, listing);
          }
        } catch (err) {
          console.warn(`Failed to process listing ${listing.listingId}:`, err);
        }
      }
      
      const endTime = Date.now();
      console.log(`Loaded page ${currentPage} in ${endTime - startTime}ms:`, loadedDomains);
      console.log(`Found ${loadedDomains.length} active listings on page ${currentPage}`);

    } catch (err: any) {
      console.error("Error loading marketplace:", err);
      setError("Failed to load marketplace listings");
    } finally {
      setIsLoadingPage(false);
      isLoadingPageRef.current = false;
    }
  }, [sdk, currentPage]);

  // Reset marketplace data when SDK changes (but not when wallet changes)
  useEffect(() => {
    if (!sdk) {
      console.log("Marketplace: Clearing data due to SDK change");
      setListedDomains([]);
      setTotalListings(0);
      setCurrentPage(1);
      setError(null);
      setIsLoadingCount(true);
      setIsLoadingPage(false);
      setLoadedDomainsCount(0);
      // Reset refs
      isLoadingCountRef.current = false;
      isLoadingPageRef.current = false;
      hasLoadedCountRef.current = false;
      isLoadingIndividualRef.current = false;
    }
  }, [sdk]);

  // Load total active count first - only run once when SDK is available (no account required)
  useEffect(() => {
    if (sdk && !hasLoadedCountRef.current && !isLoadingCountRef.current) {
      console.log("Marketplace: SDK available, loading total count");
      loadTotalCount();
    } else if (!sdk) {
      console.log("Marketplace: SDK not available");
      setIsLoadingCount(false);
    }
  }, [sdk]); // Removed account dependency

  // Load page data when page changes
  useEffect(() => {
    console.log(`useEffect triggered - sdk: ${!!sdk}, hasLoadedCount: ${hasLoadedCountRef.current}, isLoadingPage: ${isLoadingPageRef.current}, currentPage: ${currentPage}`);
    if (sdk && hasLoadedCountRef.current && !isLoadingPageRef.current) {
      console.log("Loading current page from useEffect...");
      loadCurrentPage();
    }
  }, [sdk, currentPage, loadCurrentPage]);

  const handleBuy = async (listing: ListedToken) => {
    if (!sdk || !account) {
      showError("Wallet Required", "Please connect your wallet first");
      return;
    }

    const confirmed = window.confirm(
      `Buy Domain #${listing.tokenId} for ${listing.price} ${NETWORK_CONFIG.nativeCurrency.symbol}?`,
    );

    if (!confirmed) return;

    setBuyingListingId(listing.listingId);

    try {
      console.log(`Starting purchase for listing ${listing.listingId}...`);
      const txHash = await sdk.buyToken(listing.listingId);

      if (txHash) {
        console.log(`Purchase successful! Transaction: ${txHash}`);
        showSuccess(
          "Purchase Successful! 🎉",
          `Domain #${listing.tokenId} has been purchased successfully.`,
          txHash
        );
        
        // Clear caches and reload everything after successful purchase
        console.log("Refreshing marketplace after successful purchase...");
        
        // Clear SDK caches to ensure fresh data
        sdk.clearCaches();
        
        // Reset loading refs to force fresh data
        isLoadingCountRef.current = false;
        isLoadingPageRef.current = false;
        hasLoadedCountRef.current = false;
        
        // Small delay to ensure blockchain has processed the transaction
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Reload total count first, then current page
        await loadTotalCount();
        await loadCurrentPage();
      } else {
        console.error("Purchase failed - no transaction hash returned");
        showError("Purchase Failed", "No transaction hash returned. Please try again.");
      }
    } catch (err: any) {
      console.error("Error buying token:", err);
      
      // Show more detailed error message
      let errorMessage = "Failed to buy domain";
      
      if (err.message) {
        errorMessage = err.message;
        
        // Add helpful suggestions based on error type
        if (err.message.includes("insufficient")) {
          errorMessage += `\n\n💡 Tip: Get testnet ${NETWORK_CONFIG.nativeCurrency.symbol} from the appropriate faucet for ${NETWORK_CONFIG.name}`;
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
      
      showError("Purchase Failed", errorMessage);
    } finally {
      setBuyingListingId(null);
    }
  };

  const formatAddress = (address: string | undefined | null) => {
    if (!address || typeof address !== 'string' || address === '0x0000000000000000000000000000000000000000') {
      return 'Unknown';
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isOwnListing = (seller: string | undefined) => {
    return account && seller && seller.toLowerCase() === account.toLowerCase();
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
              // Reset loading states
              hasLoadedCountRef.current = false;
              setIsLoadingCount(true);
              setIsLoadingPage(false);
              setError(null);
              setLoadedDomainsCount(0);
              // Reload data
              loadTotalCount();
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {!isLoadingCount && totalListings === 0 ? (
          <div className="empty-state">
            <h3>No listings found</h3>
            <p>The marketplace is empty. Be the first to list a domain!</p>
          </div>
        ) : (
          <>
            {!isLoadingCount && (
              <div className="marketplace-stats">
                <div className="stat-card">
                  <span className="stat-value">{totalListings}</span>
                  <span className="stat-label">Active Listings</span>
                </div>
              </div>
            )}

            <div className="nft-grid">
              {/* Show loading card when loading count */}
              {isLoadingCount && (
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
                    <div className="nft-card-footer">
                      <div className="loading-button"></div>
                    </div>
                  </div>
                </div>
              )}
              
              {listedDomains.map((listing) => (
                <div key={listing.listingId} className="nft-card">
                  <div className="nft-card-image">
                    <img
                      src={(() => {
                        // Try multiple possible image sources
                        const imageSrc = (listing.tokenData as any)?.image ||
                          listing.tokenData?.uri ||
                          (listing.tokenData as any)?.[2] || // Contract data array index 2 (URI)
                          (listing.tokenData as any)?.metadata?.image ||
                          (listing.tokenData as any)?.metadata?.rawMetadata?.image ||
                          `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`;
                        
                        console.log(`Rendering image for token ${listing.tokenId}:`, {
                          image: (listing.tokenData as any)?.image,
                          uri: listing.tokenData?.uri,
                          arrayIndex2: (listing.tokenData as any)?.[2], // Contract URI at index 2
                          metadata: (listing.tokenData as any)?.metadata,
                          finalSrc: imageSrc,
                          tokenData: listing.tokenData
                        });
                        
                        return imageSrc;
                      })()}
                      alt={`Domain #${listing.tokenId || 'Unknown'}`}
                      onError={(e) => {
                        console.log(`Image failed to load for token ${listing.tokenId}, falling back to placeholder`);
                        e.currentTarget.src = `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`;
                      }}
                      onLoad={() => {
                        console.log(`Image loaded successfully for token ${listing.tokenId}`);
                      }}
                    />
                  </div>

                  <div className="nft-card-content">
                    <div className="nft-card-header">
                      <h3 className="nft-card-title">
                        Domain #{listing.tokenId || 'Unknown'}
                      </h3>
                      <span className="listing-badge">
                        #{listing.listingId || 'Unknown'}
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
                          {listing.price || '0'} {NETWORK_CONFIG.nativeCurrency.symbol}
                        </span>
                      </div>
                      {listing.tokenData && listing.tokenData.creator && listing.tokenData.creator !== '0x0000000000000000000000000000000000000000' && (
                        <div className="info-row">
                          <span className="label">Creator:</span>
                          <span className="value">
                            {formatAddress(listing.tokenData.creator)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="nft-card-footer">
                      {account && isOwnListing(listing.seller) ? (
                        <button className="action-button secondary" disabled>
                          Your Listing
                        </button>
                      ) : (
                        <button
                          className="action-button primary"
                          onClick={() => handleBuy(listing)}
                          disabled={buyingListingId === listing.listingId}
                        >
                          {buyingListingId === listing.listingId
                            ? "Buying..."
                            : account 
                              ? "Buy Now" 
                              : "Connect Wallet to Buy"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading card - show when page is loading */}
              {isLoadingPage && (
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
                    <div className="nft-card-footer">
                      <div className="loading-button"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!isLoadingCount && totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={totalListings}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
