import { ethers } from 'ethers';
import MarketplaceABI from '../contracts/abis/Marketplace.json';
import StrDomainsNFTABI from '../contracts/abis/StrDomainsNFT.json';
import RoyaltySplitterABI from '../contracts/abis/RoyaltySplitter.json';

export interface TokenData {
  creator: string;
  mintTimestamp: number;
  uri: string;
  lastPrice: string;
  lastPriceTimestamp: string;
}

export interface FormattedToken extends TokenData {
  tokenId: number;
}

export interface Listing {
  seller: string;
  nft: string;
  tokenId: bigint;
  price: bigint;
  active: boolean;
}

export interface ListedToken {
  listingId: number;
  active: boolean;
  seller: string;
  tokenId: number;
  price: string;
  strCollectionAddress: string;
  tokenData?: FormattedToken;
}

export interface SplitterBalance {
  splitter: string;
  balance: string;
}

export class MarketplaceSDK {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private marketplaceAddress: string;
  private nftAddress: string;
  private marketplaceContract: ethers.Contract;
  private nftContract: ethers.Contract;
  private develop: boolean;
  public collectionCountTokens?: number;
  private cachedActiveListingCount?: number;

  constructor(
    signer: ethers.Signer,
    marketplaceAddress: string,
    nftAddress: string,
    develop: boolean = false
  ) {
    this.develop = develop;
    this.signer = signer;
    this.provider = signer.provider!;
    this.marketplaceAddress = marketplaceAddress;
    this.nftAddress = nftAddress;

    // Create contract instances
    this.marketplaceContract = new ethers.Contract(
      marketplaceAddress,
      MarketplaceABI,
      signer
    );
    this.nftContract = new ethers.Contract(nftAddress, StrDomainsNFTABI, signer);

  }

  // Update signer when wallet changes
  updateSigner(signer: ethers.Signer) {
    this.signer = signer;
    this.provider = signer.provider!;
    
    this.marketplaceContract = new ethers.Contract(
      this.marketplaceAddress,
      MarketplaceABI,
      signer
    );
    this.nftContract = new ethers.Contract(
      this.nftAddress,
      StrDomainsNFTABI,
      signer
    );
  }

  // Buy a listed token
  async buyToken(listingId: number): Promise<string | null> {
    try {
      const listing = await this.marketplaceContract.getListing(listingId);
      const { price, active } = listing;

      if (!active) {
        this.warn('This listing is not active.');
        return null;
      }

      this.warn(`Buying token for ${ethers.formatEther(price)} MATIC...`);
      const tx = await this.marketplaceContract.buy(listingId, {
        value: price,
      });
      const receipt = await tx.wait();

      this.warn(`Purchase successful!`);
      return receipt.hash;
    } catch (error: any) {
      this.error('Error purchasing token:', error);
      return null;
    }
  }

  // Update a listed token price
  async updateListing(listingId: number, newPrice: string): Promise<string | null> {
    try {
      const tx = await this.marketplaceContract.updateListing(
        listingId,
        ethers.parseEther(newPrice)
      );
      this.warn(`Listing ${listingId} updated with new price: ${newPrice} MATIC`);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error: any) {
      this.error('Error updating listing:', error);
      return null;
    }
  }

  // List a token on the marketplace
  async listToken(tokenId: number, price: string): Promise<string | null> {
    try {
      await this.approveTokenForSale(tokenId);

      const approved = await this.nftContract.getApproved(tokenId);

      if (approved !== this.marketplaceAddress) {
        this.warn(
          `Please approve tokenId: ${tokenId} for Marketplace address: ${this.marketplaceAddress}, or check the Marketplace listings`
        );
        return null;
      }

      const tx = await this.marketplaceContract.listToken(
        this.nftAddress,
        tokenId,
        ethers.parseEther(price)
      );

      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error: any) {
      this.error(`Error listing your tokenId: ${tokenId}, check your ownership`);
      return null;
    }
  }

  // Cancel a listing
  async cancelListing(listingId: number): Promise<string | null> {
    try {
      const tx = await this.marketplaceContract.cancelListing(listingId);
      const receipt = await tx.wait();
      this.warn(`Listing ${listingId} has been cancelled.`);
      return receipt.hash;
    } catch (error: any) {
      this.error(
        `Error cancelling listing, check the listingId: ${listingId} is active, or it exists`
      );
      return null;
    }
  }

