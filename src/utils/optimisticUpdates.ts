import { ListedToken, FormattedToken } from '../services/SubgraphService';
import {
  ParsedPurchasedEvent,
  ParsedListedEvent,
  ParsedListingUpdatedEvent,
  ParsedListingCanceledEvent,
  ParsedTransferEvent,
  ParsedMintedEvent,
} from './eventParser';

/**
 * Apply optimistic update for purchased listing
 * Removes the purchased listing from the list
 */
export function applyPurchasedUpdate(
  currentListings: ListedToken[],
  purchasedData: ParsedPurchasedEvent
): ListedToken[] {
  return currentListings.filter(
    listing => listing.listingId !== purchasedData.listingId
  );
}

/**
 * Apply optimistic update for new listing
 * Adds the new listing to the list (at the beginning for newest first)
 */
export function applyListedUpdate(
  currentListings: ListedToken[],
  listedData: ParsedListedEvent,
  tokenData: FormattedToken | null
): ListedToken[] {
  // Check if listing already exists (shouldn't, but safety check)
  const exists = currentListings.some(
    listing => listing.listingId === listedData.listingId
  );
  
  if (exists) {
    return currentListings;
  }
  
  // Create new listing object
  const newListing: ListedToken = {
    listingId: listedData.listingId,
    active: true,
    seller: listedData.seller,
    tokenId: listedData.tokenId,
    price: listedData.price,
    strCollectionAddress: listedData.nft,
    tokenData: tokenData || undefined,
  };
  
  // Add to beginning of array (newest first, matching subgraph order)
  return [newListing, ...currentListings];
}

/**
 * Apply optimistic update for listing price update
 * Updates the price of the specified listing
 */
export function applyListingUpdatedUpdate(
  currentListings: ListedToken[],
  updatedData: ParsedListingUpdatedEvent
): ListedToken[] {
  return currentListings.map(listing => {
    if (listing.listingId === updatedData.listingId) {
      return {
        ...listing,
        price: updatedData.newPrice,
      };
    }
    return listing;
  });
}

/**
 * Apply optimistic update for canceled listing
 * Removes the canceled listing from the list
 */
export function applyListingCanceledUpdate(
  currentListings: ListedToken[],
  canceledData: ParsedListingCanceledEvent
): ListedToken[] {
  return currentListings.filter(
    listing => listing.listingId !== canceledData.listingId
  );
}

/**
 * Apply optimistic update for NFT transfer (when listing)
 * Removes the NFT from user's owned NFTs list
 */
export function applyTransferUpdateForListing(
  ownedNFTs: FormattedToken[],
  transfer: ParsedTransferEvent,
  userAddress: string
): FormattedToken[] {
  const normalizedUser = userAddress.toLowerCase();
  const normalizedTo = transfer.to.toLowerCase();
  
  // If NFT was transferred FROM user TO marketplace, remove from owned list
  if (transfer.from.toLowerCase() === normalizedUser && normalizedTo !== normalizedUser) {
    return ownedNFTs.filter(nft => nft.tokenId !== transfer.tokenId);
  }
  
  return ownedNFTs;
}

/**
 * Apply optimistic update for NFT transfer (when purchasing)
 * Adds the NFT to user's owned NFTs list
 */
export function applyTransferUpdateForPurchase(
  ownedNFTs: FormattedToken[],
  transfer: ParsedTransferEvent,
  userAddress: string,
  tokenData?: FormattedToken
): FormattedToken[] {
  const normalizedUser = userAddress.toLowerCase();
  const normalizedTo = transfer.to.toLowerCase();
  
  // If NFT was transferred TO user, add to owned list
  if (normalizedTo === normalizedUser) {
    // Check if already exists
    const exists = ownedNFTs.some(nft => nft.tokenId === transfer.tokenId);
    if (exists) {
      return ownedNFTs;
    }
    
    // Add new NFT (use provided tokenData or create minimal entry)
    const newNFT: FormattedToken = tokenData || {
      tokenId: transfer.tokenId,
      owner: userAddress,
      creator: '', // Will be filled by subgraph sync
      uri: '',
      mintTimestamp: Date.now(),
      lastPrice: '0',
      lastPriceTimestamp: '0',
    };
    
    return [...ownedNFTs, newNFT];
  }
  
  return ownedNFTs;
}

/**
 * Apply optimistic update for minted NFT
 * Adds the newly minted NFT to user's owned NFTs list
 */
