import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { useToast } from "../contexts/ToastContext";
import { ListedToken } from "../sdk/MarketplaceSDK";
import { NETWORK_CONFIG } from "../config/network";
import Pagination from "../Components/Pagination";
import { useNFTMetadata, getTokenURI } from "../hooks/useNFTMetadata";
import { NFTMetadataDisplay } from "../Components/NFTMetadata";
import ConfirmationModal from "../Components/ConfirmationModal";
import {
  applyListingUpdatedUpdate,
  applyListingCanceledUpdate,
} from "../utils/optimisticUpdates";
import {
  storePendingUpdate,
  getPendingUpdates,
  removePendingUpdate,
  isTransactionConfirmed,
} from "../utils/persistentOptimisticUpdates";
import { parseAllEvents } from "../utils/eventParser";
import "./MyListings.css";

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

// Listing card component with metadata
const ListingCard: React.FC<{
  listing: ListedToken;
  updatingListingId: number | null;
  newPrice: string;
  setNewPrice: (price: string) => void;
  handleCancelUpdate: () => void;
  handleConfirmUpdate: (listingId: number) => void;
  isLoading: boolean;
  handleUpdatePrice: (listingId: number, currentPrice: string) => void;
  handleCancelListing: (listingId: number) => void;
  cancelingListingId: number | null;
}> = ({ listing, updatingListingId, newPrice, setNewPrice, handleCancelUpdate, handleConfirmUpdate, isLoading, handleUpdatePrice, handleCancelListing, cancelingListingId }) => {
  const tokenURI = getTokenURI(listing.tokenData);
  const { metadata, isLoading: metadataLoading } = useNFTMetadata(tokenURI);
  
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
          <span className="listing-badge">
            #{listing.listingId}
          </span>
        </div>

        <NFTMetadataDisplay 
          metadata={metadata} 
          isLoading={metadataLoading}
          fallbackName={`Domain #${listing.tokenId}`}
        />

        <div className="nft-info">
          <div className="info-row">
            <span className="label">Current Price:</span>
            <span className="value price">
              {listing.price} {NETWORK_CONFIG.nativeCurrency.symbol}
            </span>
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
              placeholder={`New price in ${NETWORK_CONFIG.nativeCurrency.symbol}`}
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
                {isLoading ? "Updating..." : "Update"}
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
              {cancelingListingId === listing.listingId ? "Cancelling..." : "Cancel Listing"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// History listing card component with metadata
const HistoryListingCard: React.FC<{
  listing: ListedToken;
}> = ({ listing }) => {
  const tokenURI = getTokenURI(listing.tokenData);
  const { metadata, isLoading: metadataLoading } = useNFTMetadata(tokenURI);
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
          <span className="listing-badge">
            #{listing.listingId}
          </span>
        </div>

        <NFTMetadataDisplay 
          metadata={metadata} 
          isLoading={metadataLoading}
          fallbackName={`Domain #${listing.tokenId}`}
        />

        <div className="nft-info">
          <div className="info-row">
            <span className="label">Last Price:</span>
            <span className="value price">
              {listing.price} {NETWORK_CONFIG.nativeCurrency.symbol}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Status:</span>
            <span className="value status">Inactive</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MyListings: React.FC = () => {
  const { account } = useWallet();
  const { sdk } = useMarketplaceSDK();
  const { showSuccess, showError } = useToast();
  const [myListings, setMyListings] = useState<ListedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingListingId, setUpdatingListingId] = useState<number | null>(
    null,
  );
  const [newPrice, setNewPrice] = useState<string>("");
  const [cancelingListingId, setCancelingListingId] = useState<number | null>(
    null,
  );
  const [activeCurrentPage, setActiveCurrentPage] = useState(1);
  const [soldCurrentPage, setSoldCurrentPage] = useState(1);
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

  // Calculate stats (will be 0 initially, then update when data loads)
  // Calculate before loading check so stats are always available
  const activeListings = myListings.filter((l) => l.active);
  const historyListings = myListings.filter((l) => !l.active);
  

  const loadMyListings = useCallback(async () => {
    if (!sdk) return;

    setIsLoading(true);
    setError(null);

    try {
      const listings =
        await sdk.getMyAllListedDomainsOnMarketplaceWithTokenData();

      setMyListings(listings);
      
      // Add a small delay to ensure all state updates are complete before showing cards
      // This prevents flickering and weird loading states
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsDataReady(true);
    } catch (err: any) {
      console.error("Error loading listings:", err);
      setError("Failed to load your listings");
      setIsDataReady(true);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  // Check and re-apply pending optimistic updates on mount
  useEffect(() => {
    const applyPendingUpdates = async () => {
      if (!sdk || !account) {
        console.log('⏸️ [PERSISTENT UPDATE] Skipping check - SDK or account not available');
        return;
      }
      
      console.log('🔄 [PERSISTENT UPDATE] Checking for pending listing updates on page load...');
      const allPending = getPendingUpdates();
      const pending = allPending.filter(
        u => u.type === 'update' || u.type === 'cancel'
      );
      
      if (pending.length === 0) {
        console.log('✅ [PERSISTENT UPDATE] No pending listing updates found');
        return;
      }
      
      console.log(`🔄 [PERSISTENT UPDATE] Found ${pending.length} pending listing update(s), verifying...`);
      
      for (const update of pending) {
        try {
          console.log(`🔍 [PERSISTENT UPDATE] Processing update:`, {
            type: update.type,
            txHash: update.txHash,
            listingId: update.data.listingId,
            age: `${Math.round((Date.now() - update.timestamp) / 1000)}s old`
          });
          
          const provider = (sdk as any).signer?.provider || (sdk as any).provider;
          const isConfirmed = await isTransactionConfirmed(update.txHash, provider);
          
          if (isConfirmed) {
            console.log(`📥 [PERSISTENT UPDATE] Fetching receipt for ${update.txHash}...`);
            const receipt = await provider?.getTransactionReceipt(update.txHash);
            if (receipt) {
              console.log(`📄 [PERSISTENT UPDATE] Parsing events from receipt...`);
              const events = parseAllEvents(
                receipt,
                (sdk as any).marketplaceAddress,
                (sdk as any).nftAddress
              );
              
              if (update.type === 'update' && events.listingUpdated) {
                console.log("✅ [PERSISTENT UPDATE] Re-applying pending listing update:", {
                  txHash: update.txHash,
                  listingId: events.listingUpdated.listingId,
                  newPrice: events.listingUpdated.newPrice,
                  action: 'Updating listing price'
                });
                setMyListings(prevListings => 
                  applyListingUpdatedUpdate(prevListings, events.listingUpdated!)
                );
                console.log("✅ [PERSISTENT UPDATE] Listing update re-applied successfully");
                removePendingUpdate(update.txHash);
              } else if (update.type === 'cancel' && events.listingCanceled) {
                console.log("✅ [PERSISTENT UPDATE] Re-applying pending listing cancellation:", {
                  txHash: update.txHash,
                  listingId: events.listingCanceled.listingId,
                  action: 'Removing listing'
                });
                setMyListings(prevListings => 
                  applyListingCanceledUpdate(prevListings, events.listingCanceled!)
                );
                console.log("✅ [PERSISTENT UPDATE] Listing cancellation re-applied successfully");
                removePendingUpdate(update.txHash);
              } else {
                console.warn(`⚠️ [PERSISTENT UPDATE] Expected event not found for ${update.type}, keeping in pending`);
              }
            } else {
              console.warn(`⚠️ [PERSISTENT UPDATE] Could not fetch receipt for ${update.txHash}, keeping in pending`);
            }
          } else {
            console.warn("⚠️ [PERSISTENT UPDATE] Transaction not confirmed, removing from pending:", {
              txHash: update.txHash,
              type: update.type,
              reason: 'Transaction not confirmed or failed'
            });
            removePendingUpdate(update.txHash);
          }
        } catch (error) {
          console.error(`❌ [PERSISTENT UPDATE] Error applying pending update ${update.txHash}:`, error);
        }
      }
      
      console.log('✅ [PERSISTENT UPDATE] Finished processing all pending listing updates');
    };
    
    applyPendingUpdates();
  }, [sdk, account]);

  useEffect(() => {
    if (sdk && account) {
      setIsDataReady(false); // Reset data ready state when loading starts
      loadMyListings();
    } else {
      setIsDataReady(false);
    }
  }, [sdk, account, loadMyListings]);

  const handleUpdatePrice = (listingId: number, currentPrice: string) => {
    setUpdatingListingId(listingId);
    setNewPrice(currentPrice);
  };

  const handleCancelUpdate = () => {
    setUpdatingListingId(null);
    setNewPrice("");
  };

  const handleConfirmUpdate = async (listingId: number) => {
    if (!sdk || !newPrice || parseFloat(newPrice) <= 0) {
      showError("Invalid Price", "Please enter a valid price");
      return;
    }

    // Find the listing to get domain name
    const listing = myListings.find(l => l.listingId === listingId);
    const tokenURI = listing ? getTokenURI(listing.tokenData) : null;
    const domainName = listing ? (await getDomainNameFromURI(tokenURI, listing.tokenId)) : `Listing #${listingId}`;

    setConfirmModal({
      isOpen: true,
      title: "Update Listing Price",
      message: `Update ${domainName} listing to ${newPrice} ${NETWORK_CONFIG.nativeCurrency.symbol}?`,
      domainName: domainName,
      type: "default",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setIsLoading(true);
        setIsAwaitingSignature(true);
        setTxStatus('signature');

        try {
          const submittingTimeout = setTimeout(() => {
            setTxStatus('submitting');
          }, 1000);
          
          const confirmingTimeout = setTimeout(() => {
            setTxStatus('confirming');
          }, 3000);
          
          // Use new method that returns receipt and parsed events
          const { txHash, listingUpdatedEvent } = await (sdk as any).updateListingWithReceipt(listingId, newPrice);
          
          clearTimeout(submittingTimeout);
          clearTimeout(confirmingTimeout);
          
          setIsAwaitingSignature(false);
          setTxStatus(null);

          if (txHash && listingUpdatedEvent) {
            // OPTIMISTIC UPDATE: Immediately update UI with parsed event data
            console.log("✅ Optimistic Update: Listing price updated!", { txHash, listingId: listingUpdatedEvent.listingId, newPrice: listingUpdatedEvent.newPrice });
            
            // Store pending update for persistence across page refreshes
            console.log('💾 [PERSISTENT UPDATE] Storing listing update for persistence...');
            storePendingUpdate({
              type: 'update',
              txHash,
              data: {
                listingId: listingUpdatedEvent.listingId,
                newPrice: listingUpdatedEvent.newPrice,
              },
            });
            
            // Update listing price in current view
            setMyListings(prevListings => 
              applyListingUpdatedUpdate(prevListings, listingUpdatedEvent)
            );
            
            // Show success message immediately
            showSuccess(
              "Price Updated Successfully! ✅",
              `${domainName} listing price updated to ${newPrice} ${NETWORK_CONFIG.nativeCurrency.symbol}`,
              txHash
            );
            setUpdatingListingId(null);
            setNewPrice("");
            
            // Background sync: Verify with subgraph after delay (non-blocking)
            setTimeout(async () => {
              console.log("🔄 Background Sync: Verifying listing update with subgraph...");
              console.log(`🔄 [PERSISTENT UPDATE] Starting background sync for ${txHash}...`);
              (sdk as any).clearCaches();
              await loadMyListings();
              console.log(`🗑️ [PERSISTENT UPDATE] Background sync completed, removing pending update for ${txHash}`);
              removePendingUpdate(txHash);
            }, 30000); // Wait 30 seconds for subgraph to index
          } else if (txHash) {
            // Transaction succeeded but couldn't parse event - fallback to old behavior
            console.warn("Update succeeded but couldn't parse event, using fallback refresh");
            showSuccess(
              "Price Updated Successfully! ✅",
              `${domainName} listing price updated to ${newPrice} ${NETWORK_CONFIG.nativeCurrency.symbol}`,
              txHash
            );
            setUpdatingListingId(null);
            setNewPrice("");
            await loadMyListings();
          } else {
            showError("Update Failed", "Failed to update price. Please try again.");
          }
        } catch (err: any) {
          console.error("Error updating listing:", err);
          setIsAwaitingSignature(false);
          setTxStatus(null);
          showError("Update Error", err.message || "Failed to update price");
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handleCancelListing = async (listingId: number) => {
    if (!sdk) return;

    // Find the listing to get domain name
    const listing = myListings.find(l => l.listingId === listingId);
    const tokenURI = listing ? getTokenURI(listing.tokenData) : null;
    const domainName = listing ? (await getDomainNameFromURI(tokenURI, listing.tokenId)) : `Listing #${listingId}`;

    setConfirmModal({
      isOpen: true,
      title: "Cancel Listing",
      message: `Cancel ${domainName} listing? This will remove it from the marketplace.`,
      domainName: domainName,
      type: "danger",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setCancelingListingId(listingId);
        setIsAwaitingSignature(true);
        setTxStatus('signature');

        try {
          const submittingTimeout = setTimeout(() => {
            setTxStatus('submitting');
          }, 1000);
          
          const confirmingTimeout = setTimeout(() => {
            setTxStatus('confirming');
          }, 3000);
          
          // Use new method that returns receipt and parsed events
          const { txHash, listingCanceledEvent } = await (sdk as any).cancelListingWithReceipt(listingId);
          
          clearTimeout(submittingTimeout);
          clearTimeout(confirmingTimeout);
          
          setIsAwaitingSignature(false);
          setTxStatus(null);

          if (txHash && listingCanceledEvent) {
            // OPTIMISTIC UPDATE: Immediately update UI with parsed event data
            console.log("✅ Optimistic Update: Listing canceled!", { txHash, listingId: listingCanceledEvent.listingId });
            
            // Store pending update for persistence across page refreshes
            console.log('💾 [PERSISTENT UPDATE] Storing listing cancellation for persistence...');
            storePendingUpdate({
              type: 'cancel',
              txHash,
              data: {
                listingId: listingCanceledEvent.listingId,
              },
            });
            
            // Remove canceled listing from current view
            setMyListings(prevListings => 
              applyListingCanceledUpdate(prevListings, listingCanceledEvent)
            );
            
            // Show success message immediately
            showSuccess(
              "Listing Cancelled Successfully! ✅",
              `${domainName} listing has been removed from the marketplace`,
              txHash
            );
            
            // Background sync: Verify with subgraph after delay (non-blocking)
            setTimeout(async () => {
              console.log("🔄 Background Sync: Verifying listing cancellation with subgraph...");
              console.log(`🔄 [PERSISTENT UPDATE] Starting background sync for ${txHash}...`);
              (sdk as any).clearCaches();
              await loadMyListings();
              console.log(`🗑️ [PERSISTENT UPDATE] Background sync completed, removing pending update for ${txHash}`);
              removePendingUpdate(txHash);
            }, 30000); // Wait 30 seconds for subgraph to index
          } else if (txHash) {
            // Transaction succeeded but couldn't parse event - fallback to old behavior
            console.warn("Cancel succeeded but couldn't parse event, using fallback refresh");
            showSuccess(
              "Listing Cancelled Successfully! ✅",
              `${domainName} listing has been removed from the marketplace`,
              txHash
            );
            await loadMyListings();
          } else {
            showError("Cancel Failed", "Failed to cancel listing. Please try again.");
          }
        } catch (err: any) {
          console.error("Error cancelling listing:", err);
          
          // Simple error message - let user try again
          let errorMessage = err.message || "Failed to cancel listing";
          
          if (errorMessage.includes("switch to") || errorMessage.includes("Chain ID:")) {
            errorMessage += " Please switch to the correct network in your wallet and try again.";
          } else if (errorMessage.includes("user rejected")) {
            errorMessage += " Transaction was cancelled. You can try again if needed.";
          } else {
            errorMessage += " Please try again. If the issue persists, check your network connection.";
          }
          
          showError("Cancel Error", errorMessage);
          setIsAwaitingSignature(false);
          setTxStatus(null);
        } finally {
          setCancelingListingId(null);
        }
      },
    });
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

  // Pagination for active listings
  const activeTotalPages = Math.ceil(activeListings.length / ITEMS_PER_PAGE);
  const activeStartIndex = (activeCurrentPage - 1) * ITEMS_PER_PAGE;
  const activeEndIndex = activeStartIndex + ITEMS_PER_PAGE;
  const paginatedActiveListings = activeListings.slice(
    activeStartIndex,
    activeEndIndex,
  );

  // Pagination for sold listings
  const soldTotalPages = Math.ceil(historyListings.length / ITEMS_PER_PAGE);
  const soldStartIndex = (soldCurrentPage - 1) * ITEMS_PER_PAGE;
  const soldEndIndex = soldStartIndex + ITEMS_PER_PAGE;
  const paginatedSoldListings = historyListings.slice(
    soldStartIndex,
    soldEndIndex,
  );

  const handleActivePageChange = (page: number) => {
    setActiveCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSoldPageChange = (page: number) => {
    setSoldCurrentPage(page);
    const soldSection = document.getElementById("sold-section");
    if (soldSection) {
      soldSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="my-listings">
      <div className="my-listings-container">
        <div className="page-header">
          <h1>My Listings</h1>
          <p>Manage your marketplace listings</p>
        </div>

        {/* Show stats cards only when not awaiting signature */}
        {!isAwaitingSignature && (
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
        )}

        {/* Show loading screen when loading OR awaiting signature OR data not ready */}
        {isLoading || !isDataReady || isAwaitingSignature ? (
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
        ) : myListings.length === 0 ? (
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
                    <ListingCard
                      key={listing.listingId}
                      listing={listing}
                      updatingListingId={updatingListingId}
                      newPrice={newPrice}
                      setNewPrice={setNewPrice}
                      handleCancelUpdate={handleCancelUpdate}
                      handleConfirmUpdate={handleConfirmUpdate}
                      isLoading={isLoading}
                      handleUpdatePrice={handleUpdatePrice}
                      handleCancelListing={handleCancelListing}
                      cancelingListingId={cancelingListingId}
                    />
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
                    <HistoryListingCard key={listing.listingId} listing={listing} />
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

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        domainName={confirmModal.domainName}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        type={confirmModal.type}
        isLoading={isLoading || isAwaitingSignature}
      />
      </div>
    </div>
  );
};

export default MyListings;
