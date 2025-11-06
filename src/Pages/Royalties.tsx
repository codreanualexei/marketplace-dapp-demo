import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { useToast } from "../contexts/ToastContext";
import { SplitterBalance, FormattedToken } from "../sdk/MarketplaceSDK";
import { ethers } from "ethers";
import { useNFTMetadata, getTokenURI } from "../hooks/useNFTMetadata";
import { NFTMetadataDisplay } from "../Components/NFTMetadata";
import "./Royalties.css";

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
  const [loadedDomainsCount, setLoadedDomainsCount] = useState(0);
  const [totalDomainsToLoad, setTotalDomainsToLoad] = useState(0);
  const [marketplaceFees, setMarketplaceFees] = useState<string>("0");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

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
      console.log("Loading created domains (where user is creator)...");
      const startTime = Date.now();

      // First, get all domains from collection to find created ones
      const allDomains = await sdk.getAllStrDomainsFromCollection();
      const myAddress = account; // Use account from WalletContext
      
      // Filter domains where user is the creator
      const createdDomains = allDomains.filter(domain => 
        domain.creator.toLowerCase() === myAddress.toLowerCase()
      );

      setTotalDomainsToLoad(createdDomains.length);
      console.log(`Found ${createdDomains.length} domains created by you`);

      if (createdDomains.length === 0) {
        setIsLoadingDomains(false);
        return;
      }

      // Load domains one by one with visual effect
      const loadedDomains: FormattedToken[] = [];
      
      for (let i = 0; i < createdDomains.length; i++) {
        const domain = createdDomains[i];
        
        try {
          // Get enhanced token data with image
          const enhancedData = await sdk.getTokenData(domain.tokenId);
          let enhancedDomain: FormattedToken;
          
          if (enhancedData) {
            enhancedDomain = {
              ...domain,
              image: enhancedData.image,
              metadata: enhancedData.metadata
            };
          } else {
            enhancedDomain = domain;
          }
          
          // Try to get royalty balance for this specific domain
          try {
            const royaltyInfo = await sdk.getRoyaltyInfo(domain.tokenId, BigInt(40000000));
            if (royaltyInfo && royaltyInfo[0] !== "0x0000000000000000000000000000000000000000") {
              // This domain has a splitter contract
              enhancedDomain.splitterAddress = royaltyInfo[0];
            }
          } catch (royaltyError) {
            console.warn(`Could not get royalty info for domain ${domain.tokenId}:`, royaltyError);
          }
          
          loadedDomains.push(enhancedDomain);
          setLoadedDomainsCount(i + 1);
          setOwnedDomains([...loadedDomains]);
          
          // Small delay for visual effect
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.warn(`Failed to enhance domain ${domain.tokenId} with metadata:`, error);
          loadedDomains.push(domain);
          setLoadedDomainsCount(i + 1);
          setOwnedDomains([...loadedDomains]);
        }
      }

      // Now get splitter balances for domains that have splitter addresses
      const domainsWithSplitters = loadedDomains.filter(d => d.splitterAddress);
      if (domainsWithSplitters.length > 0) {
        console.log(`Getting splitter balances for ${domainsWithSplitters.length} domains using Alchemy...`);
        try {
          const splitterBalances = await sdk.getSplitterBalanceOfWallet(account);
          console.log(`Found ${splitterBalances.length} splitter balances from Alchemy`);
          
          // Match splitter balances to domains
          const updatedDomains = loadedDomains.map(domain => {
            if (domain.splitterAddress) {
              const balance = splitterBalances.find(b => b.splitter === domain.splitterAddress);
              if (balance && parseFloat(balance.balance) > 0) {
                return {
                  ...domain,
                  royaltyBalance: balance.balance
                };
              }
            }
            return domain;
          });
          
          // Sort domains to show those with royalties first, then by royalty amount (highest first)
          const sortedDomains = updatedDomains.sort((a, b) => {
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
        } catch (balanceError) {
          console.warn("Could not fetch splitter balances from Alchemy:", balanceError);
        }
      }

      const endTime = Date.now();
      console.log(`Loaded ${loadedDomains.length} created domains in ${endTime - startTime}ms`);
    } catch (err: any) {
      console.error("Error loading created domains:", err);
      setError("Failed to load created domains. Please try again.");
      setOwnedDomains([]);
    } finally {
      setIsLoadingDomains(false);
    }
  }, [sdk, account]);

  // Load initial data
  useEffect(() => {
    if (sdk && account) {
      loadBalances();
      loadOwnedDomains();
      checkAdmin();
    }
  }, [sdk, account, loadBalances, loadOwnedDomains, checkAdmin]);

  const handleWithdrawFromSplitter = async (splitterAddress: string) => {
    if (!sdk) return;

    // Find the domain that has this splitter address
    const domain = ownedDomains.find(d => d.splitterAddress === splitterAddress);
    const domainInfo = domain ? `Domain #${domain.tokenId}` : 'this domain';

    const confirmed = window.confirm(
      `Withdraw your royalties from ${domainInfo}?\n\nThis will withdraw all pending royalties from the splitter contract.`,
    );

    if (!confirmed) return;

    setWithdrawing(splitterAddress);

    try {
      const result = await sdk.withdrawRoyaltyFromSplitter(splitterAddress);

      if (result) {
        showSuccess(
          "Withdrawal Successful! ✅",
          `Withdrawn ${result.withdrawn} MATIC from ${domainInfo}`,
          result.transactionHash
        );
        // Refresh created domains
        await loadOwnedDomains();
      } else {
        showError("Withdrawal Failed", "Withdrawal failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Error withdrawing:", err);
      showError("Withdrawal Error", err.message || "Failed to withdraw");
    } finally {
      setWithdrawing(null);
    }
  };


  const handleWithdrawMarketplaceFees = async () => {
    if (!sdk) return;

    const confirmed = window.confirm(
      `Withdraw marketplace fees?\nAmount: ${marketplaceFees} MATIC`,
    );

    if (!confirmed) return;

    setWithdrawing("marketplace");

    try {
      const txHash = await sdk.withdrawMarketPlaceFees();

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
      showError("Withdrawal Error", err.message || "Failed to withdraw marketplace fees");
    } finally {
      setWithdrawing(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTotalRoyalties = () => {
    return ownedDomains.reduce((sum, domain) => {
      return sum + (domain.royaltyBalance ? parseFloat(domain.royaltyBalance) : 0);
    }, 0);
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

  if (isLoading) {
    return (
      <div className="royalties">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading balances...</p>
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

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-icon">💰</div>
            <div className="card-content">
              <span className="card-label">Total Royalties</span>
              <span className="card-value">
                {getTotalRoyalties().toFixed(4)} MATIC
              </span>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon">🎨</div>
            <div className="card-content">
              <span className="card-label">Created Domains</span>
              <span className="card-value">
                {isLoadingDomains ? `${loadedDomainsCount}/${totalDomainsToLoad}` : ownedDomains.length}
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
                  {parseFloat(marketplaceFees).toFixed(4)} MATIC
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Created Domains Section */}
        {(ownedDomains.length > 0 || isLoadingDomains) && (
          <div className="domains-section">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-title">Your Created Domains</h2>
                <div className="section-stats">
                  <span className="stat-item">
                    {isLoadingDomains ? `${loadedDomainsCount}/${totalDomainsToLoad}` : ownedDomains.length} Total
                  </span>
                  {ownedDomains.length > 0 && (
                    <>
                      <span className="stat-item highlight">
                        {ownedDomains.filter(d => d.royaltyBalance && parseFloat(d.royaltyBalance) > 0).length} With Royalties
                      </span>
                      <span className="stat-item">
                        {ownedDomains.filter(d => !d.royaltyBalance || parseFloat(d.royaltyBalance || '0') === 0).length} No Royalties
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <p className="section-description">
              These are the domains you created and will receive royalties from when they are sold. 
              Royalties are shown directly on each domain card with individual withdrawal buttons.
            </p>
            <div className="nft-grid">
              {/* Show loaded domains */}
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

              {/* Show loading card when loading - positioned after loaded domains */}
              {isLoadingDomains && (
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
          </div>
        )}


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
                    {parseFloat(marketplaceFees).toFixed(4)} MATIC
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
      </div>
    </div>
  );
};

export default Royalties;
