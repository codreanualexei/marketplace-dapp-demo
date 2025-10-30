import { Alchemy, Network, Nft, NftContract, OwnedNft, AssetTransfersCategory } from 'alchemy-sdk';
import { ethers } from 'ethers';

// Types to match existing interfaces
export interface AlchemyTokenData {
  creator: string;
  mintTimestamp: number;
  uri: string;
  lastPrice: string;
  lastPriceTimestamp: string;
}

export interface AlchemyFormattedToken extends AlchemyTokenData {
  tokenId: number;
  image?: string;
  metadata?: any;
  royaltyBalance?: string;
  splitterAddress?: string;
}

export interface AlchemyListedToken {
  listingId: number;
  active: boolean;
  seller: string;
  tokenId: number;
  price: string;
  strCollectionAddress: string;
  tokenData?: AlchemyFormattedToken;
}

export class AlchemyService {
  private alchemy: Alchemy;
  private nftContractAddress: string;
  private marketplaceContractAddress: string;
  private network: Network;
  private apiKey: string;

  constructor(
    apiKey: string,
    nftContractAddress: string,
    marketplaceContractAddress: string,
    chainId: number = 80002 // Polygon Amoy default
  ) {
    this.apiKey = apiKey;
    this.nftContractAddress = nftContractAddress.toLowerCase();
    this.marketplaceContractAddress = marketplaceContractAddress.toLowerCase();
    
    // Map chain ID to Alchemy network
    this.network = this.getNetworkFromChainId(chainId);

    this.alchemy = new Alchemy({
      apiKey,
      network: this.network,
    });
  }

  private getNetworkFromChainId(chainId: number): Network {
    switch (chainId) {
      case 1:
        return Network.ETH_MAINNET;
      case 5:
        return Network.ETH_GOERLI;
      case 11155111:
        return Network.ETH_SEPOLIA;
      case 137:
        return Network.MATIC_MAINNET;
      case 80002:
        return Network.MATIC_AMOY;
      default:
        return Network.MATIC_AMOY; // Default to Polygon Amoy
    }
  }

  /**
   * Get Alchemy provider for contract calls
   */
  getProvider() {
    // Create an ethers provider using Alchemy's RPC URL
    const alchemyRpcUrl = `https://polygon-amoy.g.alchemy.com/v2/${this.apiKey}`;
    return new ethers.JsonRpcProvider(alchemyRpcUrl);
  }

  /**
   * Get contracts deployed by a specific creator address
   * This uses Alchemy's asset transfers API to find contract creations
   */
  async getContractsByCreator(creatorAddress: string): Promise<string[]> {
    try {
      console.log(`Searching for contracts deployed by ${creatorAddress}...`);
      
      // Use Alchemy's asset transfers to find contract creation transactions
      const transfers = await this.alchemy.core.getAssetTransfers({
        fromAddress: creatorAddress,
        category: [AssetTransfersCategory.ERC721, AssetTransfersCategory.ERC1155], // NFT contracts
        excludeZeroValue: true,
        withMetadata: true,
        maxCount: 1000, // Adjust based on needs
      });

      const contracts: string[] = [];
      
      // Look for contract creation transactions
      for (const transfer of transfers.transfers) {
        if (transfer.rawContract?.address) {
          // Check if this is a contract creation (to address is null)
          if (!transfer.to) {
            contracts.push(transfer.rawContract.address);
            console.log(`Found contract deployed: ${transfer.rawContract.address}`);
          }
        }
      }

      console.log(`Found ${contracts.length} contracts deployed by ${creatorAddress}`);
      return contracts;
    } catch (error) {
      console.error("Error finding contracts by creator:", error);
      return [];
    }
  }

  /**
   * Enhanced method to find splitter contracts by creator
   * This combines multiple approaches for better discovery
   */
  async getSplitterContractsByCreator(creatorAddress: string): Promise<string[]> {
    try {
      console.log(`Searching for splitter contracts by creator ${creatorAddress}...`);
      
      // Method 1: Get all contracts deployed by creator
      const deployedContracts = await this.getContractsByCreator(creatorAddress);
      
      // Method 2: Filter for potential splitter contracts
      // (This would require checking contract bytecode or known patterns)
      const potentialSplitters: string[] = [];
      
      // For now, we'll return the deployed contracts
      // In a real implementation, you'd check each contract's bytecode
      // to identify if it's a royalty splitter contract
      
      console.log(`Found ${potentialSplitters.length} potential splitter contracts`);
      return potentialSplitters;
    } catch (error) {
      console.error("Error finding splitter contracts by creator:", error);
      return [];
    }
  }

  /**
   * Get all NFTs owned by a specific address from the collection
   */
  async getOwnedNFTs(ownerAddress: string, pageSize: number = 100): Promise<AlchemyFormattedToken[]> {
    try {
      console.log(`Fetching NFTs owned by ${ownerAddress} from collection ${this.nftContractAddress}`);
      
      const response = await this.alchemy.nft.getNftsForOwner(ownerAddress, {
        contractAddresses: [this.nftContractAddress],
        pageSize,
      });

      const formattedTokens: AlchemyFormattedToken[] = [];

      for (const nft of response.ownedNfts) {
        try {
          const tokenData = await this.getTokenDataFromAlchemy(nft);
          if (tokenData) {
            formattedTokens.push(tokenData);
          }
        } catch (error) {
          console.warn(`Failed to get token data for token ${nft.tokenId}:`, error);
        }
      }

      console.log(`Found ${formattedTokens.length} NFTs owned by ${ownerAddress}`);
      return formattedTokens;
    } catch (error) {
      console.error('Error fetching owned NFTs:', error);
      return [];
    }
  }

