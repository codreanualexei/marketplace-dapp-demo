import { ethers } from 'ethers';

// Types matching existing interfaces
export interface TokenData {
  creator: string;
  mintTimestamp: number;
  uri: string;
  lastPrice: string;
  lastPriceTimestamp: string;
}

export interface FormattedToken extends TokenData {
  tokenId: number;
  image?: string;
  metadata?: any;
  royaltyBalance?: string;
  splitterAddress?: string;
  owner?: string;
  domainName?: string;
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

// GraphQL query types
interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

interface TokenEntity {
  id: string;
  tokenId: string;
  owner: { id: string };
  creator: { id: string };
  tokenURI: string;
  domainName: string;
  mintedAt: string;
  lastSalePrice: string | null;
  lastSaleAt: string | null;
  royaltySplitter: {
    id: string;
    ethBalance: string;
    creatorEthBalance: string;
    treasuryEthBalance: string;
  } | null;
}

interface ListingEntity {
  id: string;
  listingId: string;
  seller: { id: string };
  token: TokenEntity;
  tokenId: string;
  price: string;
  active: boolean;
  nft: string;
}

interface AccountEntity {
  id: string;
  tokens: Array<{ id: string; tokenId: string }>;
}

export class SubgraphService {
  private subgraphUrl: string;
  private nftContractAddress: string;
  private marketplaceContractAddress: string;

  constructor(
    subgraphUrl: string,
    nftContractAddress: string,
    marketplaceContractAddress: string
  ) {
    this.subgraphUrl = subgraphUrl;
    this.nftContractAddress = nftContractAddress.toLowerCase();
    this.marketplaceContractAddress = marketplaceContractAddress.toLowerCase();
  }

  /**
   * Execute a GraphQL query
   */
  private async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      const response = await fetch(this.subgraphUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const result: GraphQLResponse<T> = await response.json();

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
      }

