// Network configuration from environment variables
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Get network configuration from environment variables
export const getNetworkConfig = (): NetworkConfig => {
  const chainId = parseInt(process.env.REACT_APP_CHAIN_ID || '80002');
  const name = process.env.REACT_APP_NETWORK_NAME || 'Polygon Amoy';
  const rpcUrl = process.env.REACT_APP_RPC_URL || 'https://rpc-amoy.polygon.technology';
  const blockExplorerUrl = process.env.REACT_APP_BLOCK_EXPLORER_URL || getDefaultBlockExplorerUrl(chainId);
  
  return {
    chainId,
    name,
    rpcUrl,
    blockExplorerUrl,
    nativeCurrency: {
      name: getNativeCurrencyName(chainId),
      symbol: getNativeCurrencySymbol(chainId),
      decimals: 18,
    },
  };
};

// Get default block explorer URL based on chain ID
const getDefaultBlockExplorerUrl = (chainId: number): string => {
  switch (chainId) {
    case 1:
      return 'https://etherscan.io';
    case 137:
      return 'https://polygonscan.com';
    case 80002:
      return 'https://amoy.polygonscan.com';
    case 11155111:
      return 'https://sepolia.etherscan.io';
    default:
      return `https://explorer.chain-${chainId}.com`; // Generic fallback
  }
};

// Get native currency name based on chain ID
const getNativeCurrencyName = (chainId: number): string => {
  switch (chainId) {
    case 1:
      return 'Ether';
    case 137:
    case 80002:
      return 'MATIC';
    case 11155111:
      return 'Sepolia Ether';
    default:
      return 'ETH'; // Generic fallback
  }
};

// Get native currency symbol based on chain ID
const getNativeCurrencySymbol = (chainId: number): string => {
  switch (chainId) {
    case 1:
      return 'ETH';
    case 137:
    case 80002:
      return 'MATIC';
    case 11155111:
      return 'SepoliaETH';
    default:
      return 'ETH'; // Generic fallback
  }
};

// Get wallet network configuration for adding networks
export const getWalletNetworkConfig = (): any => {
  const config = getNetworkConfig();
  
  return {
    chainId: `0x${config.chainId.toString(16)}`,
    chainName: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: [config.rpcUrl],
    blockExplorerUrls: [config.blockExplorerUrl],
  };
};

// Validate network configuration
export const validateNetworkConfig = (): void => {
  const config = getNetworkConfig();
  
  if (!config.chainId || config.chainId <= 0) {
    throw new Error('Invalid chain ID in environment configuration');
  }
  
  if (!config.name || config.name.trim() === '') {
    throw new Error('Invalid network name in environment configuration');
  }
  
  if (!config.rpcUrl || !config.rpcUrl.startsWith('http')) {
    throw new Error('Invalid RPC URL in environment configuration');
  }
  
  console.log(`✅ Network configuration loaded: ${config.name} (Chain ID: ${config.chainId})`);
};

// Export the network configuration instance
export const NETWORK_CONFIG = getNetworkConfig();
