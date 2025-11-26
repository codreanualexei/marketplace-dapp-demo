import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useToast } from "../contexts/ToastContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { ListedToken } from "../sdk/MarketplaceSDK";
import { NETWORK_CONFIG } from "../config/network";
import Pagination from "../Components/Pagination";
import { useNFTMetadata, getTokenURI } from "../hooks/useNFTMetadata";
import { NFTMetadataDisplay } from "../Components/NFTMetadata";
import ConfirmationModal from "../Components/ConfirmationModal";
import {
  applyPurchasedUpdate,
  calculateNewListingCountAfterPurchase,
  areListingsDifferent,
} from "../utils/optimisticUpdates";
import {
  storePendingUpdate,
  getPendingUpdates,
  removePendingUpdate,
  isTransactionConfirmed,
} from "../utils/persistentOptimisticUpdates";
import { parseAllEvents } from "../utils/eventParser";
import "./Marketplace.css";

// Helper function to get domain name from tokenURI
const getDomainNameFromURI = async (tokenURI: string | null, tokenId: number | undefined): Promise<string> => {
  if (!tokenURI) return `Domain #${tokenId || 'Unknown'}`;
  
  try {
    let url = tokenURI;
    if (url.startsWith('ipfs://')) {
      const ipfsHash = url.replace('ipfs://', '');
      url = `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    
    const response = await fetch(url);
    if (response.ok) {
      const metadata = await response.json();
      return metadata.name || `Domain #${tokenId || 'Unknown'}`;
    }
  } catch (err) {
    console.error("Error fetching domain name:", err);
  }
  
  return `Domain #${tokenId || 'Unknown'}`;
};

const ITEMS_PER_PAGE = 12;

// Card component with metadata
const MarketplaceCard: React.FC<{
  listing: ListedToken;
  tokenURI: string | null;
  account: string | null;
  isOwnListing: (seller: string | undefined) => boolean;
  handleBuy: (listing: ListedToken) => void;
  buyingListingId: number | null;
  formatAddress: (address: string) => string;
}> = ({ listing, tokenURI, account, isOwnListing, handleBuy, buyingListingId, formatAddress }) => {
  const { metadata, isLoading: metadataLoading } = useNFTMetadata(tokenURI);
  
  // Get image from metadata or fallback
  const imageSrc = metadata?.image ||
    (listing.tokenData as any)?.image ||
    listing.tokenData?.uri ||
    (listing.tokenData as any)?.[2] ||
    `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`;

  return (
    <div className="nft-card">
      <div className="nft-card-image">
        <img
          src={imageSrc}
          alt={metadata?.name || `Domain #${listing.tokenId || 'Unknown'}`}
          onError={(e) => {
            e.currentTarget.src = `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${listing.tokenId}`;
          }}
        />
      </div>

      <div className="nft-card-content">
        <div className="nft-card-header">
          <h3 className="nft-card-title">
            {metadata?.name || `Domain #${listing.tokenId || 'Unknown'}`}
          </h3>
          <span className="listing-badge">
            #{listing.listingId || 'Unknown'}
          </span>
        </div>

        <NFTMetadataDisplay 
          metadata={metadata} 
          isLoading={metadataLoading}
          fallbackName={`Domain #${listing.tokenId || 'Unknown'}`}
        />

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
  );
};

