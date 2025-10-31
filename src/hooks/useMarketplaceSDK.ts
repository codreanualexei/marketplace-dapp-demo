import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { useWallet } from "../contexts/WalletContext";
import { MarketplaceSDK } from "../sdk/MarketplaceSDK";
import {
  MARKETPLACE_ADDRESS,
  NFT_COLLECTION_ADDRESS,
} from "../config/constants";
import { NETWORK_CONFIG } from "../config/network";

export const useMarketplaceSDK = () => {
  const { provider, signer, account } = useWallet();
  const [sdk, setSdk] = useState<MarketplaceSDK | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get Alchemy API key from environment
  const alchemyApiKey = process.env.REACT_APP_ALCHEMY_API_KEY;

  // Initialize SDK when wallet connects or for read-only browsing
  useEffect(() => {
    const initializeSDK = async () => {
      if (!alchemyApiKey) {
        setSdk(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("Initializing Marketplace SDK...");

        let signerToUse = signer as ethers.Signer | null;

        if (!signerToUse) {
          const rpcUrl = NETWORK_CONFIG.rpcUrl;
          const readOnlyProvider = new ethers.JsonRpcProvider(rpcUrl);
          signerToUse = new ethers.VoidSigner(
            "0x000000000000000000000000000000000000dEaD",
            readOnlyProvider
          );
        }

        const newSdk = new MarketplaceSDK(
          signerToUse,
          MARKETPLACE_ADDRESS,
          NFT_COLLECTION_ADDRESS,
          alchemyApiKey,
          process.env.NODE_ENV === "development"
        );

        setSdk(newSdk);
        console.log("Marketplace SDK initialized successfully");
      } catch (err: any) {
        console.error("Failed to initialize Marketplace SDK:", err);
        setError(err.message || "Failed to initialize SDK");
        setSdk(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSDK();
  }, [provider, signer, account, alchemyApiKey]);

  // Update SDK signer when wallet changes
  useEffect(() => {
    if (sdk && signer) {
      try {
        sdk.updateSigner(signer);
        console.log("Updated SDK signer");
      } catch (err) {
        console.error("Failed to update SDK signer:", err);
      }
    }
  }, [sdk, signer]);

  // Memoized SDK state
  const sdkState = useMemo(() => ({
    sdk,
    isLoading,
    error,
    isReady: !!sdk && !error,
  }), [sdk, isLoading, error]);

  return sdkState;
};
