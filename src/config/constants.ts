/**
 * Application Configuration
 * All environment variables and constants
 */

// Network Configuration - Import from dynamic network config
import { NETWORK_CONFIG as DYNAMIC_NETWORK_CONFIG } from './network';

// Contract Addresses
export const MARKETPLACE_ADDRESS =
  process.env.REACT_APP_MARKETPLACE_ADDRESS ||
  process.env.MARKETPLACE_ADDRESS ||
  "0x75201083D96114982B1b08176C87E2ec3e39dDb1";

export const NFT_COLLECTION_ADDRESS =
  process.env.REACT_APP_STR_DOMAIN_NFT_COLLECTION ||
  process.env.REACT_APP_NFT_COLLECTION_ADDRESS ||
  process.env.STR_DOMAIN_NFT_COLLECTION ||
  process.env.NFT_COLLECTION_ADDRESS ||
  "0x8255d9f7f51AD2B5CC7fBDFc1D9A967bD19EDD6a";

export const SPLITTER_FACTORY_ADDRESS =
  process.env.REACT_APP_SPLITTER_FACTORY_ADDRESS ||
  process.env.SPLITTER_FACTORY_ADDRESS ||
  "0x4C50CEF9c518789CFd0E014d8b1582B2dFE19A3b";

export const SPLITTER_IMPLEMENTATION_ADDRESS =
  process.env.REACT_APP_SPLITTER_IMPLEMENTATION_ADDRESS ||
  process.env.SPLITTER_IMPLEMENTATION_ADDRESS ||
  "0xAAB70f560fee9Be4F03891c30B19A8EeE1eB2E80";

// Treasury Addresses
export const MARKETPLACE_TREASURY =
  process.env.REACT_APP_MARKETPLACE_TREASURY ||
  process.env.MARKETPLACE_TREASURY ||
  "0x3274874F7B5ad07A10bCa325d20878E4Ee8B9034";

export const NFT_ROYALTY_TREASURY =
  process.env.REACT_APP_NFT_ROYALTY_TREASURY ||
  process.env.NFT_ROYALTY_TREASURY ||
  "0x7b289068e2d3a87F71316AB3B85b13fF87975221";

// Fees (in basis points)
export const FEE_MARKETPLACE_BPS =
  Number(
    process.env.REACT_APP_FEE_MARKETPLACE_BPS ||
      process.env.FEE_MARKETPLACE_BPS,
  ) || 250; // 2.5%
export const NFT_ROYALTY_TREASURY_BPS =
  Number(
    process.env.REACT_APP_NFT_ROYALTY_TREASURY_BPS ||
      process.env.NFT_ROYALTY_TREASURY_BPS,
  ) || 300; // 3%
export const ROYALTY_BPS =
  Number(process.env.REACT_APP_ROYALTY || process.env.ROYALTY) || 500; // 5%

export const SUPPORTED_CHAIN_ID = DYNAMIC_NETWORK_CONFIG.chainId;
export const RPC_URL = DYNAMIC_NETWORK_CONFIG.rpcUrl;

// Legacy NETWORK_CONFIG for backward compatibility
export const NETWORK_CONFIG = {
  chainId: DYNAMIC_NETWORK_CONFIG.chainId,
  chainIdHex: `0x${DYNAMIC_NETWORK_CONFIG.chainId.toString(16)}`,
  chainName: DYNAMIC_NETWORK_CONFIG.name,
  nativeCurrency: DYNAMIC_NETWORK_CONFIG.nativeCurrency,
  rpcUrls: [DYNAMIC_NETWORK_CONFIG.rpcUrl],
  blockExplorerUrls: [DYNAMIC_NETWORK_CONFIG.blockExplorerUrl],
};

// Application Settings
export const IS_PRODUCTION = process.env.PRODUCTION === "true";
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

// UI Constants
export const ITEMS_PER_PAGE = 12;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Links - Dynamic based on network configuration
export const BLOCK_EXPLORER_URL = DYNAMIC_NETWORK_CONFIG.blockExplorerUrl;
export const FAUCET_URL = getFaucetUrl(DYNAMIC_NETWORK_CONFIG.chainId);

// Helper function to get faucet URL based on chain ID
function getFaucetUrl(chainId: number): string {
  switch (chainId) {
    case 80002: // Polygon Amoy
      return "https://faucet.polygon.technology/";
    case 80001: // Mumbai
      return "https://faucet.polygon.technology/";
    case 137: // Polygon Mainnet
      return "https://wallet.polygon.technology/polygon/gas-swap/";
    case 11155111: // Sepolia
      return "https://sepoliafaucet.com/";
    case 1: // Ethereum Mainnet
      return "https://ethereum.org/en/developers/docs/networks/";
    default:
      return "https://faucet.polygon.technology/"; // Default to Polygon faucet
  }
}

// Helper functions
export const getExplorerTxUrl = (txHash: string): string => {
  return `${BLOCK_EXPLORER_URL}/tx/${txHash}`;
};

export const getExplorerAddressUrl = (address: string): string => {
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
};

export const getExplorerTokenUrl = (
  contractAddress: string,
  tokenId: number,
): string => {
  return `${BLOCK_EXPLORER_URL}/token/${contractAddress}?a=${tokenId}`;
};
