import React, { useState, useEffect } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useToast } from "../contexts/ToastContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { FormattedToken } from "../sdk/MarketplaceSDK";
import { NETWORK_CONFIG } from "../config/network";
import Pagination from "../Components/Pagination";
import { useNFTMetadata, getTokenURI } from "../hooks/useNFTMetadata";
import { NFTMetadataDisplay } from "../Components/NFTMetadata";
import "./MyDomains.css";

const ITEMS_PER_PAGE = 12;

// Domain card component with metadata
const DomainCard: React.FC<{
  domain: FormattedToken;
  tokenURI: string | null;
  listingTokenId: number | null;
  listPrice: string;
  setListPrice: (price: string) => void;
  handleCancelList: () => void;
  handleConfirmList: (tokenId: number) => void;
  isLoading: boolean;
  checkingApproval: Record<number, boolean>;
  tokenApprovalStatus: Record<number, boolean>;
  handleApprove: (tokenId: number) => void;
  handleListForSale: (tokenId: number) => void;
  formatAddress: (address: string) => string;
}> = ({ domain, tokenURI, listingTokenId, listPrice, setListPrice, handleCancelList, handleConfirmList, isLoading, checkingApproval, tokenApprovalStatus, handleApprove, handleListForSale, formatAddress }) => {
  const { metadata, isLoading: metadataLoading } = useNFTMetadata(tokenURI);
  
  const imageSrc = metadata?.image || domain.image || domain.uri ||
    `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${domain.tokenId}`;

  return (
    <div className="nft-card">
      <div className="nft-card-image">
        <img
          src={imageSrc}
          alt={metadata?.name || `Domain #${domain.tokenId}`}
          onError={(e) => {
            e.currentTarget.src = `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${domain.tokenId}`;
          }}
        />
      </div>

      <div className="nft-card-content">
        <div className="nft-card-header">
          <h3 className="nft-card-title">
            {metadata?.name || `Domain #${domain.tokenId}`}
          </h3>
        </div>

        <NFTMetadataDisplay 
          metadata={metadata} 
          isLoading={metadataLoading}
          fallbackName={`Domain #${domain.tokenId}`}
        />

        <div className="nft-info">
          <div className="info-row">
            <span className="label">Creator:</span>
            <span className="value">
              {formatAddress(domain.creator)}
            </span>
          </div>
          {domain.lastPrice !== "0" && (
            <div className="info-row">
              <span className="label">Last Price:</span>
              <span className="value price">
                {(Number(domain.lastPrice) / 1e18).toFixed(4)} {NETWORK_CONFIG.nativeCurrency.symbol}
              </span>
            </div>
          )}
          <div className="info-row">
            <span className="label">Minted:</span>
            <span className="value">
              {new Date(
                domain.mintTimestamp * 1000,
              ).toLocaleDateString()}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Status:</span>
            <span className={`value status ${checkingApproval[domain.tokenId] ? 'checking' : tokenApprovalStatus[domain.tokenId] ? 'approved' : 'not-approved'}`}>
              {checkingApproval[domain.tokenId] 
                ? "Checking..." 
                : tokenApprovalStatus[domain.tokenId] 
                  ? "Approved for Sale" 
                  : "Not Approved"
              }
            </span>
          </div>
        </div>

        {listingTokenId === domain.tokenId ? (
          <div className="listing-form">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={`Price in ${NETWORK_CONFIG.nativeCurrency.symbol}`}
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              className="price-input"
            />
            <div className="form-actions">
              <button
                className="action-button secondary"
                onClick={handleCancelList}
              >
                Cancel
              </button>
              <button
                className="action-button primary"
                onClick={() => handleConfirmList(domain.tokenId)}
                disabled={!listPrice || isLoading}
              >
                {isLoading ? "Listing..." : "List"}
              </button>
            </div>
          </div>
        ) : (
          <div className="nft-card-footer">
            {checkingApproval[domain.tokenId] ? (
              <button className="action-button secondary" disabled>
                Checking...
              </button>
            ) : tokenApprovalStatus[domain.tokenId] ? (
              <button
                className="action-button primary"
                onClick={() => handleListForSale(domain.tokenId)}
                disabled={isLoading}
              >
                List for Sale
              </button>
            ) : (
              <button
                className="action-button secondary"
                onClick={() => handleApprove(domain.tokenId)}
                disabled={isLoading}
              >
                Approve for Sale
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MyDomains: React.FC = () => {
  const { account } = useWallet();
  const { showSuccess, showError } = useToast();
  const { sdk, isLoading: sdkLoading, error: sdkError } = useMarketplaceSDK();
  const [myDomains, setMyDomains] = useState<FormattedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [listPrice, setListPrice] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [tokenApprovalStatus, setTokenApprovalStatus] = useState<Record<number, boolean>>({});
  const [checkingApproval, setCheckingApproval] = useState<Record<number, boolean>>({});
  const [isAwaitingSignature, setIsAwaitingSignature] = useState(false);

  // Show loading screen until all data is loaded (domains + approval status) OR awaiting signature
  const isFullyLoading = isLoading || isLoadingApprovals || isAwaitingSignature;

  // Load domains when component mounts and SDK is available
  useEffect(() => {
    if (sdk && account) {
      loadMyDomains();
    }
  }, [sdk, account]);

  const loadMyDomains = async () => {
    if (!sdk || !account) {
      console.warn("Cannot load domains: SDK or account not available");
      return;
    }

    setIsLoading(true);
    setIsLoadingApprovals(true);
    setError(null);
    setMyDomains([]);
    setTokenApprovalStatus({});

    try {
      console.log("Loading domains using subgraph...", { account });
      const startTime = Date.now();
      
      const domains = await sdk.getMyDomainsFromCollection();
      
      const endTime = Date.now();
      console.log(`Loaded ${domains.length} domains in ${endTime - startTime}ms`);
      console.log("Domains data:", domains);
      
      if (domains.length === 0) {
        console.warn("No domains found. This could mean:");
        console.warn("1. You don't own any NFTs in this collection");
        console.warn("2. The subgraph hasn't indexed your tokens yet");
        console.warn("3. There's an issue with the subgraph query");
        // No domains, so no need to check approvals
        setIsLoadingApprovals(false);
        setMyDomains(domains);
        return;
      }
      
      // Set domains first (but don't show them yet - wait for approvals)
      setMyDomains(domains);
      
      // Check approval status for all domains (this must complete before showing cards)
      await checkApprovalStatusForAll(domains);
    } catch (err: any) {
      console.error("Error loading domains:", err);
      setError(`Failed to load your domains: ${err.message || 'Unknown error'}`);
      setIsLoadingApprovals(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkApprovalStatusForAll = async (domains: FormattedToken[]) => {
    if (!sdk) {
      setIsLoadingApprovals(false);
      return;
    }
    
    console.log(`Checking approval status for ${domains.length} domains using batch method...`);
    const startTime = Date.now();
    
    try {
      // Use optimized batch method (checks isApprovedForAll once, then individual tokens if needed)
      const tokenIds = domains.map(domain => domain.tokenId);
      const approvalMap = await sdk.batchCheckTokenApprovals(tokenIds);
      
      const endTime = Date.now();
      console.log(`Batch approval check completed in ${endTime - startTime}ms`);
      console.log('Final approval status map:', approvalMap);
      
      setTokenApprovalStatus(approvalMap);
    } catch (error) {
      console.error('Error in batch approval check:', error);
      // Fallback: set all to false
      const approvalMap: Record<number, boolean> = {};
      domains.forEach(domain => {
        approvalMap[domain.tokenId] = false;
      });
      setTokenApprovalStatus(approvalMap);
    } finally {
      // Mark approvals as loaded - now we can show the cards
      setIsLoadingApprovals(false);
    }
  };

  const checkApprovalStatus = async (tokenId: number) => {
    if (!sdk) return;
    
    setCheckingApproval(prev => ({ ...prev, [tokenId]: true }));
    
    try {
      const isApproved = await sdk.isTokenApprovedForMarketplace(tokenId);
      setTokenApprovalStatus(prev => ({ ...prev, [tokenId]: isApproved }));
      return isApproved;
    } catch (error) {
      console.error(`Error checking approval for token ${tokenId}:`, error);
      setTokenApprovalStatus(prev => ({ ...prev, [tokenId]: false }));
      return false;
    } finally {
      setCheckingApproval(prev => ({ ...prev, [tokenId]: false }));
    }
  };

  const handleListClick = (tokenId: number) => {
    setListingTokenId(tokenId);
    setListPrice("");
  };

  const handleCancelList = () => {
    setListingTokenId(null);
    setListPrice("");
  };

  const handleApproveToken = async (tokenId: number) => {
    if (!sdk) return;

    const confirmed = window.confirm(
      `Approve Domain #${tokenId} for marketplace listing?`,
    );

    if (!confirmed) return;

    setIsLoading(true);
    setIsAwaitingSignature(true);

    try {
      const txHash = await sdk.approveTokenForSale(tokenId);
      setIsAwaitingSignature(false);

      if (txHash) {
        showSuccess(
          "Domain Approved! ✅",
          `Domain #${tokenId} has been approved for marketplace listing.`,
          txHash
        );
        // Check approval status again
        await checkApprovalStatus(tokenId);
      } else {
        showError("Approval Failed", "Failed to approve domain for marketplace.");
      }
    } catch (err: any) {
      console.error("Error approving token:", err);
      setIsAwaitingSignature(false);
      showError("Approval Failed", err.message || "Failed to approve domain");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmList = async (tokenId: number) => {
    if (!sdk || !listPrice || parseFloat(listPrice) <= 0) {
      showError("Invalid Price", "Please enter a valid price");
      return;
    }

    const confirmed = window.confirm(
      `List Domain #${tokenId} for ${listPrice} ${NETWORK_CONFIG.nativeCurrency.symbol}?`,
    );

    if (!confirmed) return;

    setIsLoading(true);
    setIsAwaitingSignature(true);

    try {
      const txHash = await sdk.listTokenDirect(tokenId, listPrice);
      setIsAwaitingSignature(false);

      if (txHash) {
        showSuccess(
          "Domain Listed! 🚀",
          `Domain #${tokenId} has been listed for ${listPrice} ${NETWORK_CONFIG.nativeCurrency.symbol}.`,
          txHash
        );
        setListingTokenId(null);
        setListPrice("");
        // Reload domains
        await loadMyDomains();
      } else {
        showError(
          "Listing Failed",
          "Failed to list domain. Make sure you own it and it's not already listed."
        );
      }
    } catch (err: any) {
      console.error("Error listing token:", err);
      setIsAwaitingSignature(false);
      showError("Listing Failed", err.message || "Failed to list domain");
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Pagination logic
  const totalPages = Math.ceil(myDomains.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDomains = myDomains.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!account) {
    return (
      <div className="my-domains">
        <div className="connect-prompt">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to view your domains</p>
        </div>
      </div>
    );
  }

  if (sdkLoading) {
    return (
      <div className="my-domains">
        <div className="loading">
          <div className="spinner"></div>
          <p>Initializing SDK...</p>
        </div>
      </div>
    );
  }

  if (sdkError) {
    return (
      <div className="my-domains">
        <div className="error-message">
          <h3>SDK Error</h3>
          <p>{sdkError}</p>
        </div>
      </div>
    );
  }

  if (!sdk) {
    return (
      <div className="my-domains">
        <div className="error-message">
          <h3>SDK Not Ready</h3>
          <p>Please wait for the SDK to initialize</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-domains">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadMyDomains}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-domains">
      <div className="my-domains-container">
        <div className="page-header">
          <h1>My Domains</h1>
          <p>Manage your domain NFTs</p>
        </div>

        {/* Show stats card only when not awaiting signature */}
        {!isAwaitingSignature && (
          <div className="domains-stats">
            <div className="stat-card">
              <span className="stat-value">{myDomains.length}</span>
              <span className="stat-label">Total Domains</span>
            </div>
          </div>
        )}

        {/* Show loading screen for content, but stats are always visible above */}
        {isFullyLoading ? (
          <div className="loading-overlay">
            <div className="loading">
              <div className="spinner"></div>
              <p>
                {isAwaitingSignature 
                  ? "Waiting for your signature..." 
                  : isLoading 
                    ? "Loading your domains..." 
                    : "Loading approval status..."}
              </p>
            </div>
          </div>
        ) : myDomains.length === 0 ? (
          <div className="empty-state">
            <h3>No domains found</h3>
            <p>
              You don't own any domains in this collection yet
            </p>
          </div>
        ) : myDomains.length > 0 && !isFullyLoading ? (
          <>

            <div className="nft-grid">
              {paginatedDomains.map((domain) => {
                const tokenURI = getTokenURI(domain) || domain.uri;
                return <DomainCard
                  key={domain.tokenId}
                  domain={domain}
                  tokenURI={tokenURI}
                  listingTokenId={listingTokenId}
                  listPrice={listPrice}
                  setListPrice={setListPrice}
                  handleCancelList={handleCancelList}
                  handleConfirmList={handleConfirmList}
                  isLoading={isLoading}
                  checkingApproval={checkingApproval}
                  tokenApprovalStatus={tokenApprovalStatus}
                  handleApprove={handleApproveToken}
                  handleListForSale={handleListClick}
                  formatAddress={formatAddress}
                />;
              })}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={myDomains.length}
            />
          </>
        ) : null}
      </div>
    </div>
  );
};

export default MyDomains;