export function applyMintedUpdate(
  ownedNFTs: FormattedToken[],
  mintedData: ParsedMintedEvent,
  userAddress: string
): FormattedToken[] {
  const normalizedUser = userAddress.toLowerCase();
  const normalizedTo = mintedData.to.toLowerCase();
  
  // Only add if minted to current user
  if (normalizedTo !== normalizedUser) {
    return ownedNFTs;
  }
  
  // Check if already exists
  const exists = ownedNFTs.some(nft => nft.tokenId === mintedData.tokenId);
  if (exists) {
    return ownedNFTs;
  }
  
  // Add new minted NFT
  const newNFT: FormattedToken = {
    tokenId: mintedData.tokenId,
    owner: userAddress,
    creator: mintedData.creator,
    uri: mintedData.tokenURI,
    mintTimestamp: Date.now(),
    lastPrice: '0',
    lastPriceTimestamp: '0',
  };
  
  return [...ownedNFTs, newNFT];
}

/**
 * Check if a listing is on the current page
 * Used to determine if we should update the UI immediately
 */
export function isListingOnCurrentPage(
  listingId: number,
  currentListings: ListedToken[],
  currentPage: number,
  itemsPerPage: number
): boolean {
  // Check if listing is in current view
  return currentListings.some(listing => listing.listingId === listingId);
}

/**
 * Calculate new total listings count after purchase
 */
export function calculateNewListingCountAfterPurchase(
  currentCount: number
): number {
  return Math.max(0, currentCount - 1);
}

/**
 * Calculate new total listings count after listing
 */
export function calculateNewListingCountAfterListing(
  currentCount: number
): number {
  return currentCount + 1;
}

/**
 * Calculate new total listings count after cancel
 */
export function calculateNewListingCountAfterCancel(
  currentCount: number
): number {
  return Math.max(0, currentCount - 1);
}

/**
 * Compare two listings arrays to check if they're different
 * Returns true if arrays are different, false if they're the same
 */
export function areListingsDifferent(
  oldListings: ListedToken[],
  newListings: ListedToken[]
): boolean {
  // Quick check: different lengths means different
  if (oldListings.length !== newListings.length) {
    return true;
  }
  
  // If both empty, they're the same
  if (oldListings.length === 0) {
    return false;
  }
  
  // Create maps for quick lookup
  const oldMap = new Map(oldListings.map(l => [l.listingId, l]));
  const newMap = new Map(newListings.map(l => [l.listingId, l]));
  
  // Check if all listingIds match
  for (const listingId of oldMap.keys()) {
    if (!newMap.has(listingId)) {
      return true; // Listing removed
    }
  }
  
  for (const listingId of newMap.keys()) {
    if (!oldMap.has(listingId)) {
      return true; // New listing added
    }
    
    // Check if price changed (for updates)
    const oldListing = oldMap.get(listingId)!;
    const newListing = newMap.get(listingId)!;
    if (oldListing.price !== newListing.price) {
      return true; // Price changed
    }
    
    // Check if active status changed
    if (oldListing.active !== newListing.active) {
      return true; // Status changed
    }
  }
  
  return false; // Arrays are the same
}

/**
 * Compare two domains arrays to check if they're different
 * Returns true if arrays are different, false if they're the same
 */
export function areDomainsDifferent(
  oldDomains: FormattedToken[],
  newDomains: FormattedToken[]
): boolean {
  // Quick check: different lengths means different
  if (oldDomains.length !== newDomains.length) {
    return true;
  }
  
  // If both empty, they're the same
  if (oldDomains.length === 0) {
    return false;
  }
  
  // Create maps for quick lookup
  const oldMap = new Map(oldDomains.map(d => [d.tokenId, d]));
  const newMap = new Map(newDomains.map(d => [d.tokenId, d]));
  
  // Check if all tokenIds match
  for (const tokenId of oldMap.keys()) {
    if (!newMap.has(tokenId)) {
      return true; // Domain removed
    }
  }
  
  for (const tokenId of newMap.keys()) {
    if (!oldMap.has(tokenId)) {
      return true; // New domain added
    }
    
    // Check if royalty balance changed
    const oldDomain = oldMap.get(tokenId)!;
    const newDomain = newMap.get(tokenId)!;
    if (oldDomain.royaltyBalance !== newDomain.royaltyBalance) {
      return true; // Royalty balance changed
    }
  }
  
  return false; // Arrays are the same
}

/**
 * Apply optimistic update for approval
 * Updates approval status for a token
 */
export function applyApprovalUpdate(
  approvalStatus: Record<number, boolean>,
  tokenId: number
): Record<number, boolean> {
  return {
    ...approvalStatus,
    [tokenId]: true,
  };
}

/**
 * Apply optimistic update for listing
 * Removes the listed domain from owned domains (it's now owned by marketplace)
 */
export function applyListingUpdate(
  ownedDomains: FormattedToken[],
  tokenId: number
): FormattedToken[] {
  return ownedDomains.filter(domain => domain.tokenId !== tokenId);
}

