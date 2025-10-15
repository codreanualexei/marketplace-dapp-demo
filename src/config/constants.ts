/**
 * Application Configuration
 * All environment variables and constants
 */

// Contract Addresses
export const MARKETPLACE_ADDRESS =
  process.env.REACT_APP_MARKETPLACE_ADDRESS ||
  process.env.MARKETPLACE_ADDRESS ||
  '0x75201083D96114982B1b08176C87E2ec3e39dDb1';

export const NFT_COLLECTION_ADDRESS =
  process.env.REACT_APP_STR_DOMAIN_NFT_COLLECTION ||
  process.env.REACT_APP_NFT_COLLECTION_ADDRESS ||
  process.env.STR_DOMAIN_NFT_COLLECTION ||
  process.env.NFT_COLLECTION_ADDRESS ||
  '0x8255d9f7f51AD2B5CC7fBDFc1D9A967bD19EDD6a';

export const SPLITTER_FACTORY_ADDRESS =
  process.env.REACT_APP_SPLITTER_FACTORY_ADDRESS ||
  process.env.SPLITTER_FACTORY_ADDRESS ||
  '0x4C50CEF9c518789CFd0E014d8b1582B2dFE19A3b';

export const SPLITTER_IMPLEMENTATION_ADDRESS =
  process.env.REACT_APP_SPLITTER_IMPLEMENTATION_ADDRESS ||
  process.env.SPLITTER_IMPLEMENTATION_ADDRESS ||
  '0xAAB70f560fee9Be4F03891c30B19A8EeE1eB2E80';

// Treasury Addresses
export const MARKETPLACE_TREASURY =
  process.env.REACT_APP_MARKETPLACE_TREASURY ||
  process.env.MARKETPLACE_TREASURY ||
  '0x3274874F7B5ad07A10bCa325d20878E4Ee8B9034';

export const NFT_ROYALTY_TREASURY =
  process.env.REACT_APP_NFT_ROYALTY_TREASURY ||
  process.env.NFT_ROYALTY_TREASURY ||
  '0x7b289068e2d3a87F71316AB3B85b13fF87975221';

// Fees (in basis points)
export const FEE_MARKETPLACE_BPS = Number(process.env.REACT_APP_FEE_MARKETPLACE_BPS || process.env.FEE_MARKETPLACE_BPS) || 250; // 2.5%
export const NFT_ROYALTY_TREASURY_BPS = Number(process.env.REACT_APP_NFT_ROYALTY_TREASURY_BPS || process.env.NFT_ROYALTY_TREASURY_BPS) || 300; // 3%
export const ROYALTY_BPS = Number(process.env.REACT_APP_ROYALTY || process.env.ROYALTY) || 500; // 5%

// Network Configuration
export const SUPPORTED_CHAIN_ID = Number(process.env.REACT_APP_CHAIN_ID || process.env.CHAIN_ID) || 80002; // Polygon Amoy
export const RPC_URL = process.env.REACT_APP_RPC_URL || process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';

export const NETWORK_CONFIG = {
  chainId: SUPPORTED_CHAIN_ID,
  chainIdHex: `0x${SUPPORTED_CHAIN_ID.toString(16)}`,
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ['https://amoy.polygonscan.com/'],
};

// Application Settings
export const IS_PRODUCTION = process.env.PRODUCTION === 'true';
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// UI Constants
export const ITEMS_PER_PAGE = 12;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Links
export const BLOCK_EXPLORER_URL = 'https://amoy.polygonscan.com';
export const FAUCET_URL = 'https://faucet.polygon.technology/';

// Helper functions
export const getExplorerTxUrl = (txHash: string): string => {
  return `${BLOCK_EXPLORER_URL}/tx/${txHash}`;
};

export const getExplorerAddressUrl = (address: string): string => {
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
};

export const getExplorerTokenUrl = (contractAddress: string, tokenId: number): string => {
  return `${BLOCK_EXPLORER_URL}/token/${contractAddress}?a=${tokenId}`;
};

