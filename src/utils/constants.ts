/**
 * Application constants
 */

// Supported networks
export const SUPPORTED_CHAINS = {
  MAINNET: 1,
  GOERLI: 5,
  SEPOLIA: 11155111,
  POLYGON: 137,
  MUMBAI: 80001,
  BSC: 56,
  BSC_TESTNET: 97,
} as const;

// Network configurations
export const NETWORK_CONFIGS = {
  [SUPPORTED_CHAINS.MAINNET]: {
    name: "Ethereum Mainnet",
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
  [SUPPORTED_CHAINS.SEPOLIA]: {
    name: "Sepolia Testnet",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: {
      name: "SepoliaETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
  [SUPPORTED_CHAINS.MUMBAI]: {
    name: "Mumbai Testnet",
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    blockExplorer: "https://mumbai.polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
};

// Contract addresses (Update these with your deployed contracts)
export const CONTRACT_ADDRESSES = {
  NFT_MARKETPLACE: {
    [SUPPORTED_CHAINS.MAINNET]: "0x0000000000000000000000000000000000000000",
    [SUPPORTED_CHAINS.SEPOLIA]: "0x0000000000000000000000000000000000000000",
    [SUPPORTED_CHAINS.POLYGON]: "0x0000000000000000000000000000000000000000",
    [SUPPORTED_CHAINS.MUMBAI]: "0x0000000000000000000000000000000000000000",
  },
  NFT_TOKEN: {
    [SUPPORTED_CHAINS.MAINNET]: "0x0000000000000000000000000000000000000000",
    [SUPPORTED_CHAINS.SEPOLIA]: "0x0000000000000000000000000000000000000000",
    [SUPPORTED_CHAINS.POLYGON]: "0x0000000000000000000000000000000000000000",
    [SUPPORTED_CHAINS.MUMBAI]: "0x0000000000000000000000000000000000000000",
  },
};

// IPFS Configuration
export const IPFS_CONFIG = {
  gateway: "https://ipfs.io/ipfs/",
  pinataGateway: "https://gateway.pinata.cloud/ipfs/",
};

// Pagination
export const ITEMS_PER_PAGE = 12;

// Transaction settings
export const GAS_LIMIT = {
  MINT: 300000,
  LIST: 100000,
  BUY: 150000,
  TRANSFER: 80000,
};

// Application URLs
export const APP_URLS = {
  website: "https://your-marketplace.com",
  docs: "https://docs.your-marketplace.com",
  twitter: "https://twitter.com/your_marketplace",
  discord: "https://discord.gg/your_marketplace",
};
