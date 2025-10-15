import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { MarketplaceSDK } from '../sdk/MarketplaceSDK';

// CRA exposes only env vars prefixed with REACT_APP_
const MARKETPLACE_ADDRESS = process.env.REACT_APP_MARKETPLACE_ADDRESS || '';
// Support both naming variants found in env/example
const NFT_ADDRESS =
  process.env.REACT_APP_STR_DOMAIN_NFT_COLLECTION ||
  process.env.REACT_APP_NFT_COLLECTION_ADDRESS ||
  '';
const IS_DEV = process.env.NODE_ENV === 'development';



/**
 * Custom hook to access the Marketplace SDK
 * Returns null if wallet is not connected
 */
export const useMarketplaceSDK = (): MarketplaceSDK | null => {
  const { signer } = useWallet();

  const sdk = useMemo(() => {
    if (!MARKETPLACE_ADDRESS || !NFT_ADDRESS) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'Missing marketplace/NFT env addresses',
          {
            REACT_APP_MARKETPLACE_ADDRESS: process.env.REACT_APP_MARKETPLACE_ADDRESS,
            REACT_APP_STR_DOMAIN_NFT_COLLECTION: process.env.REACT_APP_STR_DOMAIN_NFT_COLLECTION,
            REACT_APP_NFT_COLLECTION_ADDRESS: process.env.REACT_APP_NFT_COLLECTION_ADDRESS,
          }
        );
      }
      return null;
    }

    try {
      if (signer) {
        return new MarketplaceSDK(signer, MARKETPLACE_ADDRESS, NFT_ADDRESS, IS_DEV);
      }

      // Read-only fallback using RPC URL if available
      const rpcUrl = process.env.REACT_APP_RPC_URL;
      if (rpcUrl) {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        // Create a dummy wallet connected to provider; avoids provider.getSigner() which throws on public RPC
        const readOnlySigner = ethers.Wallet.createRandom().connect(provider);
        return new MarketplaceSDK(readOnlySigner, MARKETPLACE_ADDRESS, NFT_ADDRESS, IS_DEV);
      }

      return null;
    } catch (error) {
      console.error('Error creating Marketplace SDK:', error);
      return null;
    }
  }, [signer]);

  return sdk;
};

export default useMarketplaceSDK;

