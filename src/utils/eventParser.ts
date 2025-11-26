import { ethers } from 'ethers';
import MarketplaceABI from '../contracts/abis/Marketplace.json';
import StrDomainsNFTABI from '../contracts/abis/StrDomainsNFT.json';

// Parsed event interfaces
export interface ParsedPurchasedEvent {
  listingId: number;
  buyer: string;
  price: string;
  royaltyReceiver: string;
  royaltyAmount: string;
  feeAmount: string;
  sellerAmount: string;
}

export interface ParsedListedEvent {
  listingId: number;
  seller: string;
  nft: string;
  tokenId: number;
  price: string;
}

export interface ParsedListingUpdatedEvent {
  listingId: number;
  newPrice: string;
}

export interface ParsedListingCanceledEvent {
  listingId: number;
}

export interface ParsedFeeWithdrawnEvent {
  to: string;
  amount: string;
}

export interface ParsedApprovalEvent {
  owner: string;
  approved: string;
  tokenId: number;
}

export interface ParsedApprovalForAllEvent {
  owner: string;
  operator: string;
  approved: boolean;
}

export interface ParsedTransferEvent {
  from: string;
  to: string;
  tokenId: number;
}

export interface ParsedMintedEvent {
  tokenId: number;
  to: string;
  creator: string;
  tokenURI: string;
}

// Create contract interfaces for event parsing
const marketplaceInterface = new ethers.Interface(MarketplaceABI.abi as any);
const nftInterface = new ethers.Interface(StrDomainsNFTABI.abi as any);

/**
 * Parse Purchased event from transaction receipt
 */
export function parsePurchasedEvent(
  receipt: ethers.TransactionReceipt,
  marketplaceAddress: string
): ParsedPurchasedEvent | null {
  try {
    const normalizedMarketplace = marketplaceAddress.toLowerCase();
    
    // Find Purchased event in logs
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedMarketplace) continue;
      
      try {
        const parsed = marketplaceInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'Purchased') {
          return {
            listingId: Number(parsed.args.listingId),
            buyer: parsed.args.buyer,
            price: ethers.formatEther(parsed.args.price),
            royaltyReceiver: parsed.args.royaltyReceiver,
            royaltyAmount: ethers.formatEther(parsed.args.royaltyAmount),
            feeAmount: ethers.formatEther(parsed.args.feeAmount),
            sellerAmount: ethers.formatEther(parsed.args.sellerAmount),
          };
        }
      } catch (e) {
        // Not the event we're looking for, continue
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Purchased event:', error);
    return null;
  }
}

/**
 * Parse Listed event from transaction receipt
 */