const Marketplace: React.FC = () => {
  const { account } = useWallet();
  const { showSuccess, showError } = useToast();
  const { sdk, isLoading: sdkLoading, error: sdkError } = useMarketplaceSDK();
  const [listedDomains, setListedDomains] = useState<ListedToken[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyingListingId, setBuyingListingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAwaitingSignature, setIsAwaitingSignature] = useState(false);
  const [txStatus, setTxStatus] = useState<'signature' | 'submitting' | 'confirming' | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    domainName?: string;
    onConfirm: () => void;
    type?: "default" | "danger" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "default",
  });
  
  // Use refs to track loading states and prevent infinite loops
  const isLoadingCountRef = useRef(false);
  const isLoadingPageRef = useRef(false);
  const hasLoadedCountRef = useRef(false);
  const isLoadingIndividualRef = useRef(false);

  // Load count in the background (non-blocking, for stats display only)
  const loadTotalCount = useCallback(async () => {
    if (!sdk || isLoadingCountRef.current) return;

    isLoadingCountRef.current = true;
    try {
      // Get just the count without loading all listings
      const count = await (sdk as any).getActiveListingCountOptimized();

      // Update the count - this will cause the UI to update from 0 to the real number
      setTotalListings(count);
      hasLoadedCountRef.current = true;
    } catch (err: any) {
      console.error("Error loading count:", err);
      // Don't set error for count - it's optional, keep showing 0
    } finally {
      isLoadingCountRef.current = false;
    }
  }, [sdk]);

  const loadCurrentPage = useCallback(async () => {
    if (!sdk || isLoadingPageRef.current) {
      return;
    }

    isLoadingPageRef.current = true;
    setIsLoadingPage(true);
    setError(null);
    setListedDomains([]);

    try {
      // Use the SDK's optimized page method to get only what we need (single subgraph query)
      const pageListings = await (sdk as any).getActiveListingsPageOptimized(currentPage, ITEMS_PER_PAGE);

      // The subgraph already returns tokenData with listings, so we can use them directly
      // Filter out invalid listings and use the data as-is
      const validListings = pageListings.filter((listing: ListedToken) => 
        listing && listing.active && listing.seller && listing.strCollectionAddress && listing.tokenData
      );
      
      // Only update state if data actually changed (prevents unnecessary re-renders)
      setListedDomains(prevListings => {
        if (areListingsDifferent(prevListings, validListings)) {
          return validListings;
        }
        // Data is the same, return previous state to prevent re-render
        return prevListings;
      });
      
      // If this is the first page and we haven't loaded count yet, load it in the background
      if (currentPage === 1 && !hasLoadedCountRef.current) {
        // Load count in background (non-blocking)
        loadTotalCount();
      }
      
      // Add a small delay to ensure all state updates are complete before showing cards
      // This prevents flickering and weird loading states
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsDataReady(true);

    } catch (err: any) {
      console.error("Error loading marketplace:", err);
      setError("Failed to load marketplace listings");
      setIsDataReady(true);
    } finally {
      setIsLoadingPage(false);
      isLoadingPageRef.current = false;
    }
  }, [sdk, currentPage, loadTotalCount]);

  // Reset marketplace data when SDK changes (but not when wallet changes)
  useEffect(() => {
    if (!sdk) {
      setListedDomains([]);
      setTotalListings(0);
      setCurrentPage(1);
      setError(null);
      setIsLoadingPage(false);
      setIsDataReady(false);
      // Reset refs
      isLoadingCountRef.current = false;
      isLoadingPageRef.current = false;
      hasLoadedCountRef.current = false;
      isLoadingIndividualRef.current = false;
    }
  }, [sdk]);

  // Check and re-apply pending optimistic updates on mount
  useEffect(() => {
    const applyPendingUpdates = async () => {
      if (!sdk || !account) return;
      
      const pending = getPendingUpdates().filter(u => u.type === 'purchase');
      if (pending.length === 0) return;
      
      console.log(`🔄 Found ${pending.length} pending purchase update(s), verifying...`);
      
      for (const update of pending) {
        try {
          // Check if transaction is confirmed
      const provider = (sdk as any).signer?.provider || (sdk as any).provider;
      const isConfirmed = await isTransactionConfirmed(
        update.txHash,
        provider
      );
          
          if (isConfirmed) {
            // Get receipt and parse events
            const receipt = await provider?.getTransactionReceipt(update.txHash);
            if (receipt) {
              const events = parseAllEvents(
                receipt,
                (sdk as any).marketplaceAddress,
                (sdk as any).nftAddress
              );
              
              if (events.purchased) {
                console.log("✅ Re-applying pending purchase update:", update.txHash);
                
                // Re-apply optimistic update
                setListedDomains(prevListings => 
                  applyPurchasedUpdate(prevListings, events.purchased!)
                );
                setTotalListings(prev => calculateNewListingCountAfterPurchase(prev));
                
                // Remove from pending after applying
                removePendingUpdate(update.txHash);
              } else if (events.transfers && events.transfers.length > 0) {
                // Fallback: If we have transfers, we can infer a purchase happened
                // Find the listing by checking current listings
                const listingId = update.data.listingId;
                if (listingId) {
                  console.log("✅ Re-applying pending purchase update (from transfer):", update.txHash);
                  setListedDomains(prevListings => 
                    prevListings.filter(l => l.listingId !== listingId)
                  );
                  setTotalListings(prev => Math.max(0, prev - 1));
                  removePendingUpdate(update.txHash);
                }
              }
            }
          } else {
            // Transaction not confirmed, remove from pending
            console.warn("⚠️ Pending update transaction not confirmed, removing:", update.txHash);
            removePendingUpdate(update.txHash);
          }
        } catch (error) {
          console.error("Error applying pending update:", error);
          // Keep it in pending for next time
        }
      }
    };
    
    applyPendingUpdates();
  }, [sdk, account]);

  // Load first page when SDK is available (single query optimization)
  // This is the primary data load - count will be loaded in background
  useEffect(() => {
    if (sdk && !isLoadingPageRef.current && currentPage === 1 && listedDomains.length === 0) {
      loadCurrentPage();
    }
  }, [sdk, currentPage, listedDomains.length, loadCurrentPage]);

  // Load page when currentPage changes (but not on initial load)
  useEffect(() => {
    if (sdk && currentPage > 1 && !isLoadingPageRef.current) {
      loadCurrentPage();
    }
  }, [sdk, currentPage, loadCurrentPage]);

  const handleBuy = async (listing: ListedToken) => {
    if (!sdk || !account) {
      showError("Wallet Required", "Please connect your wallet first");
      return;
    }

    // Get domain name from metadata
    const tokenURI = getTokenURI(listing.tokenData);
    const domainName = await getDomainNameFromURI(tokenURI, listing.tokenId);

    setConfirmModal({
      isOpen: true,
      title: "Purchase Domain",
      message: `Buy ${domainName} for ${listing.price} ${NETWORK_CONFIG.nativeCurrency.symbol}?`,
      domainName: domainName,
      type: "default",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setBuyingListingId(listing.listingId);
        setIsAwaitingSignature(true);
        setTxStatus('signature');

        try {
          // Track transaction: signature phase (user needs to sign in wallet)
          setTxStatus('signature');
          
          // Use timeouts to track transaction phases
          // After 1 second, assume signature is done and transaction is being submitted
          const submittingTimeout = setTimeout(() => {
            setTxStatus('submitting');
          }, 1000);
          
          // After 3 seconds total, assume transaction is submitted and waiting for confirmation
          const confirmingTimeout = setTimeout(() => {
            setTxStatus('confirming');
          }, 3000);
          
          // Use new method that returns receipt and parsed events
          const { txHash, purchasedEvent } = await sdk.buyTokenWithReceipt(listing.listingId);
          
          // Clear timeouts since transaction completed
          clearTimeout(submittingTimeout);
          clearTimeout(confirmingTimeout);
          
          // Transaction completed
          setIsAwaitingSignature(false);
          setTxStatus(null);

          if (txHash && purchasedEvent) {
            // OPTIMISTIC UPDATE: Immediately update UI with parsed event data
            console.log("✅ Optimistic Update: Purchase successful!", { txHash, listingId: purchasedEvent.listingId });
            
            // Store pending update for persistence across page refreshes
            console.log('💾 [PERSISTENT UPDATE] Storing purchase update for persistence...');
            storePendingUpdate({
              type: 'purchase',
              txHash,
              data: {
                listingId: purchasedEvent.listingId,
              },
            });
            
            // Remove purchased listing from current view
            setListedDomains(prevListings => 
              applyPurchasedUpdate(prevListings, purchasedEvent)
            );
            
            // Update count optimistically
            setTotalListings(prev => calculateNewListingCountAfterPurchase(prev));
            
            // Show success message immediately
            showSuccess(
              "Purchase Successful! 🎉",
              `${domainName} has been purchased successfully.`,
              txHash
            );
            
            // Background sync: Verify with subgraph after delay (non-blocking)
            // This ensures data consistency but doesn't block the UI
            setTimeout(async () => {
              console.log("🔄 Background Sync: Verifying purchase with subgraph...");
              console.log(`🔄 [PERSISTENT UPDATE] Starting background sync for ${txHash}...`);
              (sdk as any).clearCaches();
              isLoadingCountRef.current = false;
              isLoadingPageRef.current = false;
              hasLoadedCountRef.current = false;
              await loadTotalCount();
              await loadCurrentPage();
              
              // Remove pending update after successful sync
              console.log(`🗑️ [PERSISTENT UPDATE] Background sync completed, removing pending update for ${txHash}`);
              removePendingUpdate(txHash);
            }, 30000); // Wait 30 seconds for subgraph to index
          } else if (txHash) {
            // Transaction succeeded but couldn't parse event - fallback to old behavior
            console.warn("Purchase succeeded but couldn't parse event, using fallback refresh");
            showSuccess(
              "Purchase Successful! 🎉",
              `${domainName} has been purchased successfully.`,
              txHash
            );
            
            // Fallback: Clear caches and reload
            (sdk as any).clearCaches();
            isLoadingCountRef.current = false;
            isLoadingPageRef.current = false;
            hasLoadedCountRef.current = false;
            await new Promise(resolve => setTimeout(resolve, 2000));
            await loadTotalCount();
            await loadCurrentPage();
          } else {
            console.error("Purchase failed - no transaction hash returned");
            showError("Purchase Failed", "No transaction hash returned. Please try again.");
          }
        } catch (err: any) {
          console.error("Error buying token:", err);
          
          // Reset transaction status on error
          setIsAwaitingSignature(false);
          setTxStatus(null);
          
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
          setIsAwaitingSignature(false);
        } finally {
          setBuyingListingId(null);
        }
      },
    });
  };

  const formatAddress = (address: string | undefined | null): string => {
    if (!address || typeof address !== 'string' || address === '0x0000000000000000000000000000000000000000') {
      return 'Unknown';
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isOwnListing = (seller: string | undefined): boolean => {
    return !!(account && seller && seller.toLowerCase() === account.toLowerCase());
  };

  // Pagination logic
  // Show loading until page loads OR awaiting signature
  const isFullyLoading = isLoadingPage || !isDataReady || isAwaitingSignature;
  
  const totalPages = Math.ceil(totalListings / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setIsDataReady(false); // Reset data ready when changing pages
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (sdkLoading) {
    return (
      <div className="marketplace">
        <div className="loading">
          <div className="spinner"></div>
          <p>Initializing SDK...</p>
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

  // Error is shown as a banner, not blocking the page

  return (
    <div className="marketplace">
      <div className="marketplace-container">
        <div className="page-header">
          <h1>Domain Marketplace</h1>
          <p>Discover and buy domain NFTs</p>
        </div>

        {error && (
          <div className="error-banner">
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                setCurrentPage(1);
                setListedDomains([]);
                loadCurrentPage();
              }}
            >
              Try Again
            </button>
          </div>
        )}

        <div className="marketplace-controls">
          <button
            className="refresh-button"
            onClick={() => {
              // Reset loading states
              hasLoadedCountRef.current = false;
              setCurrentPage(1);
              setListedDomains([]);
              setError(null);
              // Reload current page
              loadCurrentPage();
            }}
            disabled={isLoadingPage}
          >
            {isLoadingPage ? "Loading..." : "🔄 Refresh"}
          </button>
        </div>

        {/* Show stats card only when not awaiting signature */}
        {!isAwaitingSignature && (
          <div className="marketplace-stats">
            <div className="stat-card">
              <span className="stat-value">{totalListings}</span>
              <span className="stat-label">Active Listings</span>
            </div>
          </div>
        )}

        {/* Show loading screen until page data is fully loaded OR awaiting signature */}
        {isFullyLoading ? (
          <div className="loading-overlay">
            <div className="loading">
              <div className="spinner"></div>
              <p className={txStatus === 'signature' ? 'tx-status-signature' : txStatus === 'submitting' ? 'tx-status-submitting' : txStatus === 'confirming' ? 'tx-status-confirming' : ''}>
                {isAwaitingSignature && txStatus === 'signature' && "Waiting for your signature..."}
                {isAwaitingSignature && txStatus === 'submitting' && "Submitting transaction..."}
                {isAwaitingSignature && txStatus === 'confirming' && "Waiting for transaction confirmation..."}
              </p>
            </div>
          </div>
        ) : listedDomains.length === 0 ? (
          <div className="empty-state">
            <h3>No listings found</h3>
            <p>The marketplace is empty. Be the first to list a domain!</p>
          </div>
        ) : (
          <>
            <div className="nft-grid">
              {listedDomains.map((listing) => {
                const tokenURI = getTokenURI(listing.tokenData);
                return <MarketplaceCard
                  key={listing.listingId}
                  listing={listing}
                  tokenURI={tokenURI}
                  account={account}
                  isOwnListing={isOwnListing}
                  handleBuy={handleBuy}
                  buyingListingId={buyingListingId}
                  formatAddress={formatAddress}
                />;
              })}
            </div>

            {/* Show pagination only when page is loaded and we have count */}
            {!isLoadingPage && totalPages > 1 && (
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

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        domainName={confirmModal.domainName}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        type={confirmModal.type}
        isLoading={isLoadingPage || isAwaitingSignature}
      />
      </div>
    </div>
  );
};

export default Marketplace;
