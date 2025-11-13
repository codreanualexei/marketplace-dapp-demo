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
      console.log("Loading total listing count in background...");
      const startTime = Date.now();
      
      // Get just the count without loading all listings
      const count = await sdk.getActiveListingCountOptimized();
      
      const endTime = Date.now();
      console.log(`Loaded listing count in ${endTime - startTime}ms:`, count);
      console.log(`Total active listings in marketplace: ${count}`);

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
    console.log(`loadCurrentPage called - sdk: ${!!sdk}, isLoadingPage: ${isLoadingPageRef.current}, currentPage: ${currentPage}`);
    if (!sdk || isLoadingPageRef.current) {
      console.log("loadCurrentPage early return - sdk or loading check failed");
      return;
    }

    isLoadingPageRef.current = true;
    setIsLoadingPage(true);
    setError(null);
    setListedDomains([]);

    try {
      console.log(`Loading page ${currentPage} efficiently (${ITEMS_PER_PAGE} items)...`);
      const startTime = Date.now();
      
      // Use the SDK's optimized page method to get only what we need (single subgraph query)
      const pageListings = await sdk.getActiveListingsPageOptimized(currentPage, ITEMS_PER_PAGE);
      
      console.log(`SDK returned ${pageListings.length} listings for page ${currentPage}:`, pageListings.map(l => l.listingId));

      // The subgraph already returns tokenData with listings, so we can use them directly
      // Filter out invalid listings and use the data as-is
      const validListings = pageListings.filter(listing => 
        listing && listing.active && listing.seller && listing.strCollectionAddress && listing.tokenData
      );
      
      console.log(`Found ${validListings.length} valid listings out of ${pageListings.length} total`);
      
      // Set all listings at once (no need for progressive loading since subgraph is fast)
      setListedDomains(validListings);
      
      // If this is the first page and we haven't loaded count yet, load it in the background
      if (currentPage === 1 && !hasLoadedCountRef.current) {
        // Load count in background (non-blocking)
        loadTotalCount();
      }
      
      const endTime = Date.now();
      console.log(`Loaded page ${currentPage} in ${endTime - startTime}ms:`, validListings);
      console.log(`Found ${validListings.length} active listings on page ${currentPage}`);
      
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
      console.log("Marketplace: Clearing data due to SDK change");
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

  // Load first page when SDK is available (single query optimization)
  // This is the primary data load - count will be loaded in background
  useEffect(() => {
    if (sdk && !isLoadingPageRef.current && currentPage === 1 && listedDomains.length === 0) {
      console.log("Marketplace: SDK available, loading first page (single query)");
      loadCurrentPage();
    }
  }, [sdk, currentPage, listedDomains.length, loadCurrentPage]);

  // Load page when currentPage changes (but not on initial load)
  useEffect(() => {
    if (sdk && currentPage > 1 && !isLoadingPageRef.current) {
      console.log("Marketplace: Loading page", currentPage);
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
          console.log(`Starting purchase for listing ${listing.listingId}...`);
          
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
          
          const txHash = await sdk.buyToken(listing.listingId);
          
          // Clear timeouts since transaction completed
          clearTimeout(submittingTimeout);
          clearTimeout(confirmingTimeout);
          
          // Transaction completed
          setIsAwaitingSignature(false);
          setTxStatus(null);

          if (txHash) {
            console.log(`Purchase successful! Transaction: ${txHash}`);
            showSuccess(
              "Purchase Successful! 🎉",
              `${domainName} has been purchased successfully.`,
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
