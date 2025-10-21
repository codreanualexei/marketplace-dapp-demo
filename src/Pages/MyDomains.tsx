import React, { useState } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { FormattedToken } from "../sdk/MarketplaceSDK";
import Pagination from "../Components/Pagination";
import "./MyDomains.css";

const ITEMS_PER_PAGE = 12;

const MyDomains: React.FC = () => {
  const { account } = useWallet();
  const { sdk, isLoading: sdkLoading, error: sdkError } = useMarketplaceSDK();
  const [myDomains, setMyDomains] = useState<FormattedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [listPrice, setListPrice] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadMyDomains = async () => {
    if (!sdk) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Loading domains using Alchemy-enhanced SDK...");
      const startTime = Date.now();
      
      const domains = await sdk.getMyDomainsFromCollection();
      
      const endTime = Date.now();
      console.log(`Loaded ${domains.length} domains in ${endTime - startTime}ms`);
      
      setMyDomains(domains);
    } catch (err: any) {
      console.error("Error loading domains:", err);
      setError("Failed to load your domains");
    } finally {
      setIsLoading(false);
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

  const handleConfirmList = async (tokenId: number) => {
    if (!sdk || !listPrice || parseFloat(listPrice) <= 0) {
      alert("Please enter a valid price");
      return;
    }

    const confirmed = window.confirm(
      `List Domain #${tokenId} for ${listPrice} MATIC?`,
    );

    if (!confirmed) return;

    setIsLoading(true);

    try {
      const txHash = await sdk.listToken(tokenId, listPrice);

      if (txHash) {
        alert(`Domain listed successfully! Transaction: ${txHash}`);
        setListingTokenId(null);
        setListPrice("");
        // Reload domains
        await loadMyDomains();
      } else {
        alert(
          "Failed to list domain. Make sure you own it and it's not already listed.",
        );
      }
    } catch (err: any) {
      console.error("Error listing token:", err);
      alert(`Error: ${err.message || "Failed to list domain"}`);
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
          <p>Initializing Alchemy SDK...</p>
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

  if (isLoading && myDomains.length === 0) {
    return (
      <div className="my-domains">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your domains with Alchemy...</p>
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

        <div className="load-section">
          <button
            className="load-button"
            onClick={loadMyDomains}
            disabled={isLoading}
          >
            {isLoading ? "Loading Your Domains..." : "Load My Domains"}
          </button>
          <p className="load-hint">
            Click to scan the collection for NFTs you own
          </p>
        </div>

        {myDomains.length === 0 && !isLoading ? (
          <div className="empty-state">
            <h3>Click "Load My Domains" to check ownership</h3>
            <p>
              This will scan the collection for NFTs owned by your address
            </p>
          </div>
        ) : myDomains.length > 0 ? (
          <>
            <div className="domains-stats">
              <div className="stat-card">
                <span className="stat-value">{myDomains.length}</span>
                <span className="stat-label">Total Domains</span>
              </div>
            </div>

            <div className="nft-grid">
              {paginatedDomains.map((domain) => (
                <div key={domain.tokenId} className="nft-card">
                  <div className="nft-card-image">
                    <img
                      src={
                        domain.uri ||
                        `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${domain.tokenId}`
                      }
                      alt={`Domain #${domain.tokenId}`}
                      onError={(e) => {
                        e.currentTarget.src = `https://via.placeholder.com/400x400/667eea/ffffff?text=Domain+${domain.tokenId}`;
                      }}
                    />
                  </div>

                  <div className="nft-card-content">
                    <div className="nft-card-header">
                      <h3 className="nft-card-title">
                        Domain #{domain.tokenId}
                      </h3>
                    </div>

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
                            {(Number(domain.lastPrice) / 1e18).toFixed(4)} MATIC
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
                    </div>

                    {listingTokenId === domain.tokenId ? (
                      <div className="listing-form">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Price in MATIC"
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
                            {isLoading ? "Listing..." : "Confirm"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="nft-card-footer">
                        <button
                          className="action-button primary"
                          onClick={() => handleListClick(domain.tokenId)}
                          disabled={isLoading}
                        >
                          List for Sale
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
