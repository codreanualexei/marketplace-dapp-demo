import React, { useState, useEffect } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useMarketplaceSDK } from "../hooks/useMarketplaceSDK";
import { SplitterBalance } from "../sdk/MarketplaceSDK";
import { ethers } from "ethers";
import "./Royalties.css";

const Royalties: React.FC = () => {
  const { account } = useWallet();
  const sdk = useMarketplaceSDK();
  const [splitterBalances, setSplitterBalances] = useState<SplitterBalance[]>(
    [],
  );
  const [marketplaceFees, setMarketplaceFees] = useState<string>("0");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    if (sdk && account) {
      loadBalances();
      checkAdmin();
    }
  }, [sdk, account]);

  const loadBalances = async () => {
    if (!sdk || !account) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load marketplace fees first (quick)
      try {
        const fees = await sdk.getMarketplaceFees();
        if (fees) {
          setMarketplaceFees(ethers.formatEther(fees));
        }
      } catch (feeError) {
        console.warn("Could not fetch marketplace fees:", feeError);
        setMarketplaceFees("0");
      }

      // Skip splitter balances for now to avoid RPC rate limiting
      // User can manually check if needed
      console.log(
        "Skipping automatic splitter balance check (can cause RPC errors)",
      );
      setSplitterBalances([]);
    } catch (err: any) {
      console.error("Error loading balances:", err);
      setSplitterBalances([]);
      setMarketplaceFees("0");
    } finally {
      setIsLoading(false);
    }
  };

  const checkAdmin = async () => {
    if (!sdk) return;
    try {
      const admin = await sdk.isAdmin();
      setIsAdmin(admin);
    } catch (err) {
      console.error("Error checking admin status:", err);
    }
  };

  const handleWithdrawFromSplitter = async (splitterAddress: string) => {
    if (!sdk) return;

    const confirmed = window.confirm(
      `Withdraw your royalties from this splitter?`,
    );

    if (!confirmed) return;

    setWithdrawing(splitterAddress);

    try {
      const result = await sdk.withdrawRoyaltyFromSplitter(splitterAddress);

      if (result) {
        alert(
          `Withdrawal successful! Transaction: ${result.transactionHash}\nAmount: ${result.withdrawn} MATIC`,
        );
        await loadBalances();
      } else {
        alert("Withdrawal failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Error withdrawing:", err);
      alert(`Error: ${err.message || "Failed to withdraw"}`);
    } finally {
      setWithdrawing(null);
    }
  };

  const handleWithdrawAll = async () => {
    if (!sdk) return;

    const totalAmount = splitterBalances.reduce(
      (sum, b) => sum + parseFloat(b.balance),
      0,
    );

    const confirmed = window.confirm(
      `Withdraw all royalties from ${splitterBalances.length} splitter(s)?\nTotal: ${totalAmount.toFixed(4)} MATIC`,
    );

    if (!confirmed) return;

    setWithdrawing("all");

    try {
      const results = await sdk.withdrawAllRoyaltyFees();

      if (results && results.length > 0) {
        const totalWithdrawn = results.reduce(
          (sum, r) => sum + parseFloat(r.withdrawn),
          0,
        );
        alert(
          `Successfully withdrew from ${results.length} splitter(s)!\nTotal: ${totalWithdrawn.toFixed(4)} MATIC`,
        );
        await loadBalances();
      } else {
        alert("No funds to withdraw or withdrawal failed.");
      }
    } catch (err: any) {
      console.error("Error withdrawing all:", err);
      alert(`Error: ${err.message || "Failed to withdraw"}`);
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
        alert(
          `Marketplace fees withdrawn successfully! Transaction: ${txHash}`,
        );
        await loadBalances();
      } else {
        alert(
          "Withdrawal failed. Make sure you are an admin and there are fees to withdraw.",
        );
      }
    } catch (err: any) {
      console.error("Error withdrawing marketplace fees:", err);
      alert(`Error: ${err.message || "Failed to withdraw marketplace fees"}`);
    } finally {
      setWithdrawing(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTotalRoyalties = () => {
    return splitterBalances.reduce((sum, b) => sum + parseFloat(b.balance), 0);
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

  if (isLoading && splitterBalances.length === 0) {
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
            <div className="card-icon">📊</div>
            <div className="card-content">
              <span className="card-label">Splitter Contracts</span>
              <span className="card-value">{splitterBalances.length}</span>
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

        {/* Creator/Minter Royalties */}
        <section className="royalties-section">
          <div className="section-header">
            <h2 className="section-title">Your Royalties (Creator/Minter)</h2>
            <button
              className="action-button secondary"
              onClick={async () => {
                if (!sdk || !account) return;
                setIsLoading(true);
                try {
                  const balances =
                    await sdk.getSplitterBalanceOfWallet(account);
                  setSplitterBalances(balances || []);
                } catch (err) {
                  console.error("Error loading splitters:", err);
                  alert(
                    "Error loading royalties. The collection might be empty or RPC is rate limiting.",
                  );
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Check Royalty Balances"}
            </button>
            {splitterBalances.length > 0 && getTotalRoyalties() > 0 && (
              <button
                className="action-button primary"
                onClick={handleWithdrawAll}
                disabled={withdrawing !== null}
              >
                {withdrawing === "all" ? "Withdrawing All..." : "Withdraw All"}
              </button>
            )}
          </div>

          {splitterBalances.length === 0 ? (
            <div className="empty-state">
              <h3>Click "Check Royalty Balances" to scan</h3>
              <p>This will scan the collection for your royalty earnings</p>
              <small
                style={{ color: "#999", marginTop: "8px", display: "block" }}
              >
                Note: May take time if collection is large
              </small>
            </div>
          ) : (
            <div className="royalty-list">
              {splitterBalances.map((balance, index) => (
                <div key={balance.splitter} className="royalty-item">
                  <div className="royalty-info">
                    <div className="info-row">
                      <span className="label">Splitter Contract:</span>
                      <span className="value">
                        {formatAddress(balance.splitter)}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">Available Balance:</span>
                      <span className="value price">
                        {balance.balance} MATIC
                      </span>
                    </div>
                  </div>
                  <button
                    className="action-button secondary"
                    onClick={() => handleWithdrawFromSplitter(balance.splitter)}
                    disabled={withdrawing === balance.splitter}
                  >
                    {withdrawing === balance.splitter
                      ? "Withdrawing..."
                      : "Withdraw"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

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