  // Get Marketplace fees
  async getMarketplaceFees(): Promise<bigint | null> {
    try {
      const fees = await this.marketplaceContract.accruedFees();
      return fees;
    } catch (error: any) {
      this.error('Error fetching fees details:', error);
      return null;
    }
  }

  // Get listing details
  async getListing(listingId: number): Promise<Listing | null> {
    try {
      const listing = await this.marketplaceContract.getListing(listingId);
      return listing;
    } catch (error: any) {
      this.error('Error fetching listing details:', error);
      return null;
    }
  }

  // Get tokenData from collection
  async getTokenData(tokenId: number): Promise<any> {
    try {
      const data = await this.nftContract.getTokenData(tokenId);
      return data;
    } catch (error: any) {
      this.error('Getting token:', error);
      return null;
    }
  }

  // Get token data from collection
  async getStrDomainFromCollection(tokenId: number): Promise<FormattedToken | null> {
    try {
      const data = await this.nftContract.getTokenData(tokenId);
      const formattedToken: FormattedToken = {
        tokenId: tokenId,
        creator: data[0],
        mintTimestamp: Number(data[1]),
        uri: data[2],
        lastPrice: data[3].toString(),
        lastPriceTimestamp: data[4].toString(),
      };

      return formattedToken;
    } catch (e: any) {
      // Don't log error, just return null
      return null;
    }
  }

  // Scraping all tokens from the collection
  async getAllStrDomainsFromCollection(): Promise<FormattedToken[]> {
    const tokenList: FormattedToken[] = [];
    let tokenId = 1;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const MAX_TOKENS = 50; // Limit to avoid RPC issues
    
    while (tokenId <= MAX_TOKENS && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      try {
        const tokenData = await this.getStrDomainFromCollection(tokenId);
        if (tokenData) {
          tokenList.push(tokenData);
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
        }
        tokenId++;
      } catch (error: any) {
        consecutiveFailures++;
        if (
          error.code === 'CALL_EXCEPTION' &&
          error.reason?.includes('ERC721NonexistentToken')
        ) {
          tokenId++;
          continue;
        }
        this.warn(`Error at token ${tokenId}, continuing...`);
        tokenId++;
      }
    }

    this.collectionCountTokens = tokenList.length;
    this.warn(`Found ${tokenList.length} tokens in collection`);
    return tokenList;
  }

  // Fetch all NFTs from the collection that belong to the connected wallet
  async getMyDomainsFromCollection(): Promise<FormattedToken[]> {
    const myTokenList: FormattedToken[] = [];
    let tokenId = 1;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const MAX_TOKENS = 20; // Reduced to avoid RPC issues

    const myAddress = await this.signer.getAddress();
    
    // Helper to delay between calls
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (tokenId <= MAX_TOKENS && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      try {
        const owner = await this.nftContract.ownerOf(tokenId);

        if (owner.toLowerCase() === myAddress.toLowerCase()) {
          const tokenData = await this.getStrDomainFromCollection(tokenId);
          if (tokenData) {
            myTokenList.push(tokenData);
            this.log(`Found your domain: Token #${tokenId}`);
          }
        }

        consecutiveFailures = 0;
        tokenId++;
        
        // Small delay to avoid RPC rate limiting
        await delay(100);
      } catch (error: any) {
        consecutiveFailures++;
        
        if (
          error.code === 'CALL_EXCEPTION' &&
          (error.reason?.includes('ERC721NonexistentToken') || 
           error.reason?.includes('nonexistent') ||
           error.message?.includes('could not decode'))
        ) {
          tokenId++;
          await delay(100);
          continue;
        }

        // RPC error - wait longer before continuing
        if (error.message?.includes('Internal JSON-RPC')) {
          this.warn(`RPC rate limit hit at token ${tokenId}, slowing down...`);
          await delay(500);
        }
        
        this.warn(`Error at tokenId ${tokenId}, continuing...`);
        tokenId++;
        await delay(200);
      }
    }

    this.warn(`Found ${myTokenList.length} domains owned by you`);
    return myTokenList;
  }