      return result.data;
    } catch (error) {
      console.error('Subgraph query error:', error);
      throw error;
    }
  }

  /**
   * Get all tokens in the collection
   */
  async getAllCollectionNFTs(first: number = 1000, skip: number = 0): Promise<FormattedToken[]> {
    const query = `
      query GetTokens($first: Int!, $skip: Int!) {
        tokens(
          first: $first,
          skip: $skip,
          orderBy: tokenId,
          orderDirection: asc
        ) {
          id
          tokenId
          owner {
            id
          }
          creator {
            id
          }
          tokenURI
          domainName
          mintedAt
          lastSalePrice
          lastSaleAt
          royaltySplitter {
            id
            ethBalance
            creatorEthBalance
            treasuryEthBalance
          }
        }
      }
    `;

    const result = await this.query<{ tokens: TokenEntity[] }>(query, { first, skip });
    return result.tokens.map((entity) => this.mapTokenEntityToFormattedToken(entity));
  }

  /**
   * Get tokens owned by a specific address
   */
  async getOwnedNFTs(ownerAddress: string, first: number = 1000, skip: number = 0): Promise<FormattedToken[]> {
    try {
      // Query tokens directly by owner address
      // Note: owner is a relation to Account, so we filter by Account ID (which is the address)
      const query = `
        query GetOwnedTokens($owner: ID!, $first: Int!, $skip: Int!) {
          tokens(
            where: { owner: $owner },
            first: $first,
            skip: $skip,
            orderBy: tokenId,
            orderDirection: asc
          ) {
            id
            tokenId
            owner {
              id
            }
            creator {
              id
            }
            tokenURI
            domainName
            mintedAt
            lastSalePrice
            lastSaleAt
            royaltySplitter {
              id
              ethBalance
              creatorEthBalance
              treasuryEthBalance
            }
          }
        }
      `;

      const normalizedAddress = ownerAddress.toLowerCase();
      console.log(`[SubgraphService] Fetching owned NFTs for: ${normalizedAddress}`);
      
      const result = await this.query<{ tokens: TokenEntity[] }>(
        query,
        { owner: normalizedAddress, first, skip }
      );

      const tokens = result.tokens.map((entity) => this.mapTokenEntityToFormattedToken(entity));
      console.log(`[SubgraphService] Found ${tokens.length} owned NFTs`);
      return tokens;
    } catch (error) {
      console.error('[SubgraphService] Error fetching owned NFTs:', error);
      throw error;
    }
  }

  /**
   * Get tokens created by a specific address (creator)
   */
  async getCreatedTokens(creatorAddress: string, first: number = 1000, skip: number = 0): Promise<FormattedToken[]> {
    try {
      // Query tokens directly by creator address
      const query = `
        query GetCreatedTokens($creator: ID!, $first: Int!, $skip: Int!) {
          tokens(
            where: { creator: $creator },
            first: $first,
            skip: $skip,
            orderBy: tokenId,
            orderDirection: asc
          ) {
            id
            tokenId
            owner {
              id
            }
            creator {
              id
            }
            tokenURI
            domainName
            mintedAt
            lastSalePrice
            lastSaleAt
            royaltySplitter {
              id
              ethBalance
              creatorEthBalance
              treasuryEthBalance
            }
          }
        }
      `;

      const normalizedAddress = creatorAddress.toLowerCase();
      console.log(`[SubgraphService] Fetching created tokens for: ${normalizedAddress}`);
      
      const result = await this.query<{ tokens: TokenEntity[] }>(
        query,
        { creator: normalizedAddress, first, skip }
      );

      const tokens = result.tokens.map((entity) => this.mapTokenEntityToFormattedToken(entity));
      console.log(`[SubgraphService] Found ${tokens.length} created tokens`);
      return tokens;
    } catch (error) {
      console.error('[SubgraphService] Error fetching created tokens:', error);
      throw error;
    }
  }

  /**
   * Get a specific token by tokenId
   */
  async getToken(tokenId: number): Promise<FormattedToken | null> {
    const query = `
      query GetToken($tokenId: ID!) {
        token(id: $tokenId) {
          id
          tokenId
          owner {
            id
          }
          creator {
            id
          }
          tokenURI
          domainName
          mintedAt
          lastSalePrice
          lastSaleAt
          royaltySplitter {
            id
            ethBalance
            creatorEthBalance
            treasuryEthBalance
          }
        }
      }
    `;

    const result = await this.query<{ token: TokenEntity | null }>(query, { tokenId: tokenId.toString() });
    
    if (!result.token) {
      return null;
    }

    return this.mapTokenEntityToFormattedToken(result.token);
  }

  /**
   * Get all active listings
   */
  async getActiveListings(first: number = 1000, skip: number = 0): Promise<ListedToken[]> {
    const query = `
      query GetActiveListings($first: Int!, $skip: Int!, $marketplace: ID!) {
        listings(
          first: $first,
          skip: $skip,
          where: {
            marketplace: $marketplace,
            active: true
          },
          orderBy: createdAt,
          orderDirection: desc
        ) {
          id
          listingId
          seller {
            id
          }
          token {
            id
            tokenId
            owner {
              id
            }
            creator {
              id
            }
            tokenURI
            domainName
            mintedAt
            lastSalePrice
            lastSaleAt
            royaltySplitter {
              id
              ethBalance
              creatorEthBalance
              treasuryEthBalance
            }
          }
          tokenId
          price
          active
          nft
        }
      }
    `;

    const result = await this.query<{ listings: ListingEntity[] }>(
      query,
      { first, skip, marketplace: this.marketplaceContractAddress }
    );

    return result.listings.map((entity) => this.mapListingEntityToListedToken(entity));
  }

  /**
   * Get listings by seller
   */
  async getListingsBySeller(sellerAddress: string, activeOnly: boolean = true): Promise<ListedToken[]> {
    const query = `
      query GetListingsBySeller($seller: ID!, $marketplace: ID!, $active: Boolean!) {
        listings(
          where: {
            seller: $seller,
            marketplace: $marketplace,
            active: $active
          },
          orderBy: createdAt,
          orderDirection: desc
        ) {
          id
          listingId
          seller {
            id
          }
          token {
            id
            tokenId
            owner {
              id
            }
            creator {
              id
            }
            tokenURI
            domainName
            mintedAt
            lastSalePrice
            lastSaleAt
            royaltySplitter {
              id
              ethBalance
              creatorEthBalance
              treasuryEthBalance
            }
          }
          tokenId
          price
          active
          nft
        }
      }
    `;

    const result = await this.query<{ listings: ListingEntity[] }>(
      query,
      {
        seller: sellerAddress.toLowerCase(),
        marketplace: this.marketplaceContractAddress,
        active: activeOnly,
      }
    );

    return result.listings.map((entity) => this.mapListingEntityToListedToken(entity));
  }

  /**
   * Get active listing count
   * Since GraphQL doesn't have a count query, we fetch in batches and count
   */
  async getActiveListingCount(): Promise<number> {
    try {
      // Fetch listings in batches of 1000 (max allowed) and count
      let totalCount = 0;
      let skip = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.getActiveListings(batchSize, skip);
        totalCount += batch.length;
        
        // If we got less than batchSize, we've reached the end
        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          skip += batchSize;
        }
      }

      return totalCount;
    } catch (error) {
      console.error('[SubgraphService] Error counting listings:', error);
      // Fallback: try to get at least the first batch
      try {
        const firstBatch = await this.getActiveListings(1000, 0);
        return firstBatch.length;
      } catch (fallbackError) {
        console.error('[SubgraphService] Fallback count also failed:', fallbackError);
        return 0;
      }
    }
  }

  /**
   * Get paginated active listings
   */
  async getActiveListingsPage(page: number, pageSize: number): Promise<ListedToken[]> {
    const skip = (page - 1) * pageSize;
    return this.getActiveListings(pageSize, skip);
  }

  /**
   * Get royalty splitter balances for a creator
   */
  async getSplitterBalances(creatorAddress: string): Promise<Array<{ splitter: string; balance: string }>> {
    const query = `
      query GetSplitterBalances($creator: ID!) {
        account(id: $creator) {
          createdTokens {
            royaltySplitter {
              id
              ethBalance
              creatorEthBalance
              treasuryEthBalance
            }
          }
        }
      }
    `;

    const result = await this.query<{
      account: {
        createdTokens: Array<{
          royaltySplitter: {
            id: string;
            ethBalance: string;
            creatorEthBalance: string;
            treasuryEthBalance: string;
          } | null;
        }>;
      } | null;
    }>(query, { creator: creatorAddress.toLowerCase() });

    if (!result.account) {
      return [];
    }

    const balances: Array<{ splitter: string; balance: string }> = [];
    const seenSplitters = new Set<string>();

    for (const token of result.account.createdTokens) {
      if (token.royaltySplitter && !seenSplitters.has(token.royaltySplitter.id)) {
        seenSplitters.add(token.royaltySplitter.id);
        // Format balance from wei to ether
        const balanceWei = BigInt(token.royaltySplitter.creatorEthBalance || '0');
        const balanceEther = ethers.formatEther(balanceWei);
        balances.push({
          splitter: token.royaltySplitter.id,
          balance: balanceEther,
        });
      }
    }

    return balances;
  }

  /**
   * Map TokenEntity to FormattedToken
   */
  private mapTokenEntityToFormattedToken(entity: TokenEntity): FormattedToken {
    // Resolve IPFS URL if needed
    let resolvedURI = entity.tokenURI;
    if (resolvedURI && resolvedURI.startsWith('ipfs://')) {
      const ipfsHash = resolvedURI.replace('ipfs://', '');
      resolvedURI = `https://ipfs.io/ipfs/${ipfsHash}`;
    }

    // Format royalty balance from wei to ether if splitter exists
    let royaltyBalance = '0';
    if (entity.royaltySplitter && entity.royaltySplitter.creatorEthBalance) {
      const balanceWei = BigInt(entity.royaltySplitter.creatorEthBalance);
      royaltyBalance = ethers.formatEther(balanceWei);
    }

    return {
      tokenId: parseInt(entity.tokenId),
      owner: entity.owner.id,
      creator: entity.creator.id,
      uri: resolvedURI,
      domainName: entity.domainName,
      mintTimestamp: parseInt(entity.mintedAt),
      lastPrice: entity.lastSalePrice || '0',
      lastPriceTimestamp: entity.lastSaleAt || '0',
      splitterAddress: entity.royaltySplitter?.id,
      royaltyBalance: royaltyBalance,
    };
  }

  /**
   * Map ListingEntity to ListedToken
   */
  private mapListingEntityToListedToken(entity: ListingEntity): ListedToken {
    return {
      listingId: parseInt(entity.listingId),
      active: entity.active,
      seller: entity.seller.id,
      tokenId: parseInt(entity.tokenId),
      price: ethers.formatEther(entity.price),
      strCollectionAddress: entity.nft,
      tokenData: this.mapTokenEntityToFormattedToken(entity.token),
    };
  }
}

