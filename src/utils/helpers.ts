import { ethers } from "ethers";

/**
 * Format wallet address to short form
 * @param address - Full wallet address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Formatted address (e.g., "0x1234...5678")
 */
export const formatAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4,
): string => {
  if (!address) return "";
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Format ETH value to readable string
 * @param value - Value in wei
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted ETH value
 */
export const formatEth = (
  value: string | bigint,
  decimals: number = 4,
): string => {
  try {
    const eth = ethers.formatEther(value);
    return parseFloat(eth).toFixed(decimals);
  } catch (error) {
    console.error("Error formatting ETH:", error);
    return "0.0000";
  }
};

/**
 * Parse ETH to wei
 * @param value - Value in ETH
 * @returns Value in wei
 */
export const parseEth = (value: string): bigint => {
  try {
    return ethers.parseEther(value);
  } catch (error) {
    console.error("Error parsing ETH:", error);
    return BigInt(0);
  }
};

/**
 * Get network name from chain ID
 * @param chainId - Chain ID
 * @returns Network name
 */
export const getNetworkName = (chainId: number): string => {
  const networks: { [key: number]: string } = {
    1: "Ethereum Mainnet",
    5: "Goerli Testnet",
    11155111: "Sepolia Testnet",
    137: "Polygon Mainnet",
    80001: "Mumbai Testnet",
    56: "BSC Mainnet",
    97: "BSC Testnet",
    42161: "Arbitrum One",
    421613: "Arbitrum Goerli",
    10: "Optimism",
    420: "Optimism Goerli",
  };

  return networks[chainId] || `Unknown Network (${chainId})`;
};

/**
 * Validate Ethereum address
 * @param address - Address to validate
 * @returns True if valid, false otherwise
 */
export const isValidAddress = (address: string): boolean => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

/**
 * Wait for transaction confirmation
 * @param tx - Transaction response
 * @param confirmations - Number of confirmations to wait for (default: 1)
 * @returns Transaction receipt
 */
export const waitForTransaction = async (
  tx: ethers.TransactionResponse,
  confirmations: number = 1,
): Promise<ethers.TransactionReceipt | null> => {
  try {
    const receipt = await tx.wait(confirmations);
    return receipt;
  } catch (error) {
    console.error("Transaction failed:", error);
    return null;
  }
};

/**
 * Format timestamp to readable date
 * @param timestamp - Unix timestamp
 * @returns Formatted date string
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Calculate time ago from timestamp
 * @param timestamp - Unix timestamp
 * @returns Time ago string (e.g., "2 hours ago")
 */
export const timeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "just now";
};

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves to true if successful
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy:", error);
    return false;
  }
};

/**
 * Format large numbers with K, M, B suffixes
 * @param num - Number to format
 * @returns Formatted string (e.g., "1.5K", "2.3M")
 */
export const formatNumber = (num: number): string => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
};