  // Count all the tokens from the collection
  async countCollectionTokens(): Promise<number> {
    const tokenList: FormattedToken[] = [];
    let tokenId = 1;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const MAX_TOKENS = 50; // Limit to avoid RPC issues
    
    while (tokenId <= MAX_TOKENS && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      try {
        const tokenData = await this.getStrDomainFromCollection(tokenId);
        if (tokenData) {
          tokenList.push(tokenData);
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
        }
        tokenId++;
      } catch (error: any) {
        consecutiveFailures++;
        if (
          error.code === 'CALL_EXCEPTION' &&
          (error.reason?.includes('ERC721NonexistentToken') ||
           error.reason?.includes('nonexistent') ||
           error.message?.includes('could not decode'))
        ) {
          tokenId++;
          continue;
        }
        this.warn(`Error at token ${tokenId}, continuing...`);
        tokenId++;
      }
    }

    this.collectionCountTokens = tokenList.length;
    this.warn(`Counted ${tokenList.length} tokens in collection`);
    return tokenList.length;
  }

  // Scraping all splitter contracts from the collection
  async getAllSplitterContractsFromCollection(): Promise<string[]> {
    this.collectionCountTokens = await this.countCollectionTokens();
    if (!this.collectionCountTokens) {
      this.warn(
        'no token counter, please run Marketplace.getStrDomainFromCollection()'
      );
      return [];
    }
    const splitterList: string[] = [];
    let tokenId = 1;
    for (tokenId = 1; tokenId <= this.collectionCountTokens; tokenId++) {
      try {
        const splitterData = await this.nftContract.royaltyInfo(tokenId, 40000000);
        splitterList.push(splitterData[0]);
      } catch (error: any) {
        this.error('Unexpected error fetching token:', error);
        break;
      }
    }

    return splitterList;
  }

  // Get total count of listings
  async getListingCount(): Promise<number> {
    try {
      const result = await this.marketplaceContract.lastListingId();
      return Number(result);
    } catch (error: any) {
      this.error('Error getting listing count:', error);
      return 0;
    }
  }

  // Count active listings by scanning IDs (with limits to avoid RPC overload)
  async getActiveListingCount(maxScan: number = 500): Promise<number> {
    try {
      const lastId = await this.getListingCount();
      if (lastId === 0) return 0;

      let active = 0;
      let scanned = 0;
      for (let id = lastId; id >= 1; id--) {
        try {
          const listing = await this.marketplaceContract.getListing(id);
          if (listing?.active) active++;
        } catch (_) {
          // ignore missing IDs
        }
        scanned++;
        if (scanned >= maxScan) break;
        // small delay
        await new Promise(r => setTimeout(r, 50));
      }
      this.cachedActiveListingCount = active;
      return active;
    } catch (e) {
      this.error('Error counting active listings:', e);
      return 0;
    }
  }

  // Get a page of active listings by scanning from the end and skipping inactive/missing
  async getActiveListingsPage(page: number, perPage: number): Promise<ListedToken[]> {
    const results: ListedToken[] = [];
    try {
      const lastId = await this.getListingCount();
      if (lastId === 0) return results;

      // Determine how many active to skip
      const toSkip = (page - 1) * perPage;
      let skipped = 0;
      let collected = 0;

      for (let id = lastId; id >= 1; id--) {
        try {
          const listing = await this.marketplaceContract.getListing(id);
          if (!listing?.active) {
            continue;
          }

          if (skipped < toSkip) {
            skipped++;
            continue;
          }

          let tokenData;
          try {
            tokenData = await this.getStrDomainFromCollection(Number(listing.tokenId));
          } catch (_) {}

          results.push({
            listingId: id,
            active: listing.active,
            seller: listing.seller,
            tokenId: Number(listing.tokenId),
            price: ethers.formatEther(listing.price),
            strCollectionAddress: listing.nft,
            tokenData: tokenData || undefined,
          });
          collected++;
          if (collected >= perPage) break;
        } catch (_) {
          // ignore and continue
        }
        // small delay
        await new Promise(r => setTimeout(r, 60));
      }
    } catch (e) {
      this.error('Error fetching active listings page:', e);
    }
    return results;
  }

