import { useState, useEffect, useMemo } from "react";
import { useWallet } from "../contexts/WalletContext";
import { MarketplaceSDK } from "../sdk/MarketplaceSDK";
import {
  MARKETPLACE_ADDRESS,
  NFT_COLLECTION_ADDRESS,
} from "../config/constants";

export const useMarketplaceSDK = () => {
  const { provider, signer, account } = useWallet();
  const [sdk, setSdk] = useState<MarketplaceSDK | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get Alchemy API key from environment
  const alchemyApiKey = process.env.REACT_APP_ALCHEMY_API_KEY;

  // Initialize SDK when wallet connects
  useEffect(() => {
    const initializeSDK = async () => {
      if (!provider || !signer || !account || !alchemyApiKey) {
        setSdk(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("Initializing Alchemy Marketplace SDK...");
        
            const newSdk = new MarketplaceSDK(
          signer,
          MARKETPLACE_ADDRESS,
          NFT_COLLECTION_ADDRESS,
          alchemyApiKey,
          process.env.NODE_ENV === "development"
        );

        setSdk(newSdk);
        console.log("Alchemy Marketplace SDK initialized successfully");
      } catch (err: any) {
        console.error("Failed to initialize Alchemy Marketplace SDK:", err);
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
    isReady: !!sdk && !!account && !error,
  }), [sdk, isLoading, error, account]);

  return sdkState;
};
