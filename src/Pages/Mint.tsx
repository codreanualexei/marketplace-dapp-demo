import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { useToast } from "../contexts/ToastContext";
import { applyMintedUpdate } from "../utils/optimisticUpdates";
import {
  storePendingUpdate,
  removePendingUpdate,
} from "../utils/persistentOptimisticUpdates";
import "./Mint.css";

const Mint: React.FC = () => {
  const { account } = useWallet();
  const { sdk } = useMarketplaceSDK();
  const { showSuccess, showError } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const [recipient, setRecipient] = useState("");
  const [tokenURI, setTokenURI] = useState("");
  const [domainName, setDomainName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const checkAdminStatus = useCallback(async () => {
    if (!sdk) return;

    setIsLoading(true);
    try {
      const admin = await sdk.isAdmin();
      setIsAdmin(admin);
    } catch (err) {
      console.error("Error checking admin status:", err);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    if (sdk && account) {
      checkAdminStatus();
      setRecipient(account); // Default to own address
    }
  }, [sdk, account, checkAdminStatus]);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sdk || !recipient || !tokenURI || !domainName) {
      showError("Missing Information", "Please fill in all fields");
      return;
    }

    setIsMinting(true);
    setError(null);
    setSuccess(null);

    try {
      // Use new method that returns receipt and parsed events
      const { txHash, mintedEvent, transfers } = await (sdk as any).mintDomainWithReceipt(recipient, tokenURI, domainName);

      if (txHash && mintedEvent) {
        // OPTIMISTIC UPDATE: If minted to current user, we could update their domain list
        // But since this is an admin page, we don't need to update UI here
        // The minted NFT will appear in MyDomains page after subgraph sync
        console.log("✅ Optimistic Update: Domain minted!", { txHash, tokenId: mintedEvent.tokenId, to: mintedEvent.to });
        
        // Store pending update (for MyDomains page to pick up)
        console.log('💾 [PERSISTENT UPDATE] Storing mint update for persistence...');
        storePendingUpdate({
          type: 'mint',
          txHash,
          data: {
            tokenId: mintedEvent.tokenId,
            to: mintedEvent.to,
          },
        });
        
        // Clean up after a delay (mint updates are handled in MyDomains)
        setTimeout(() => {
          console.log(`🗑️ [PERSISTENT UPDATE] Removing mint update after delay: ${txHash}`);
          removePendingUpdate(txHash);
        }, 60000); // 60 seconds - give more time for subgraph
        
        // Show success message immediately
        showSuccess(
          "NFT Minted Successfully! 🎉",
          `New domain NFT has been minted to ${recipient}`,
          txHash
        );
        // Clear form
        setTokenURI("");
        setDomainName("");
        // Keep recipient filled
      } else if (txHash) {
        // Transaction succeeded but couldn't parse event - fallback
        console.warn("Mint succeeded but couldn't parse event");
        showSuccess(
          "NFT Minted Successfully! 🎉",
          `New domain NFT has been minted to ${recipient}`,
          txHash
        );
        // Clear form
        setTokenURI("");
        setDomainName("");
      } else {
        showError("Mint Failed", "Failed to mint NFT. Make sure you have MINTER_ROLE.");
      }
    } catch (err: any) {
      console.error("Error minting:", err);
      showError("Mint Error", err.message || "Failed to mint NFT");
    } finally {
      setIsMinting(false);
    }
  };

  if (!account) {
    return (
      <div className="mint">
        <div className="connect-prompt">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to mint NFTs</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mint">
        <div className="loading">
          <div className="spinner"></div>
          <p>Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mint">
        <div className="no-access">
          <h2>⚠️ Admin Access Required</h2>
          <p>You need MINTER_ROLE to mint NFTs.</p>
          <p className="address">Your address: {account}</p>
          <div className="info-box">
            <h3>How to get minting access:</h3>
            <ol>
              <li>Contact the contract owner</li>
              <li>Request MINTER_ROLE for your address</li>
              <li>Or connect with an admin wallet</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mint">
      <div className="mint-container">
        <div className="page-header">
          <h1>Mint Domain NFT</h1>
          <p>Create new domain NFTs (Admin Only)</p>
        </div>

        <div className="mint-card">
          <form onSubmit={handleMint}>
            <div className="form-group">
              <label htmlFor="recipient">Recipient Address</label>
              <input
                id="recipient"
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                required
              />
              <small>The address that will receive the NFT (creator)</small>
            </div>

            <div className="form-group">
              <label htmlFor="tokenURI">Token URI</label>
              <input
                id="tokenURI"
                type="text"
                value={tokenURI}
                onChange={(e) => setTokenURI(e.target.value)}
                placeholder="ipfs://... or https://..."
                required
              />
              <small>Metadata URI (IPFS or HTTP link to JSON metadata)</small>
            </div>

            <div className="form-group">
              <label htmlFor="domainName">Domain Name</label>
              <input
                id="domainName"
                type="text"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                placeholder="example.domain"
                required
              />
              <small>The domain name for this NFT (e.g., "example.domain")</small>
            </div>

            {error && <div className="alert error">{error}</div>}

            {success && <div className="alert success">{success}</div>}

            <button
              type="submit"
              className="mint-button"
              disabled={isMinting || !recipient || !tokenURI || !domainName}
            >
              {isMinting ? "Minting..." : "Mint NFT"}
            </button>
          </form>

          <div className="mint-info">
            <h3>ℹ️ What happens when you mint:</h3>
            <ul>
              <li>✅ NFT is minted to the recipient address</li>
              <li>✅ Royalty splitter is automatically created</li>
              <li>
                ✅ Creator gets 40% of future royalties (2% of sale price)
              </li>
              <li>
                ✅ Treasury gets 60% of future royalties (3% of sale price)
              </li>
              <li>✅ Total royalty: 5% of sale price</li>
            </ul>
          </div>

          <div className="example-uri">
            <h4>Example Token URI:</h4>
            <code>ipfs://QmYourHashHere/metadata.json</code>
            <p>Or use a test URI:</p>
            <code>https://example.com/nft/1.json</code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mint;