  // Get paginated listings (smart pagination - only fetch what's needed)
  async getListingsPaginated(
    startId: number,
    limit: number,
    activeOnly: boolean = true
  ): Promise<ListedToken[]> {
    const listedTokens: ListedToken[] = [];
    const endId = startId + limit - 1;
    
    this.log(`Fetching listings ${startId} to ${endId} (${activeOnly ? 'active only' : 'all'})`);
    
    // Helper to delay between calls
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let listingId = startId; listingId <= endId; listingId++) {
      try {
        const listing = await this.marketplaceContract.getListing(listingId);

        // Filter by active if needed
        if (!activeOnly || listing.active) {
          let tokenData;
          try {
            tokenData = await this.getStrDomainFromCollection(Number(listing.tokenId));
          } catch (e) {
            // Token data optional
          }

          listedTokens.push({
            listingId,
            active: listing.active,
            seller: listing.seller,
            tokenId: Number(listing.tokenId),
            price: ethers.formatEther(listing.price),
            strCollectionAddress: listing.nft,
            tokenData: tokenData || undefined,
          });
        }
        
        // Small delay to avoid RPC spam
        await delay(100);
      } catch (e: any) {
        // Listing doesn't exist or error, continue
        await delay(50);
        continue;
      }
    }

    this.log(`Fetched ${listedTokens.length} listings from range ${startId}-${endId}`);
    return listedTokens;
  }

  // Get all active listed tokens on marketplace (legacy method - for compatibility)
  async getAllActiveListedDomainsOnMarketplaceWithTokenData(): Promise<ListedToken[]> {
    const listedTokens: ListedToken[] = [];
    
    try {
      let lastListingId: number = 0;
      
      // Try to get lastListingId
      try {
        const result = await this.marketplaceContract.lastListingId();
        lastListingId = Number(result);
        this.log('lastListingId:', lastListingId);
      } catch (error: any) {
        this.warn('lastListingId() not available, using fallback method');
        return await this.scanForListings(true);
      }

      if (lastListingId === 0) {
        this.warn('No listings found - lastListingId is 0');
        return [];
      }

      // Use pagination to fetch all (with delays)
      return await this.getListingsPaginated(1, lastListingId, true);
    } catch (error: any) {
      this.error('Error fetching listed tokens:', error);
      return [];
    }
  }

  // Fallback: Scan for listings without lastListingId
  private async scanForListings(activeOnly: boolean = true): Promise<ListedToken[]> {
    const listedTokens: ListedToken[] = [];
    const MAX_SCAN = 20; // Reduced to avoid RPC spam
    let consecutiveFailures = 0;
    let rpcErrorCount = 0;
    
    this.warn('Scanning for listings (no lastListingId available)...');
    
    // Helper to delay between calls
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let listingId = 1; listingId <= MAX_SCAN; listingId++) {
      try {
        // Exponential backoff if we've hit RPC errors
        if (rpcErrorCount > 0) {
          const backoffDelay = Math.min(1000 * Math.pow(2, rpcErrorCount), 5000);
          this.log(`Backing off ${backoffDelay}ms before next call...`);
          await delay(backoffDelay);
        } else {
          // Normal delay
          await delay(300);
        }
        
        const listing = await this.marketplaceContract.getListing(listingId);
        
        // Reset failure counters on success
        consecutiveFailures = 0;
        rpcErrorCount = Math.max(0, rpcErrorCount - 1); // Gradually reduce backoff
        
        // Filter by active if needed
        if (!activeOnly || listing.active) {
          let tokenData;
          try {
            await delay(200); // Delay before token data
            tokenData = await this.getStrDomainFromCollection(Number(listing.tokenId));
          } catch (e) {
            // Token data optional
          }

          listedTokens.push({
            listingId,
            active: listing.active,
            seller: listing.seller,
            tokenId: Number(listing.tokenId),
            price: ethers.formatEther(listing.price),
            strCollectionAddress: listing.nft,
            tokenData: tokenData || undefined,
          });
        }
      } catch (e: any) {
        consecutiveFailures++;
        
        // If RPC error, increase backoff
        if (e.message?.includes('Internal JSON-RPC') || e.code === -32603) {
          rpcErrorCount++;
          this.warn(`RPC error #${rpcErrorCount} at listing ${listingId}, backing off...`);
          
          // If too many RPC errors, stop early
          if (rpcErrorCount >= 3) {
            this.warn(`Too many RPC errors, stopping scan early`);
            break;
          }
        }
        
        // Stop after 5 consecutive failures
        if (consecutiveFailures >= 5) {
          this.log(`Stopped scanning at listing ${listingId} after ${consecutiveFailures} failures`);
          break;
        }
      }
    }
    
    this.log(`Found ${listedTokens.length} listings via scanning`);
    return listedTokens;
  }

  // Get all listed tokens on marketplace (legacy - for compatibility)
  async getAllListedDomainsOnMarketplaceWithTokenData(): Promise<ListedToken[]> {
    try {
      let lastListingId: number = 0;
      
      try {
        const result = await this.marketplaceContract.lastListingId();
        lastListingId = Number(result);
      } catch (error: any) {
        this.warn('lastListingId() not available, using fallback');
        return await this.scanForListings(false);
      }

      if (lastListingId === 0) {
        this.warn('No listings found');
        return [];
      }

      // Use pagination to fetch all
      return await this.getListingsPaginated(1, lastListingId, false);
    } catch (error: any) {
      this.error('Error fetching listed tokens:', error);
      return [];
    }
  }

  // Get my all listed tokens on marketplace (legacy - fetches all)
  async getMyAllListedDomainsOnMarketplaceWithTokenData(): Promise<ListedToken[]> {
    try {
      const myAddress = (await this.signer.getAddress()).toLowerCase();
      let lastListingId: number = 0;
      
      try {
        const result = await this.marketplaceContract.lastListingId();
        lastListingId = Number(result);
      } catch (error: any) {
        this.warn('lastListingId() not available, using fallback');
        const allListings = await this.scanForListings(false);
        return allListings.filter(l => l.seller.toLowerCase() === myAddress);
      }

      if (lastListingId === 0) {
        this.warn('No listings found');
        return [];
      }

      // Fetch all listings for this user
      const allListings = await this.getListingsPaginated(1, lastListingId, false);
      return allListings.filter(l => l.seller.toLowerCase() === myAddress);
    } catch (error: any) {
      this.error('Error fetching listed tokens:', error);
      return [];
    }
  }

  // Get paginated NFTs from collection
  async getDomainsPaginated(
    startTokenId: number,
    limit: number,
    filterByOwner?: string
  ): Promise<FormattedToken[]> {
    const tokenList: FormattedToken[] = [];
    const endTokenId = startTokenId + limit - 1;
    
    this.log(`Fetching tokens ${startTokenId} to ${endTokenId}`);
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const targetOwner = filterByOwner?.toLowerCase();
    
    for (let tokenId = startTokenId; tokenId <= endTokenId; tokenId++) {
      try {
        // If filtering by owner, check ownership first
        if (targetOwner) {
          const owner = await this.nftContract.ownerOf(tokenId);
          if (owner.toLowerCase() !== targetOwner) {
            await delay(50);
            continue;
          }
        }
        
        const tokenData = await this.getStrDomainFromCollection(tokenId);
        if (tokenData) {
          tokenList.push(tokenData);
        }
        
        await delay(100);
      } catch (error: any) {
        // Token doesn't exist, continue
        await delay(50);
        continue;
      }
    }

    this.log(`Fetched ${tokenList.length} tokens from range ${startTokenId}-${endTokenId}`);
    return tokenList;
  }

  // Get available fee balance from a splitter
  async getSplitterBalance(
    splitterAddress: string,
    walletAddress: string
  ): Promise<bigint | null> {
    try {
      const contractInstance = new ethers.Contract(
        splitterAddress,
        RoyaltySplitterABI,
        this.signer
      );
      const balance = await contractInstance.ethBalance(walletAddress);
      return balance;
    } catch (error: any) {
      this.error('Unexpected error fetching balance:', error);
      return null;
    }
  }

  // Get all splitter balances for a given wallet across the collection
  async getSplitterBalanceOfWallet(walletAddress: string): Promise<SplitterBalance[]> {
    const balances: SplitterBalance[] = [];

    try {
      const splitterAddresses = await this.getAllSplitterContractsFromCollection();

      if (!splitterAddresses || splitterAddresses.length === 0) {
        this.warn('No splitter contracts found in collection.');
        return balances;
      }

      for (const splitterAddress of splitterAddresses) {
        try {
          const contract = new ethers.Contract(
            splitterAddress,
            RoyaltySplitterABI,
            this.signer
          );
          const rawBalance = await contract.ethBalance(walletAddress);
          const balance = ethers.formatEther(rawBalance);

          if (rawBalance > 0n) {
            balances.push({
              splitter: splitterAddress,
              balance,
            });
          }
        } catch (innerErr: any) {
          this.warn(
            `Failed to fetch balance from splitter: ${splitterAddress}`,
            innerErr.message
          );
        }
      }
    } catch (error: any) {
      this.error('Error fetching splitter balances:', error);
    }

    return balances;
  }

  // Owner only - Approve token for sale
  async approveTokenForSale(tokenId: number): Promise<string | null> {
    try {
      const tx = await this.nftContract.approve(this.marketplaceAddress, tokenId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error: any) {
      this.error(
        `Error approve your NFT tokenId: ${tokenId}, check your ownership`
      );
      return null;
    }
  }

  // Withdraw royalty from a specific splitter
  async withdrawRoyaltyFromSplitter(splitterAddress: string): Promise<any> {
    try {
      const contract = new ethers.Contract(
        splitterAddress,
        RoyaltySplitterABI,
        this.signer
      );
      const walletAddress = await this.signer.getAddress();
      const rawBalance = await contract.ethBalance(walletAddress);

      if (rawBalance <= 0n) {
        this.warn(`⏭ Skipping ${splitterAddress}: no funds to withdraw.`);
        return null;
      }

      const balance = ethers.formatEther(rawBalance);

      const tx = await contract.withdraw();
      if (!tx || !tx.hash) {
        this.warn(
          `No transaction hash returned from withdraw() on ${splitterAddress}`
        );
        return null;
      }

      const receipt = await tx.wait();

      this.warn(
        `Withdrawn from splitter ${splitterAddress} | Tx: ${receipt.hash} | Amount: ${balance}`
      );

      return {
        splitter: splitterAddress,
        transactionHash: receipt.hash,
        withdrawn: balance,
      };
    } catch (err: any) {
      this.warn(
        `Failed to withdraw from splitter: ${splitterAddress} | ${err.message}`
      );
      return null;
    }
  }

  // Withdraw royalty fees from all existing splitter contracts
  async withdrawAllRoyaltyFees(): Promise<any[] | null> {
    try {
      const walletAddress = await this.signer.getAddress();
      const splitterBalances = await this.getSplitterBalanceOfWallet(walletAddress);

      if (!splitterBalances || splitterBalances.length === 0) {
        this.warn('No splitter contracts with available balances found.');
        return null;
      }

      const receipts = [];

      for (const item of splitterBalances) {
        const result = await this.withdrawRoyaltyFromSplitter(item.splitter);
        if (result) {
          receipts.push(result);
        }
      }

      return receipts;
    } catch (error: any) {
      this.error('Error withdrawing all royalty fees:', error);
      return null;
    }
  }

  // Withdraw marketplace fees (only owner of the contract)
  async withdrawMarketPlaceFees(): Promise<string | null> {
    const isAdmin = await this.isAdmin();

    try {
      if (!isAdmin) {
        this.warn(
          'You are not an admin of the Marketplace contract. Withdraw not allowed.'
        );
        return null;
      }

      const tx = await this.marketplaceContract.withdrawFees();
      const receipt = await tx.wait();

      this.warn(`Marketplace fees withdrawn successfully! Tx hash: ${receipt.hash}`);

      return receipt.hash;
    } catch (error: any) {
      this.error('Error withdrawing marketplace fees, or check the fees balance');
      return null;
    }
  }

  // Check if connected wallet is admin
  async isAdmin(): Promise<boolean> {
    try {
      const ADMIN_ROLE =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const isAdmin = await this.nftContract.hasRole(
        ADMIN_ROLE,
        await this.signer.getAddress()
      );
      if (!isAdmin) {
        this.warn('Please connect with an admin account before running isAdmin method.');
      }
      return isAdmin;
    } catch (e) {
      return false;
    }
  }

  // Admin only - Mint domain
  async mintDomain(originalCreator: string, URI: string): Promise<string | null> {
    if (!(await this.isAdmin())) return null;

    try {
      const tx = await this.nftContract.mint(originalCreator, URI);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error: any) {
      this.error(
        'Error minting domain NFT, check you are the owner of the contract, or have minter role'
      );
      return null;
    }
  }

  // Logging methods
  log(...args: any[]) {
    if (this.develop) console.log(...args);
  }

  warn(...args: any[]) {
    if (this.develop) console.warn(...args);
  }

  error(...args: any[]) {
    if (this.develop) console.error(...args);
  }

  // Set develop mode on/off
  setDevelopMode(enabled: boolean) {
    this.develop = !!enabled;
    this.warn(`Develop mode set to ${this.develop}`);
  }
}
