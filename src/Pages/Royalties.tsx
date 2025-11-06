import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { useToast } from "../contexts/ToastContext";
import { FormattedToken } from "../sdk/MarketplaceSDK";
import { ethers } from "ethers";
import { useNFTMetadata, getTokenURI } from "../hooks/useNFTMetadata";
import { NFTMetadataDisplay } from "../Components/NFTMetadata";
import ConfirmationModal from "../Components/ConfirmationModal";
import "./Royalties.css";

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

// Royalty domain card component with metadata
const RoyaltyDomainCard: React.FC<{
  domain: FormattedToken;
  hasRoyalty: boolean;
  withdrawing: string | null;
  handleWithdrawFromSplitter: (splitterAddress: string) => void;
  formatAddress: (address: string) => string;
}> = ({ domain, hasRoyalty, withdrawing, handleWithdrawFromSplitter, formatAddress }) => {
  const tokenURI = getTokenURI(domain) || domain.uri;
  const { metadata, isLoading: metadataLoading } = useNFTMetadata(tokenURI);
  
  const imageSrc = metadata?.image ||
    domain.image ||
    domain.uri ||
    `https://via.placeholder.com/320x280/667eea/ffffff?text=Domain+${domain.tokenId}`;

  return (
    <div className={`nft-card ${hasRoyalty ? 'has-royalty' : ''}`}>
      <div className="nft-card-image">
        <img
          src={imageSrc}
          alt={metadata?.name || `Domain #${domain.tokenId || 'Unknown'}`}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/320x280/667eea/ffffff?text=Domain+${domain.tokenId}`;
          }}
        />
      </div>

      <div className="nft-card-content">
        <div className="nft-card-header">
          <h3 className="nft-card-title">
            {metadata?.name || `Domain #${domain.tokenId || 'Unknown'}`}
          </h3>
          <span className="creator-badge">
            Creator
          </span>
        </div>

        <NFTMetadataDisplay 
          metadata={metadata} 
          isLoading={metadataLoading}
          fallbackName={`Domain #${domain.tokenId || 'Unknown'}`}
        />

        <div className="nft-info">
          <div className="info-row">
            <span className="label">Creator:</span>
            <span className="value">
              {formatAddress(domain.creator)}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Last Sale:</span>
            <span className="value price">
              {domain.lastPrice === "0" ? "No sales yet" : `${ethers.formatEther(domain.lastPrice)} MATIC`}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Minted:</span>
            <span className="value">
              {new Date(domain.mintTimestamp * 1000).toLocaleDateString()}
            </span>
          </div>
          {domain.royaltyBalance && (
            <div className="info-row royalty-row">
              <span className="label">Royalty Balance:</span>
              <span className="value price royalty-balance">
                {domain.royaltyBalance} MATIC
              </span>
            </div>
          )}
        </div>

        <div className="nft-card-footer">
          {domain.royaltyBalance && parseFloat(domain.royaltyBalance) > 0 ? (
            <button 
              className="action-button primary"
              onClick={() => handleWithdrawFromSplitter(domain.splitterAddress!)}
              disabled={withdrawing === domain.splitterAddress}
            >
              {withdrawing === domain.splitterAddress ? "Withdrawing..." : "Withdraw Royalties"}
            </button>
          ) : (
            <button className="action-button secondary" disabled>
              Your Creation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Royalties: React.FC = () => {
  const { account } = useWallet();
  const { sdk } = useMarketplaceSDK();
  const { showSuccess, showError } = useToast();
  const [ownedDomains, setOwnedDomains] = useState<FormattedToken[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [loadedDomainsCount, setLoadedDomainsCount] = useState(0);
  const [totalDomainsToLoad, setTotalDomainsToLoad] = useState(0);
  const [marketplaceFees, setMarketplaceFees] = useState<string>("0");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
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

  // Calculate stats for animation - must be called before any early returns
  const getTotalRoyalties = () => {
    return ownedDomains.reduce((sum, domain) => {
      return sum + (domain.royaltyBalance ? parseFloat(domain.royaltyBalance) : 0);
    }, 0);
  };
  
  const totalRoyalties = getTotalRoyalties();
  const marketplaceFeesNum = parseFloat(marketplaceFees) || 0;

  const loadBalances = useCallback(async () => {
    if (!sdk || !account) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Loading marketplace fees...");
      
      // Load marketplace fees
      try {
        const fees = await sdk.getMarketplaceFees();
        if (fees) {
          setMarketplaceFees(ethers.formatEther(fees));
        }
      } catch (feeError) {
        console.warn("Could not fetch marketplace fees:", feeError);
        setMarketplaceFees("0");
      }

      console.log("Marketplace fees loaded successfully");
    } catch (err: any) {
      console.error("Error loading balances:", err);
      setMarketplaceFees("0");
    } finally {
      setIsLoading(false);
    }
  }, [sdk, account]);

  const checkAdmin = useCallback(async () => {
    if (!sdk) return;
    try {
      const admin = await sdk.isAdmin();
      setIsAdmin(admin);
    } catch (err) {
      console.error("Error checking admin status:", err);
    }
  }, [sdk]);


  const loadOwnedDomains = useCallback(async () => {
    if (!sdk || !account) return;

    setIsLoadingDomains(true);
    setError(null);
    setOwnedDomains([]);
    setLoadedDomainsCount(0);
    setTotalDomainsToLoad(0);

    try {
      console.log("Loading created domains (where user is creator) using subgraph...");
      const startTime = Date.now();

      // Use subgraph to get created tokens directly (includes splitter data and balances)
      const createdDomains = await sdk.getCreatedTokens(account);
      
      setTotalDomainsToLoad(createdDomains.length);
      console.log(`Found ${createdDomains.length} domains created by you via subgraph`);

      if (createdDomains.length === 0) {
        setIsLoadingDomains(false);
        setIsDataReady(true);
        return;
      }

      // The subgraph already includes splitter addresses and balances, so we can use them directly
      // Sort domains to show those with royalties first, then by royalty amount (highest first)
      const sortedDomains = createdDomains.sort((a, b) => {
        const aHasRoyalty = a.royaltyBalance && parseFloat(a.royaltyBalance) > 0;
        const bHasRoyalty = b.royaltyBalance && parseFloat(b.royaltyBalance) > 0;
        
        // First priority: domains with royalties come first
        if (aHasRoyalty && !bHasRoyalty) return -1;
        if (!aHasRoyalty && bHasRoyalty) return 1;
        
        // Second priority: within royalty group, sort by amount (highest first)
        if (aHasRoyalty && bHasRoyalty) {
          const aAmount = parseFloat(a.royaltyBalance!);
          const bAmount = parseFloat(b.royaltyBalance!);
          return bAmount - aAmount; // Higher amounts first
        }
        
        return 0; // Keep original order for domains without royalties
      });
      
      setOwnedDomains(sortedDomains);
      setLoadedDomainsCount(sortedDomains.length);

      const endTime = Date.now();
      console.log(`Loaded ${sortedDomains.length} created domains in ${endTime - startTime}ms`);
      console.log(`Domains with royalties: ${sortedDomains.filter(d => d.royaltyBalance && parseFloat(d.royaltyBalance) > 0).length}`);
      
      // Add a small delay to ensure all state updates are complete before showing cards
      // This prevents flickering and weird loading states
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsDataReady(true);
    } catch (err: any) {
      console.error("Error loading created domains:", err);
      setError(`Failed to load created domains: ${err.message || 'Unknown error'}`);
      setOwnedDomains([]);
      setIsDataReady(true);
    } finally {
      setIsLoadingDomains(false);
    }
  }, [sdk, account]);

  // Load initial data
  useEffect(() => {
    if (sdk && account) {
      setIsDataReady(false); // Reset data ready state when loading starts
      loadBalances();
      loadOwnedDomains();
      checkAdmin();
    } else {
      setIsDataReady(false);
    }
  }, [sdk, account, loadBalances, loadOwnedDomains, checkAdmin]);

  const handleWithdrawFromSplitter = async (splitterAddress: string) => {
    if (!sdk) return;

    // Find the domain that has this splitter address
    const domain = ownedDomains.find(d => d.splitterAddress === splitterAddress);
    if (!domain) return;

    const tokenURI = getTokenURI(domain) || domain.uri;
    const domainName = await getDomainNameFromURI(tokenURI, domain.tokenId);

    setConfirmModal({
      isOpen: true,
      title: "Withdraw Royalties",
      message: `Withdraw your royalties from ${domainName}?\n\nThis will withdraw all pending royalties from the splitter contract.`,
      domainName: domainName,
      type: "default",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setWithdrawing(splitterAddress);
        setIsAwaitingSignature(true);
        setTxStatus('signature');

        try {
          const submittingTimeout = setTimeout(() => {
            setTxStatus('submitting');
          }, 1000);
          
          const confirmingTimeout = setTimeout(() => {
            setTxStatus('confirming');
          }, 3000);
          
          const result = await sdk.withdrawRoyaltyFromSplitter(splitterAddress);
          
          clearTimeout(submittingTimeout);
          clearTimeout(confirmingTimeout);
          
          setIsAwaitingSignature(false);
          setTxStatus(null);

          if (result) {
            showSuccess(
              "Withdrawal Successful! ✅",
              `Withdrawn ${result.withdrawn} MATIC from ${domainName}`,
              result.transactionHash
            );
            // Refresh created domains
            await loadOwnedDomains();
          } else {
            showError("Withdrawal Failed", "Withdrawal failed. Please try again.");
          }
        } catch (err: any) {
          console.error("Error withdrawing:", err);
          setIsAwaitingSignature(false);
          setTxStatus(null);
          showError("Withdrawal Error", err.message || "Failed to withdraw");
        } finally {
          setWithdrawing(null);
        }
      },
    });
  };


  const handleWithdrawMarketplaceFees = async () => {
    if (!sdk) return;

    setConfirmModal({
      isOpen: true,
      title: "Withdraw Marketplace Fees",
      message: `Withdraw marketplace fees?\nAmount: ${marketplaceFees} MATIC`,
      type: "default",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setWithdrawing("marketplace");
        setIsAwaitingSignature(true);
        setTxStatus('signature');

        try {
          const submittingTimeout = setTimeout(() => {
            setTxStatus('submitting');
          }, 1000);
          
          const confirmingTimeout = setTimeout(() => {
            setTxStatus('confirming');
          }, 3000);
          
          const txHash = await sdk.withdrawMarketPlaceFees();
          
          clearTimeout(submittingTimeout);
          clearTimeout(confirmingTimeout);
          
          setIsAwaitingSignature(false);
          setTxStatus(null);

          if (txHash) {
            showSuccess(
              "Marketplace Fees Withdrawn! ✅",
              `Successfully withdrew marketplace fees`,
              txHash
            );
            await loadBalances();
          } else {
            showError(
              "Withdrawal Failed", 
              "Withdrawal failed. Make sure you are an admin and there are fees to withdraw."
            );
          }
        } catch (err: any) {
          console.error("Error withdrawing marketplace fees:", err);
          setIsAwaitingSignature(false);
          setTxStatus(null);
          showError("Withdrawal Error", err.message || "Failed to withdraw marketplace fees");
        } finally {
          setWithdrawing(null);
        }
      },
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!account) {
    return (
      <div className="royalties">
        <div className="connect-prompt">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to view your royalties</p>
        </div>
      </div>
    );
  }

  return (
    <div className="royalties">
      <div className="royalties-container">
        <div className="page-header">
          <h1>Royalties & Fees</h1>
          <p>Manage your earnings from the marketplace</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Summary Cards - Show only when not awaiting signature */}
        {!isAwaitingSignature && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-icon">💰</div>
            <div className="card-content">
              <span className="card-label">Total Royalties</span>
              <span className="card-value">
                {totalRoyalties.toFixed(2)} MATIC
              </span>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon">🎨</div>
            <div className="card-content">
              <span className="card-label">Created Domains</span>
              <span className="card-value">
                {ownedDomains.length}
                {ownedDomains.length > 0 && (
                  <small style={{ display: 'block', fontSize: '12px', color: '#666' }}>
                    {ownedDomains.filter(d => d.royaltyBalance && parseFloat(d.royaltyBalance) > 0).length} with royalties
                  </small>
                )}
              </span>
            </div>
          </div>


          {isAdmin && (
            <div className="summary-card admin">
              <div className="card-icon">⚙️</div>
              <div className="card-content">
                <span className="card-label">Marketplace Fees</span>
                <span className="card-value">
                  {marketplaceFeesNum.toFixed(2)} MATIC
                </span>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Show loading overlay when awaiting signature OR loading domains OR data not ready */}
        {isAwaitingSignature || isLoadingDomains || !isDataReady ? (
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
        ) : (
          <>
            {/* Created Domains Section - Always show section, stats update as data loads */}
            <div className="domains-section">
              <div className="section-header">
                <div className="section-title-group">
                  <h2 className="section-title">Your Created Domains</h2>
                  {ownedDomains.length > 0 && (
                    <div className="section-stats">
                      <span className="stat-item">
                        {ownedDomains.length} Total
                      </span>
                      <span className="stat-item highlight">
                        {ownedDomains.filter(d => d.royaltyBalance && parseFloat(d.royaltyBalance) > 0).length} With Royalties
                      </span>
                      <span className="stat-item">
                        {ownedDomains.filter(d => !d.royaltyBalance || parseFloat(d.royaltyBalance || '0') === 0).length} No Royalties
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="section-description">
                These are the domains you created and will receive royalties from when they are sold. 
                Royalties are shown directly on each domain card with individual withdrawal buttons.
              </p>
              {ownedDomains.length > 0 ? (
                <div className="nft-grid">
                  {ownedDomains.map((domain, index) => {
                    const hasRoyalty = !!(domain.royaltyBalance && parseFloat(domain.royaltyBalance) > 0);
                    const isFirstWithoutRoyalty = !hasRoyalty && index > 0 && 
                      ownedDomains[index - 1].royaltyBalance && 
                      parseFloat(ownedDomains[index - 1].royaltyBalance!) > 0;
                    
                    return (
                      <React.Fragment key={domain.tokenId}>
                        {isFirstWithoutRoyalty && (
                          <div className="royalty-divider">
                            <span className="divider-text">Domains without royalties</span>
                          </div>
                        )}
                        <RoyaltyDomainCard
                          key={domain.tokenId}
                          domain={domain}
                          hasRoyalty={hasRoyalty}
                          withdrawing={withdrawing}
                          handleWithdrawFromSplitter={handleWithdrawFromSplitter}
                          formatAddress={formatAddress}
                        />
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No created domains found. Create some domains to start earning royalties!</p>
                </div>
              )}
            </div>

            {/* Marketplace Owner Section */}
            {isAdmin && (
          <section className="royalties-section admin-section">
            <div className="section-header">
              <h2 className="section-title">Marketplace Fees (Admin Only)</h2>
            </div>

            <div className="admin-card">
              <div className="admin-info">
                <div className="info-item">
                  <span className="label">Accumulated Fees:</span>
                  <span className="value price">
                    {parseFloat(marketplaceFees).toFixed(2)} MATIC
                  </span>
                </div>
                <p className="info-text">
                  As the marketplace owner, you can withdraw accumulated
                  platform fees.
                </p>
              </div>
              <button
                className="action-button primary large"
                onClick={handleWithdrawMarketplaceFees}
                disabled={
                  withdrawing === "marketplace" ||
                  parseFloat(marketplaceFees) === 0
                }
              >
                {withdrawing === "marketplace"
                  ? "Withdrawing..."
                  : "Withdraw Marketplace Fees"}
              </button>
            </div>
          </section>
        )}

            <div className="info-box">
              <h3>ℹ️ About Royalties</h3>
              <ul>
                <li>
                  <strong>Creator Royalties:</strong> Earned when domains you
                  created are resold
                </li>
                <li>
                  <strong>Minter Royalties:</strong> Earned from NFTs you minted
                </li>
                <li>
                  <strong>Splitter Contracts:</strong> Automatically distribute
                  royalties to creators and minters
                </li>
                {isAdmin && (
                  <li>
                    <strong>Marketplace Fees:</strong> Platform fees from all sales
                    (admin only)
                  </li>
                )}
              </ul>
            </div>
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

export default Royalties;