export function parseListedEvent(
  receipt: ethers.TransactionReceipt,
  marketplaceAddress: string
): ParsedListedEvent | null {
  try {
    const normalizedMarketplace = marketplaceAddress.toLowerCase();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedMarketplace) continue;
      
      try {
        const parsed = marketplaceInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'Listed') {
          return {
            listingId: Number(parsed.args.listingId),
            seller: parsed.args.seller,
            nft: parsed.args.nft,
            tokenId: Number(parsed.args.tokenId),
            price: ethers.formatEther(parsed.args.price),
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Listed event:', error);
    return null;
  }
}

/**
 * Parse ListingUpdated event from transaction receipt
 */
export function parseListingUpdatedEvent(
  receipt: ethers.TransactionReceipt,
  marketplaceAddress: string
): ParsedListingUpdatedEvent | null {
  try {
    const normalizedMarketplace = marketplaceAddress.toLowerCase();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedMarketplace) continue;
      
      try {
        const parsed = marketplaceInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'ListingUpdated') {
          return {
            listingId: Number(parsed.args.listingId),
            newPrice: ethers.formatEther(parsed.args.newPrice),
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing ListingUpdated event:', error);
    return null;
  }
}

/**
 * Parse ListingCanceled event from transaction receipt
 */
export function parseListingCanceledEvent(
  receipt: ethers.TransactionReceipt,
  marketplaceAddress: string
): ParsedListingCanceledEvent | null {
  try {
    const normalizedMarketplace = marketplaceAddress.toLowerCase();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedMarketplace) continue;
      
      try {
        const parsed = marketplaceInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'ListingCanceled') {
          return {
            listingId: Number(parsed.args.listingId),
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing ListingCanceled event:', error);
    return null;
  }
}

/**
 * Parse FeeWithdrawn event from transaction receipt
 */
export function parseFeeWithdrawnEvent(
  receipt: ethers.TransactionReceipt,
  marketplaceAddress: string
): ParsedFeeWithdrawnEvent | null {
  try {
    const normalizedMarketplace = marketplaceAddress.toLowerCase();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedMarketplace) continue;
      
      try {
        const parsed = marketplaceInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'FeeWithdrawn') {
          return {
            to: parsed.args.to,
            amount: ethers.formatEther(parsed.args.amount),
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing FeeWithdrawn event:', error);
    return null;
  }
}

/**
 * Parse Approval event from NFT contract
 */
export function parseApprovalEvent(
  receipt: ethers.TransactionReceipt,
  nftAddress: string
): ParsedApprovalEvent | null {
  try {
    const normalizedNft = nftAddress.toLowerCase();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedNft) continue;
      
      try {
        const parsed = nftInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'Approval') {
          return {
            owner: parsed.args.owner,
            approved: parsed.args.approved,
            tokenId: Number(parsed.args.tokenId),
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Approval event:', error);
    return null;
  }
}

/**
 * Parse ApprovalForAll event from NFT contract
 */
export function parseApprovalForAllEvent(
  receipt: ethers.TransactionReceipt,
  nftAddress: string
): ParsedApprovalForAllEvent | null {
  try {
    const normalizedNft = nftAddress.toLowerCase();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedNft) continue;
      
      try {
        const parsed = nftInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'ApprovalForAll') {
          return {
            owner: parsed.args.owner,
            operator: parsed.args.operator,
            approved: parsed.args.approved,
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing ApprovalForAll event:', error);
    return null;
  }
}

/**
 * Parse Transfer event from NFT contract
 */
export function parseTransferEvent(
  receipt: ethers.TransactionReceipt,
  nftAddress: string
): ParsedTransferEvent[] {
  const transfers: ParsedTransferEvent[] = [];
  
  try {
    const normalizedNft = nftAddress.toLowerCase();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedNft) continue;
      
      try {
        const parsed = nftInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'Transfer') {
          transfers.push({
            from: parsed.args.from,
            to: parsed.args.to,
            tokenId: Number(parsed.args.tokenId),
          });
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.error('Error parsing Transfer events:', error);
  }
  
  return transfers;
}

/**
 * Parse Minted event from NFT contract
 */
export function parseMintedEvent(
  receipt: ethers.TransactionReceipt,
  nftAddress: string
): ParsedMintedEvent | null {
  try {
    const normalizedNft = nftAddress.toLowerCase();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== normalizedNft) continue;
      
      try {
        const parsed = nftInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'Minted') {
          return {
            tokenId: Number(parsed.args.tokenId),
            to: parsed.args.to,
            creator: parsed.args.creator,
            tokenURI: parsed.args.tokenURI,
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Minted event:', error);
    return null;
  }
}

/**
 * Parse all relevant events from a transaction receipt
 */
export function parseAllEvents(
  receipt: ethers.TransactionReceipt,
  marketplaceAddress: string,
  nftAddress: string
): {
  purchased?: ParsedPurchasedEvent;
  listed?: ParsedListedEvent;
  listingUpdated?: ParsedListingUpdatedEvent;
  listingCanceled?: ParsedListingCanceledEvent;
  feeWithdrawn?: ParsedFeeWithdrawnEvent;
  approval?: ParsedApprovalEvent;
  approvalForAll?: ParsedApprovalForAllEvent;
  transfers: ParsedTransferEvent[];
  minted?: ParsedMintedEvent;
} {
  return {
    purchased: parsePurchasedEvent(receipt, marketplaceAddress) || undefined,
    listed: parseListedEvent(receipt, marketplaceAddress) || undefined,
    listingUpdated: parseListingUpdatedEvent(receipt, marketplaceAddress) || undefined,
    listingCanceled: parseListingCanceledEvent(receipt, marketplaceAddress) || undefined,
    feeWithdrawn: parseFeeWithdrawnEvent(receipt, marketplaceAddress) || undefined,
    approval: parseApprovalEvent(receipt, nftAddress) || undefined,
    approvalForAll: parseApprovalForAllEvent(receipt, nftAddress) || undefined,
    transfers: parseTransferEvent(receipt, nftAddress),
    minted: parseMintedEvent(receipt, nftAddress) || undefined,
  };
}