  /**
   * Get all NFTs in the collection (for browsing)
   */
  async getAllCollectionNFTs(pageSize: number = 100): Promise<AlchemyFormattedToken[]> {
    try {
      console.log(`Fetching all NFTs from collection ${this.nftContractAddress}`);
      
      const response = await this.alchemy.nft.getNftsForContract(this.nftContractAddress, {
        pageSize,
      });

      const formattedTokens: AlchemyFormattedToken[] = [];

      for (const nft of response.nfts) {
        try {
          const tokenData = await this.getTokenDataFromAlchemy(nft);
          if (tokenData) {
            formattedTokens.push(tokenData);
          }
        } catch (error) {
          console.warn(`Failed to get token data for token ${nft.tokenId}:`, error);
        }
      }

      console.log(`Found ${formattedTokens.length} NFTs in collection`);
      return formattedTokens;
    } catch (error) {
      console.error('Error fetching collection NFTs:', error);
      return [];
    }
  }

  /**
   * Get specific token data from Alchemy NFT object
   */
  private async getTokenDataFromAlchemy(nft: Nft | OwnedNft): Promise<AlchemyFormattedToken | null> {
    try {
      const tokenId = parseInt(nft.tokenId);
      
      // Get metadata
      const metadata = await this.alchemy.nft.getNftMetadata(
        this.nftContractAddress,
        nft.tokenId
      );

      // For now, we'll use placeholder data since we need contract-specific data
      // In a real implementation, you'd need to call the contract methods for:
      // - creator address
      // - mint timestamp
      // - last price
      // - last price timestamp
      
      // Best-effort image extraction from available fields
      const resolveIpfs = (url?: string): string | undefined => {
        if (!url) return undefined;
        if (url.startsWith("ipfs://")) {
          const path = url.replace("ipfs://", "");
          return `https://ipfs.io/ipfs/${path}`;
        }
        return url;
      };

      // Try multiple locations for image URL from both the NFT object and fetched metadata
      const imageFromNft = (nft as any)?.image?.cachedUrl
        || (nft as any)?.image?.originalUrl
        || (nft as any)?.media?.[0]?.gateway
        || (nft as any)?.media?.[0]?.thumbnail
        || (nft as any)?.media?.[0]?.raw;

      const imageFromMetadata = (metadata as any)?.image?.cachedUrl
        || (metadata as any)?.image?.originalUrl
        || (metadata as any)?.image?.pngUrl
        || (metadata as any)?.image?.url
        || (metadata as any)?.raw?.image
        || (metadata as any)?.rawMetadata?.image
        || (metadata as any)?.tokenUri?.gateway
        || (metadata as any)?.tokenUri?.raw;

      const resolvedImage = resolveIpfs(imageFromNft) || resolveIpfs(imageFromMetadata);

      const tokenData: AlchemyFormattedToken = {
        tokenId,
        creator: '0x0000000000000000000000000000000000000000', // Will be replaced by contract data
        mintTimestamp: Math.floor(Date.now() / 1000), // Will be replaced by contract data
        uri: (metadata.tokenUri as any)?.raw || (metadata as any)?.tokenUri || '',
        lastPrice: '0', // Will be replaced by contract data
        lastPriceTimestamp: '0', // Will be replaced by contract data
        image: resolvedImage,
        metadata,
      };

      return tokenData;
    } catch (error) {
      console.error(`Error processing token ${nft.tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get NFT metadata for a specific token
   */
  async getTokenMetadata(tokenId: number): Promise<any> {
    try {
      const metadata = await this.alchemy.nft.getNftMetadata(
        this.nftContractAddress,
        tokenId.toString()
      );
      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get collection metadata
   */
  async getCollectionMetadata(): Promise<NftContract | null> {
    try {
      const contract = await this.alchemy.nft.getContractMetadata(this.nftContractAddress);
      return contract;
    } catch (error) {
      console.error('Error fetching collection metadata:', error);
      return null;
    }
  }

  /**
   * Search for NFTs by name or description
   */
  async searchNFTs(query: string, pageSize: number = 50): Promise<AlchemyFormattedToken[]> {
    try {
      // Note: Alchemy's search functionality might be limited on testnets
      // This is a placeholder implementation
      console.log(`Searching for NFTs with query: ${query}`);
      
      const allNFTs = await this.getAllCollectionNFTs(pageSize);
      
      // Simple text search on metadata
      const filteredNFTs = allNFTs.filter(nft => {
        // This would need to be enhanced with actual metadata search
        return nft.tokenId.toString().includes(query);
      });

      return filteredNFTs;
    } catch (error) {
      console.error('Error searching NFTs:', error);
      return [];
    }
  }

  /**
   * Get transfer history for a specific NFT
   */
  async getTransferHistory(tokenId: number): Promise<any[]> {
    try {
      const transfers = await this.alchemy.core.getAssetTransfers({
        fromBlock: '0x0',
        toAddress: this.nftContractAddress,
        category: ['erc721' as any],
        withMetadata: true,
        excludeZeroValue: true,
      });

      // Filter transfers for this specific token
      const tokenTransfers = transfers.transfers.filter(transfer => 
        transfer.tokenId === tokenId.toString()
      );

      return tokenTransfers;
    } catch (error) {
      console.error(`Error fetching transfer history for token ${tokenId}:`, error);
      return [];
    }
  }

  /**
   * Get recent activity for the collection
   */
  async getRecentActivity(limit: number = 20): Promise<any[]> {
    try {
      const transfers = await this.alchemy.core.getAssetTransfers({
        fromBlock: '0x0',
        toAddress: this.nftContractAddress,
        category: ['erc721' as any],
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: limit,
      });

      return transfers.transfers;
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  }
}
