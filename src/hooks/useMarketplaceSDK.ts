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
  const { signer, provider, account, walletType } = useWallet();

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
      // Only create SDK if we have a valid signer and account
      if (signer && account && provider) {
        console.log('Creating Marketplace SDK with:', {
          walletType,
          account,
          hasSigner: !!signer,
          hasProvider: !!provider
        });
        return new MarketplaceSDK(signer, MARKETPLACE_ADDRESS, NFT_ADDRESS, IS_DEV);
      }

      // Read-only fallback using RPC URL if available (for when wallet is not connected)
      const rpcUrl = process.env.REACT_APP_RPC_URL;
      if (rpcUrl) {
        console.log('Creating read-only Marketplace SDK with RPC provider');
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        // Create a dummy wallet connected to provider; avoids provider.getSigner() which throws on public RPC
        const readOnlySigner = ethers.Wallet.createRandom().connect(provider);
        const sdk = new MarketplaceSDK(readOnlySigner, MARKETPLACE_ADDRESS, NFT_ADDRESS, IS_DEV);
        // Disable develop mode for read-only SDK to reduce console spam
        sdk.setDevelopMode(false);
        return sdk;
      }

      console.log('No valid signer or RPC URL available for Marketplace SDK');
      return null;
    } catch (error) {
      console.error('Error creating Marketplace SDK:', error);
      return null;
    }
  }, [signer, provider, account, walletType]);

  return sdk;
};

export default useMarketplaceSDK;

