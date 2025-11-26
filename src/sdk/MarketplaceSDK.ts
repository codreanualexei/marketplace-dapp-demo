import { ethers } from "ethers";
import { SubgraphService, FormattedToken, ListedToken } from "../services/SubgraphService";
import MarketplaceJSON from "../contracts/abis/Marketplace.json";
import StrDomainsNFTJSON from "../contracts/abis/StrDomainsNFT.json";
import RoyaltySplitterJSON from "../contracts/abis/RoyaltySplitter.json";
import { NETWORK_CONFIG, getWalletNetworkConfig, validateNetworkConfig } from "../config/network";
import {
  parseAllEvents,
  ParsedPurchasedEvent,
  ParsedListedEvent,
  ParsedListingUpdatedEvent,
  ParsedListingCanceledEvent,
  ParsedFeeWithdrawnEvent,
  ParsedApprovalEvent,
  ParsedTransferEvent,
  ParsedMintedEvent,
} from "../utils/eventParser";

// Extract ABIs from Hardhat artifact JSON files
const MarketplaceABI = MarketplaceJSON.abi;
const StrDomainsNFTABI = StrDomainsNFTJSON.abi;
const RoyaltySplitterABI = RoyaltySplitterJSON.abi;

// Re-export types for compatibility
export type { FormattedToken, ListedToken };


export interface Listing {
  seller: string;
  nft: string;
  tokenId: bigint;
  price: bigint;
  active: boolean;
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
  private marketplaceContractWrite: ethers.Contract; // For write operations
  private nftContractWrite: ethers.Contract; // For write operations
  private subgraphService: SubgraphService;
  private develop: boolean;
  public collectionCountTokens?: number;
  private cachedActiveListingCount?: number;

  constructor(
    signer: ethers.Signer,
    marketplaceAddress: string,
    nftAddress: string,
    subgraphUrl: string,
    develop: boolean = false,
  ) {
    this.develop = develop;
    
    // Validate network configuration on initialization
    try {
      validateNetworkConfig();
      this.log(`🌐 Network configuration: ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId})`);
    } catch (error) {
      console.error("❌ Network configuration error:", error);
      throw new Error(`Network configuration error: ${error}`);
    }
    
    this.signer = signer;
    this.provider = signer.provider!;
    this.marketplaceAddress = marketplaceAddress;
    this.nftAddress = nftAddress;

    // Initialize Subgraph service
    this.subgraphService = new SubgraphService(
      subgraphUrl,
      nftAddress,
      marketplaceAddress
    );

    // Create contract instances using provider for read operations
    // Use signer only for write operations (transactions)
    this.marketplaceContract = new ethers.Contract(
      marketplaceAddress,
      MarketplaceABI,
      this.provider,
    );
    this.nftContract = new ethers.Contract(
      nftAddress,
      StrDomainsNFTABI,
      this.provider,
    );

    // For write operations, use signer (for transactions)
    this.marketplaceContractWrite = new ethers.Contract(
      marketplaceAddress,
      MarketplaceABI,
      signer,
    );
    this.nftContractWrite = new ethers.Contract(
      nftAddress,
      StrDomainsNFTABI,
      signer,
    );
  }

  // Update signer when wallet changes
  updateSigner(signer: ethers.Signer) {
    this.signer = signer;
    this.provider = signer.provider!;
    
    // For read operations, use provider
    this.marketplaceContract = new ethers.Contract(
      this.marketplaceAddress,
      MarketplaceABI,
      this.provider,
    );
    this.nftContract = new ethers.Contract(
      this.nftAddress,
      StrDomainsNFTABI,
      this.provider,
    );

    // For write operations, use signer (for transactions) - this is the wallet provider
    this.marketplaceContractWrite = new ethers.Contract(
      this.marketplaceAddress,
      MarketplaceABI,
      signer, // This uses the wallet provider (WalletConnect/MetaMask)
    );
    this.nftContractWrite = new ethers.Contract(
      this.nftAddress,
      StrDomainsNFTABI,
      signer, // This uses the wallet provider (WalletConnect/MetaMask)
    );
  }

  // Buy a listed token
  async buyToken(listingId: number): Promise<string | null> {
    try {
      // Get listing details using read contract
      const listing = await this.marketplaceContract.getListing(listingId);
      const { price, active } = listing;

      if (!active) {
        this.warn("This listing is not active.");
        return null;
      }

      // Additional validation: Check if the marketplace actually holds the NFT
      const nftOwner = await this.nftContract.ownerOf(listing.tokenId);
      
      if (nftOwner.toLowerCase() !== this.marketplaceAddress.toLowerCase()) {
        this.error(`NFT is not held by marketplace. Owner: ${nftOwner}, Marketplace: ${this.marketplaceAddress}`);
        throw new Error("This listing is no longer valid. The NFT is not held by the marketplace.");
      }

      // Check if user is trying to buy their own listing
      const userAddress = await this.signer.getAddress();
      if (listing.seller.toLowerCase() === userAddress.toLowerCase()) {
        this.error(`User is trying to buy their own listing. Seller: ${listing.seller}, Buyer: ${userAddress}`);
        throw new Error("You cannot buy your own listing.");
      }

      // Additional validation: Check royalty info to see if there might be issues
      try {
        const royaltyInfo = await this.nftContract.royaltyInfo(listing.tokenId, price);
        // Check if royalty receiver is a valid address
        if (royaltyInfo[0] === '0x0000000000000000000000000000000000000000' && royaltyInfo[1] > 0) {
          this.warn("Royalty receiver is zero address but royalty amount > 0 - this might cause issues");
        }
      } catch (royaltyError) {
        // Silently continue - royalty info is optional
      }

      // Check if user has sufficient balance (read operation)
      const userBalance = await this.provider.getBalance(userAddress);
      if (userBalance < price) {
        this.error(`Insufficient balance. Required: ${ethers.formatEther(price)} MATIC, Available: ${ethers.formatEther(userBalance)} MATIC`);
        throw new Error(`Insufficient balance. You need ${ethers.formatEther(price)} MATIC but only have ${ethers.formatEther(userBalance)} MATIC.`);
      }

      // Estimate gas first using wallet provider (needs to simulate transaction)
      let gasEstimate;
      try {
        gasEstimate = await this.marketplaceContractWrite.buy.estimateGas(listingId, {
          value: price,
        });
      } catch (gasError: any) {
        // If gas estimation fails, use a more generous default gas limit
        // The buy function involves multiple operations: royalty payment, seller payment, NFT transfer, sale recording
        // Use a higher default to ensure transaction success
        gasEstimate = BigInt(1000000); // Increased default gas limit for complex buy operation
        this.warn(`Using default gas limit: ${gasEstimate.toString()} due to estimation failure`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(gasEstimate, 'buy');
      
      // Send transaction with optimal gas settings using wallet provider (for signing)
      // The contract requires exact amount: require(msg.value == L.price, "bad value");
      const tx = await this.marketplaceContractWrite.buy(listingId, {
        value: price, // Exact amount required by contract
        ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
      });

      // Wait for transaction with longer timeout for WalletConnect
      // WalletConnect transactions can take longer, so we increase the timeout
      let receipt;
      try {
        receipt = await Promise.race([
          tx.wait(2), // Wait for 2 confirmations
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Transaction timeout after 5 minutes")), 5 * 60 * 1000)
          )
        ]);
      } catch (waitError: any) {
        this.error("Error waiting for transaction confirmation:", waitError);
        
        // If waiting fails, try to get the transaction status directly
        try {
          const txStatus = await this.signer.provider!.getTransactionReceipt(tx.hash);
          if (txStatus) {
            receipt = txStatus;
          } else {
            // Transaction might still be pending
            const txDetails = await this.signer.provider!.getTransaction(tx.hash);
            if (txDetails && txDetails.blockNumber) {
              // Transaction is confirmed, try to get receipt again
              receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
            } else {
              throw new Error("Transaction is still pending or failed");
            }
          }
        } catch (directError: any) {
          this.error("Could not get transaction status directly:", directError);
          
          // Final fallback: Check if the NFT ownership changed (transaction succeeded)
          try {
            const userAddress = await this.signer.getAddress();
            const newOwner = await this.nftContract.ownerOf(listing.tokenId);
            
            if (newOwner.toLowerCase() === userAddress.toLowerCase()) {
              // Return the transaction hash even though we couldn't get the receipt
              return tx.hash;
            } else {
              this.error(`NFT ownership verification failed. Expected: ${userAddress}, Got: ${newOwner}`);
              throw new Error("Transaction confirmation failed and NFT ownership verification failed.");
            }
          } catch (ownershipError: any) {
            this.error("NFT ownership verification error:", ownershipError);
            throw new Error("Transaction confirmation failed. Please check your wallet or try again.");
          }
        }
      }

      if (!receipt) {
        throw new Error("Transaction receipt not received");
      }

      // Check if transaction was successful
      if (receipt.status === 0) {
        this.error("Transaction failed on blockchain");
        throw new Error("Transaction failed on blockchain. Check the logs for details.");
      }

      this.log(`✅ Purchase successful! Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      this.error("Error purchasing token:", error);
      this.error("Error details:", {
        message: error.message,
        code: error.code,
        reason: error.reason,
        transaction: error.transaction,
        receipt: error.receipt
      });
      
      // Provide more detailed error messages
      if (error.message?.includes("insufficient funds")) {
        throw new Error("Insufficient funds for transaction. Please check your wallet balance.");
      } else if (error.message?.includes("user rejected")) {
        throw new Error("Transaction was rejected by user.");
      } else if (error.message?.includes("gas")) {
        throw new Error("Gas estimation failed. Please try again or increase gas limit.");
      } else if (error.message?.includes("network") || error.code === 'NETWORK_ERROR') {
        throw new Error(error);
      } else if (error.message?.includes("timeout")) {
        throw new Error("Transaction timeout. The transaction may still be processing. Please check your wallet or try again.");
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error("Gas estimation failed. Please try again with a higher gas limit.");
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error("Insufficient funds for transaction. Please check your wallet balance.");
      } else if (error.code === 'USER_REJECTED') {
        throw new Error("Transaction was rejected by user.");
      } else {
        throw new Error(`Purchase failed: ${error.message || "Unknown error"}`);
      }
    }
  }

  /**
   * Buy token with receipt and parsed events (for optimistic updates)
   */
  async buyTokenWithReceipt(listingId: number): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    purchasedEvent: ParsedPurchasedEvent | null;
    transfers: ParsedTransferEvent[];
  }> {
    try {
      const txHash = await this.buyToken(listingId);
      if (!txHash) {
        throw new Error("Transaction failed");
      }

      // Get receipt
      const receipt = await this.signer.provider!.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error("Could not get transaction receipt");
      }

      // Parse events
      const events = parseAllEvents(receipt, this.marketplaceAddress, this.nftAddress);

      return {
        txHash,
        receipt,
        purchasedEvent: events.purchased || null,
        transfers: events.transfers || [],
      };
    } catch (error: any) {
      this.error("Error in buyTokenWithReceipt:", error);
      throw error;
    }
  }

  // Update a listed token price
  async updateListing(
    listingId: number,
    newPrice: string,
  ): Promise<string | null> {
    try {
      this.log(`Updating listing ${listingId} with new price ${newPrice} MATIC...`);
      
      // Wait for network stability before updating
      await this.ensureCorrectNetwork();
      
      // Get the listing details first
      const listing = await this.marketplaceContract.getListing(listingId);
      
      if (!listing.active) {
        throw new Error("This listing is no longer active and cannot be updated.");
      }

      // Check if the user is the seller
      const userAddress = await this.signer.getAddress();
      if (listing.seller.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error("You can only update your own listings.");
      }

      // Estimate gas for update transaction with fallback
      let gasEstimate;
      try {
        this.log("Attempting gas estimation for update...");
        gasEstimate = await this.marketplaceContractWrite.updateListing.estimateGas(
          listingId,
          ethers.parseEther(newPrice),
        );
        this.log(`Update gas estimate successful: ${gasEstimate.toString()}`);
      } catch (gasError: any) {
        this.error("Update gas estimation failed:", gasError);
        if (gasError.message?.includes("network changed")) {
          throw new Error("Network changed during gas estimation. Please try again.");
        }
        gasEstimate = BigInt(100000); // Default gas limit for update
        this.warn(`Using default gas limit for update: ${gasEstimate.toString()}`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(gasEstimate, 'update');
      
      this.log(`Sending update transaction with gas limit: ${gasSettings.gasLimit.toString()}`);
      
      const tx = await this.marketplaceContractWrite.updateListing(
        listingId,
        ethers.parseEther(newPrice),
        {
          ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
        }
      );
      
      this.log(`Update transaction sent: ${tx.hash}`);
      this.log("Waiting for update confirmation...");
      
      // Wait for transaction with robust confirmation handling
      let receipt;
      try {
        this.log("Waiting for update transaction confirmation...");
        receipt = await tx.wait(2); // Wait for 2 confirmations
        this.log(`Update transaction confirmed in block ${receipt.blockNumber}`);
      } catch (waitError: any) {
        this.warn("Standard wait failed, trying alternative confirmation methods...");
        
        // Try direct receipt lookup
        try {
          this.log("Attempting direct receipt lookup...");
          receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
          if (receipt) {
            this.log(`Found receipt via direct lookup: ${receipt.blockNumber}`);
          }
        } catch (receiptError) {
          this.warn("Direct receipt lookup failed:", receiptError);
        }
        
        // If still no receipt, try checking transaction status
        if (!receipt) {
          try {
            this.log("Checking transaction status...");
            const txStatus = await this.signer.provider!.getTransaction(tx.hash);
            if (txStatus && txStatus.blockNumber) {
              this.log(`Transaction included in block: ${txStatus.blockNumber}`);
              // Try to get receipt again
              receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
            }
          } catch (statusError) {
            this.warn("Transaction status check failed:", statusError);
          }
        }
        
        // Final fallback - assume success if we have the transaction hash
        if (!receipt) {
          this.warn("Could not get transaction receipt, but transaction was sent successfully");
          this.log(`Update transaction hash: ${tx.hash}`);
          return tx.hash;
        }
      }
      
      if (receipt) {
        this.log(`Listing ${listingId} updated successfully! Transaction: ${receipt.hash}`);
        this.log(`New price: ${newPrice} MATIC`);
        this.log(`Gas used: ${receipt.gasUsed.toString()}`);
        this.log(`Block number: ${receipt.blockNumber}`);
        return receipt.hash;
      } else {
        this.warn("No receipt found, but transaction was sent");
        return tx.hash;
      }
    } catch (error: any) {
      this.error(`Error updating listing ${listingId}:`, error);
      
      // Provide more specific error messages
      if (error.message?.includes("only update your own")) {
        throw new Error("You can only update your own listings.");
      } else if (error.message?.includes("no longer active")) {
        throw new Error("This listing is no longer active and cannot be updated.");
      } else if (error.message?.includes("user rejected")) {
        throw new Error("Update transaction was rejected by user.");
      } else if (error.message?.includes("network changed")) {
        throw new Error("Network is switching. Please wait for the network change to complete and try again.");
      } else if (error.message?.includes("switch to") || error.message?.includes("Chain ID:") || error.message?.includes("Failed to switch")) {
        throw new Error(`🔗 Please switch to ${NETWORK_CONFIG.name} network before updating. The system attempted to switch automatically but failed. Please manually switch to ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet.`);
      } else if (error.message?.includes("Internal JSON-RPC error") || error.code === "UNKNOWN_ERROR") {
        throw new Error("Network error during update. Please try again in a few moments.");
      } else if (error.message?.includes("network")) {
        throw new Error("Network error. Please check your connection and try again.");
      } else {
        throw new Error(`Failed to update listing: ${error.message || "Unknown error"}`);
      }
    }
  }

  /**
   * Update listing with receipt and parsed events (for optimistic updates)
   */
  async updateListingWithReceipt(listingId: number, newPrice: string): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    listingUpdatedEvent: ParsedListingUpdatedEvent | null;
  }> {
    try {
      const txHash = await this.updateListing(listingId, newPrice);
      if (!txHash) {
        throw new Error("Transaction failed");
      }

      // Get receipt
      const receipt = await this.signer.provider!.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error("Could not get transaction receipt");
      }

      // Parse events
      const events = parseAllEvents(receipt, this.marketplaceAddress, this.nftAddress);

      return {
        txHash,
        receipt,
        listingUpdatedEvent: events.listingUpdated || null,
      };
    } catch (error: any) {
      this.error("Error in updateListingWithReceipt:", error);
      throw error;
    }
  }

  // Check if a token is approved for marketplace
  async isTokenApprovedForMarketplace(tokenId: number): Promise<boolean> {
    try {
      const userAddress = await this.signer.getAddress();
      const currentApproval = await this.nftContract.getApproved(tokenId);
      const isApprovedForAll = await this.nftContract.isApprovedForAll(userAddress, this.marketplaceAddress);
      
      return currentApproval.toLowerCase() === this.marketplaceAddress.toLowerCase() || isApprovedForAll;
    } catch (error: any) {
      this.error(`Error checking approval status for token ${tokenId}:`, error);
      return false;
    }
  }

  /**
   * Batch check approval status for multiple tokens (optimized)
   * Checks isApprovedForAll once, then only checks individual tokens if needed
   */
  async batchCheckTokenApprovals(tokenIds: number[]): Promise<Record<number, boolean>> {
    try {
      if (tokenIds.length === 0) {
        return {};
      }

      const userAddress = await this.signer.getAddress();
      const approvalMap: Record<number, boolean> = {};

      // First, check if user has approved all tokens for marketplace (only one call needed)
      this.log(`Checking isApprovedForAll for ${tokenIds.length} tokens...`);
      const isApprovedForAll = await this.nftContract.isApprovedForAll(userAddress, this.marketplaceAddress);
      
      if (isApprovedForAll) {
        // If approved for all, all tokens are approved
        this.log(`User has approved all tokens for marketplace`);
        tokenIds.forEach(tokenId => {
          approvalMap[tokenId] = true;
        });
        return approvalMap;
      }

      // If not approved for all, check each token individually in parallel
      this.log(`Checking individual token approvals for ${tokenIds.length} tokens...`);
      const approvalPromises = tokenIds.map(async (tokenId) => {
        try {
          const currentApproval = await this.nftContract.getApproved(tokenId);
          const isApproved = currentApproval.toLowerCase() === this.marketplaceAddress.toLowerCase();
          return { tokenId, isApproved };
        } catch (error: any) {
          this.warn(`Error checking approval for token ${tokenId}:`, error);
          return { tokenId, isApproved: false };
        }
      });

      const results = await Promise.all(approvalPromises);
      results.forEach(({ tokenId, isApproved }) => {
        approvalMap[tokenId] = isApproved;
      });

      this.log(`Batch approval check completed for ${tokenIds.length} tokens`);
      return approvalMap;
    } catch (error: any) {
      this.error("Error in batch approval check:", error);
      // Return all false as fallback
      const approvalMap: Record<number, boolean> = {};
      tokenIds.forEach(tokenId => {
        approvalMap[tokenId] = false;
      });
      return approvalMap;
    }
  }

  // List a token on the marketplace (assumes token is already approved)
  async listTokenDirect(tokenId: number, price: string): Promise<string | null> {
    try {
      this.log(`Starting direct listing process for token ${tokenId} at price ${price} MATIC...`);
      
      // Check if user owns the token
      const userAddress = await this.signer.getAddress();
      const tokenOwner = await this.nftContract.ownerOf(tokenId);
      this.log(`Token owner: ${tokenOwner}, User address: ${userAddress}`);
      
      if (tokenOwner.toLowerCase() !== userAddress.toLowerCase()) {
        this.error(`User does not own token ${tokenId}. Owner: ${tokenOwner}, User: ${userAddress}`);
        throw new Error("Failed to list domain. Make sure you own it and it's not already listed.");
      }

      // Verify token is approved
      const isApproved = await this.isTokenApprovedForMarketplace(tokenId);
      if (!isApproved) {
        throw new Error("Token is not approved for marketplace. Please approve it first.");
      }

      // Now list the token
      this.log("Creating listing transaction...");
      
      // Wait for network stability before sending listing transaction
      await this.ensureCorrectNetwork();
      
      // Estimate gas for listing transaction with fallback
      let listingGasEstimate;
      try {
        this.log("Attempting gas estimation for listing...");
        listingGasEstimate = await this.marketplaceContractWrite.listToken.estimateGas(
          this.nftAddress,
          tokenId,
          ethers.parseEther(price),
        );
        this.log(`Listing gas estimate successful: ${listingGasEstimate.toString()}`);
      } catch (gasError: any) {
        this.error("Listing gas estimation failed:", gasError);
        if (gasError.message?.includes("network changed")) {
          throw new Error("Network changed during gas estimation. Please try again.");
        }
        listingGasEstimate = BigInt(500000); // Default gas limit for listing
        this.warn(`Using default gas limit for listing: ${listingGasEstimate.toString()}`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(listingGasEstimate, 'list');
      
      this.log(`Sending listing transaction with gas limit: ${gasSettings.gasLimit.toString()}`);
      
      const tx = await this.marketplaceContractWrite.listToken(
        this.nftAddress,
        tokenId,
        ethers.parseEther(price),
        {
          ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
        }
      );

      this.log(`Listing transaction sent: ${tx.hash}`);
      this.log("Waiting for listing confirmation...");
      
      // Wait for transaction with robust confirmation handling (same as buy function)
      let receipt;
      try {
        receipt = await Promise.race([
          tx.wait(2), // Wait for 2 confirmations
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Transaction timeout after 5 minutes")), 5 * 60 * 1000)
          )
        ]);
      } catch (waitError: any) {
        this.error("Error waiting for listing transaction confirmation:", waitError);
        
        // If waiting fails, try to get the transaction status directly
        try {
          this.log("Attempting to get listing transaction status directly...");
          const txStatus = await this.signer.provider!.getTransactionReceipt(tx.hash);
          if (txStatus) {
            receipt = txStatus;
            this.log("Got listing transaction receipt directly:", txStatus);
          } else {
            // Transaction might still be pending
            this.log("Listing transaction is still pending, checking status...");
            const txDetails = await this.signer.provider!.getTransaction(tx.hash);
            if (txDetails && txDetails.blockNumber) {
              // Transaction is confirmed, try to get receipt again
              receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
              this.log("Got listing receipt after confirmation:", receipt);
            } else {
              throw new Error("Listing transaction is still pending or failed");
            }
          }
        } catch (directError: any) {
          this.error("Could not get listing transaction status directly:", directError);
          
          // Final fallback: Check if the NFT is now held by marketplace (listing succeeded)
          try {
            this.log("Checking if NFT is now held by marketplace as fallback verification...");
            const newOwner = await this.nftContract.ownerOf(tokenId);
            
            if (newOwner.toLowerCase() === this.marketplaceAddress.toLowerCase()) {
              this.log("NFT ownership verification: Listing succeeded! Marketplace now holds the NFT.");
              // Return the transaction hash even though we couldn't get the receipt
              return tx.hash;
            } else {
              this.error(`NFT ownership verification failed. Expected: ${this.marketplaceAddress}, Got: ${newOwner}`);
              throw new Error("Listing transaction confirmation failed and NFT ownership verification failed.");
            }
          } catch (ownershipError: any) {
            this.error("NFT ownership verification error:", ownershipError);
            throw new Error("Listing transaction confirmation failed. Please check your wallet or try again.");
          }
        }
      }

      if (!receipt) {
        throw new Error("Listing transaction receipt not received");
      }

      this.log("Listing transaction receipt received:", receipt);

      // Check if transaction was successful
      if (receipt.status === 0) {
        this.error("Listing transaction failed on blockchain");
        this.error("Listing transaction receipt:", receipt);
        
        // Try to get more details about the failure
        try {
          const txDetails = await this.signer.provider!.getTransaction(tx.hash);
          this.error("Listing transaction details:", txDetails);
        } catch (txError) {
          this.error("Could not get listing transaction details:", txError);
        }
        
        throw new Error("Listing transaction failed on blockchain. Check the logs for details.");
      }

      this.log(`Listing successful! Transaction: ${receipt.hash}`);
      this.log(`Gas used: ${receipt.gasUsed.toString()}`);
      this.log(`Block number: ${receipt.blockNumber}`);
      return receipt.hash;
    } catch (error: any) {
      this.error(`Error listing token ${tokenId}:`, error);
      
      // Provide more specific error messages
      if (error.message?.includes("does not own")) {
        throw new Error("Failed to list domain. Make sure you own it and it's not already listed.");
      } else if (error.message?.includes("not approved")) {
        throw new Error("Token is not approved for marketplace. Please approve it first.");
      } else if (error.message?.includes("already listed")) {
        throw new Error("This domain is already listed on the marketplace.");
      } else if (error.message?.includes("network changed")) {
        throw new Error("Network is switching. Please wait for the network change to complete and try again.");
      } else if (error.message?.includes("switch to") || error.message?.includes("Chain ID:") || error.message?.includes("Failed to switch")) {
        throw new Error(`🔗 Please switch to ${NETWORK_CONFIG.name} network before listing. The system attempted to switch automatically but failed. Please manually switch to ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet.`);
      } else if (error.message?.includes("Internal JSON-RPC error") || error.code === "UNKNOWN_ERROR") {
        throw new Error("Network error during listing. Please try again in a few moments.");
      } else if (error.message?.includes("network")) {
        throw new Error("Network error. Please check your connection and try again.");
      } else {
        throw new Error(`Failed to list domain: ${error.message || "Unknown error"}`);
      }
    }
  }

  /**
   * List token direct with receipt and parsed events (for optimistic updates)
   * Assumes token is already approved
   */
  async listTokenDirectWithReceipt(tokenId: number, price: string): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    listedEvent: ParsedListedEvent | null;
    transfers: ParsedTransferEvent[];
  }> {
    try {
      const txHash = await this.listTokenDirect(tokenId, price);
      if (!txHash) {
        throw new Error("Transaction failed");
      }

      // Get receipt
      const receipt = await this.signer.provider!.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error("Could not get transaction receipt");
      }

      // Parse events
      const events = parseAllEvents(receipt, this.marketplaceAddress, this.nftAddress);

      return {
        txHash,
        receipt,
        listedEvent: events.listed || null,
        transfers: events.transfers || [],
      };
    } catch (error: any) {
      this.error("Error in listTokenDirectWithReceipt:", error);
      throw error;
    }
  }

  /**
   * List token with receipt and parsed events (for optimistic updates)
   */
  async listTokenWithReceipt(tokenId: number, price: string): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    listedEvent: ParsedListedEvent | null;
    transfers: ParsedTransferEvent[];
  }> {
    const txHash = await this.listToken(tokenId, price);
    if (!txHash) {
      throw new Error("Transaction failed");
    }

    // Get receipt
    const receipt = await this.signer.provider!.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Could not get transaction receipt");
    }

    // Parse events
    const events = parseAllEvents(receipt, this.marketplaceAddress, this.nftAddress);

    return {
      txHash,
      receipt,
      listedEvent: events.listed || null,
      transfers: events.transfers || [],
    };
  }

  // List a token on the marketplace (legacy method - handles approval automatically)
  async listToken(tokenId: number, price: string): Promise<string | null> {
    try {
      this.log(`Starting listing process for token ${tokenId} at price ${price} MATIC...`);
      
      // Check if user owns the token
      const userAddress = await this.signer.getAddress();
      const tokenOwner = await this.nftContract.ownerOf(tokenId);
      this.log(`Token owner: ${tokenOwner}, User address: ${userAddress}`);
      
      if (tokenOwner.toLowerCase() !== userAddress.toLowerCase()) {
        this.error(`User does not own token ${tokenId}. Owner: ${tokenOwner}, User: ${userAddress}`);
        throw new Error("Failed to list domain. Make sure you own it and it's not already listed.");
      }

      // Check if token is already listed
      try {
        // Check if token is already approved for marketplace
        const currentApproval = await this.nftContract.getApproved(tokenId);
        const isApprovedForAll = await this.nftContract.isApprovedForAll(userAddress, this.marketplaceAddress);
        
        this.log(`Current approval: ${currentApproval}, Marketplace address: ${this.marketplaceAddress}`);
        this.log(`Approved for all: ${isApprovedForAll}`);
        
        if (currentApproval.toLowerCase() === this.marketplaceAddress.toLowerCase() || isApprovedForAll) {
          this.log("Token is already approved, proceeding with listing...");
        } else {
          this.log("Token needs approval, requesting approval...");
          const approvalTxHash = await this.approveTokenForSale(tokenId);
          
          if (!approvalTxHash) {
            throw new Error("Failed to approve token for marketplace. Please try again.");
          }
          
          this.log(`Approval transaction successful: ${approvalTxHash}`);
          
          // Wait a moment for approval to be processed
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verify approval
          const newApproval = await this.nftContract.getApproved(tokenId);
          if (newApproval.toLowerCase() !== this.marketplaceAddress.toLowerCase()) {
            throw new Error("Token approval failed. Please try again.");
          }
        }
      } catch (approvalError: any) {
        this.error("Error during approval process:", approvalError);
        throw new Error("Failed to approve token for marketplace. Please try again.");
      }

      // Now list the token
      this.log("Creating listing transaction...");
      
      // Wait for network stability before sending listing transaction
      await this.ensureCorrectNetwork();
      
      // Estimate gas for listing transaction with fallback
      let listingGasEstimate;
      try {
        this.log("Attempting gas estimation for listing...");
        listingGasEstimate = await this.marketplaceContractWrite.listToken.estimateGas(
          this.nftAddress,
          tokenId,
          ethers.parseEther(price),
        );
        this.log(`Listing gas estimate successful: ${listingGasEstimate.toString()}`);
      } catch (gasError: any) {
        this.error("Listing gas estimation failed:", gasError);
        if (gasError.message?.includes("network changed")) {
          throw new Error("Network changed during gas estimation. Please try again.");
        }
        listingGasEstimate = BigInt(500000); // Default gas limit for listing
        this.warn(`Using default gas limit for listing: ${listingGasEstimate.toString()}`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(listingGasEstimate, 'list');
      
      this.log(`Sending listing transaction with gas limit: ${gasSettings.gasLimit.toString()}`);
      
      const tx = await this.marketplaceContractWrite.listToken(
        this.nftAddress,
        tokenId,
        ethers.parseEther(price),
        {
          ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
        }
      );

      this.log(`Listing transaction sent: ${tx.hash}`);
      this.log("Waiting for listing confirmation...");
      
      // Wait for transaction with robust confirmation handling (same as buy function)
      let receipt;
      try {
        receipt = await Promise.race([
          tx.wait(2), // Wait for 2 confirmations
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Transaction timeout after 5 minutes")), 5 * 60 * 1000)
          )
        ]);
      } catch (waitError: any) {
        this.error("Error waiting for listing transaction confirmation:", waitError);
        
        // If waiting fails, try to get the transaction status directly
        try {
          this.log("Attempting to get listing transaction status directly...");
          const txStatus = await this.signer.provider!.getTransactionReceipt(tx.hash);
          if (txStatus) {
            receipt = txStatus;
            this.log("Got listing transaction receipt directly:", txStatus);
          } else {
            // Transaction might still be pending
            this.log("Listing transaction is still pending, checking status...");
            const txDetails = await this.signer.provider!.getTransaction(tx.hash);
            if (txDetails && txDetails.blockNumber) {
              // Transaction is confirmed, try to get receipt again
              receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
              this.log("Got listing receipt after confirmation:", receipt);
            } else {
              throw new Error("Listing transaction is still pending or failed");
            }
          }
        } catch (directError: any) {
          this.error("Could not get listing transaction status directly:", directError);
          
          // Final fallback: Check if the NFT is now held by marketplace (listing succeeded)
          try {
            this.log("Checking if NFT is now held by marketplace as fallback verification...");
            const newOwner = await this.nftContract.ownerOf(tokenId);
            
            if (newOwner.toLowerCase() === this.marketplaceAddress.toLowerCase()) {
              this.log("NFT ownership verification: Listing succeeded! Marketplace now holds the NFT.");
              // Return the transaction hash even though we couldn't get the receipt
              return tx.hash;
            } else {
              this.error(`NFT ownership verification failed. Expected: ${this.marketplaceAddress}, Got: ${newOwner}`);
              throw new Error("Listing transaction confirmation failed and NFT ownership verification failed.");
            }
          } catch (ownershipError: any) {
            this.error("NFT ownership verification error:", ownershipError);
            throw new Error("Listing transaction confirmation failed. Please check your wallet or try again.");
          }
        }
      }

      if (!receipt) {
        throw new Error("Listing transaction receipt not received");
      }

      this.log("Listing transaction receipt received:", receipt);

      // Check if transaction was successful
      if (receipt.status === 0) {
        this.error("Listing transaction failed on blockchain");
        this.error("Listing transaction receipt:", receipt);
        
        // Try to get more details about the failure
        try {
          const txDetails = await this.signer.provider!.getTransaction(tx.hash);
          this.error("Listing transaction details:", txDetails);
        } catch (txError) {
          this.error("Could not get listing transaction details:", txError);
        }
        
        throw new Error("Listing transaction failed on blockchain. Check the logs for details.");
      }

      this.log(`Listing successful! Transaction: ${receipt.hash}`);
      this.log(`Gas used: ${receipt.gasUsed.toString()}`);
      this.log(`Block number: ${receipt.blockNumber}`);
      return receipt.hash;
    } catch (error: any) {
      this.error(`Error listing token ${tokenId}:`, error);
      
      // Provide more specific error messages
      if (error.message?.includes("does not own")) {
        throw new Error("Failed to list domain. Make sure you own it and it's not already listed.");
      } else if (error.message?.includes("approve")) {
        throw new Error("Failed to approve token for marketplace. Please try again.");
      } else if (error.message?.includes("already listed")) {
        throw new Error("This domain is already listed on the marketplace.");
      } else if (error.message?.includes("network changed")) {
        throw new Error("Network is switching. Please wait for the network change to complete and try again.");
      } else if (error.message?.includes("switch to") || error.message?.includes("Chain ID:") || error.message?.includes("Failed to switch")) {
        throw new Error(`🔗 Please switch to ${NETWORK_CONFIG.name} network before listing. The system attempted to switch automatically but failed. Please manually switch to ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet.`);
      } else if (error.message?.includes("Internal JSON-RPC error") || error.code === "UNKNOWN_ERROR") {
        throw new Error("Network error during listing. Please try again in a few moments.");
      } else if (error.message?.includes("network")) {
        throw new Error("Network error. Please check your connection and try again.");
      } else {
        throw new Error(`Failed to list domain: ${error.message || "Unknown error"}`);
      }
    }
  }

  // Cancel a listing
  async cancelListing(listingId: number): Promise<string | null> {
    try {
      this.log(`Cancelling listing ${listingId}...`);
      
      // Always enforce correct network before any transaction
      await this.ensureCorrectNetwork();
      
      // Get the listing details first
      const listing = await this.marketplaceContract.getListing(listingId);
      
      if (!listing.active) {
        this.warn(`Listing ${listingId} has been cancelled.`);
        return null;
      }

      // Check if the user is the seller
      const userAddress = await this.signer.getAddress();
      if (listing.seller.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error("You can only cancel your own listings.");
      }

      // Estimate gas for cancellation transaction with fallback
      let gasEstimate;
      try {
        this.log("Attempting gas estimation for cancellation...");
        gasEstimate = await this.marketplaceContractWrite.cancelListing.estimateGas(listingId);
        this.log(`Cancellation gas estimate successful: ${gasEstimate.toString()}`);
      } catch (gasError: any) {
        this.error("Cancellation gas estimation failed:", gasError);
        if (gasError.message?.includes("network changed")) {
          throw new Error("Network changed during gas estimation. Please try again.");
        }
        gasEstimate = BigInt(300000); // Default gas limit for cancellation
        this.warn(`Using default gas limit for cancellation: ${gasEstimate.toString()}`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(gasEstimate, 'cancel');
      
      this.log(`Sending cancellation transaction with gas limit: ${gasSettings.gasLimit.toString()}`);
      
      // Send transaction - simple approach, let user retry if it fails
      const tx = await this.marketplaceContractWrite.cancelListing(listingId, {
        ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
      });
      
      this.log(`Cancellation transaction sent: ${tx.hash}`);
      this.log("Waiting for cancellation confirmation...");
      
      // Wait for transaction confirmation - simple approach
      const receipt = await tx.wait(2);
      this.log(`Listing ${listingId} cancelled successfully! Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      this.error(`Error cancelling listing ${listingId}:`, error);
      
      // Simple error handling - let user retry if needed
      if (error.message?.includes("user rejected")) {
        throw new Error("Transaction was rejected by user.");
      } else if (error.message?.includes("switch to") || error.message?.includes("Chain ID:")) {
        throw new Error(`Please switch to ${NETWORK_CONFIG.name} network (Chain ID: ${NETWORK_CONFIG.chainId}) and try again.`);
      } else {
        throw new Error(`Failed to cancel listing: ${error.message || "Please try again."}`);
      }
    }
  }

  /**
   * Cancel listing with receipt and parsed events (for optimistic updates)
   */
  async cancelListingWithReceipt(listingId: number): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    listingCanceledEvent: ParsedListingCanceledEvent | null;
  }> {
    try {
      const txHash = await this.cancelListing(listingId);
      if (!txHash) {
        throw new Error("Transaction failed");
      }

      // Get receipt
      const receipt = await this.signer.provider!.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error("Could not get transaction receipt");
      }

      // Parse events
      const events = parseAllEvents(receipt, this.marketplaceAddress, this.nftAddress);

      return {
        txHash,
        receipt,
        listingCanceledEvent: events.listingCanceled || null,
      };
    } catch (error: any) {
      this.error("Error in cancelListingWithReceipt:", error);
      throw error;
    }
  }

  // Get Marketplace fees
  async getMarketplaceFees(): Promise<bigint | null> {
    try {
      const fees = await this.marketplaceContract.accruedFees();
      return fees;
    } catch (error: any) {
      this.error("Error fetching fees details:", error);
      return null;
    }
  }

  // Get listing details
  async getListing(listingId: number): Promise<Listing | null> {
    try {
      const listing = await this.marketplaceContract.getListing(listingId);
      return listing;
    } catch (error: any) {
      this.error("Error fetching listing details:", error);
      return null;
    }
  }

  // Get tokenData from collection (using subgraph)
  async getTokenData(tokenId: number): Promise<any> {
    try {
      // Check cache first
      const cached = this.tokenDataCache.get(tokenId);
      if (cached && Date.now() - cached.timestamp < this.TOKEN_DATA_CACHE_DURATION) {
        this.log(`Using cached token data for token ${tokenId}`);
        return cached.data;
      }

      this.log(`Fetching fresh token data for token ${tokenId}...`);
      
      // Try to get from subgraph first
      const subgraphToken = await this.subgraphService.getToken(tokenId);
      if (subgraphToken) {
        const formattedData = {
          ...subgraphToken,
          tokenId: tokenId
        };
        
        // Cache the subgraph data
        this.tokenDataCache.set(tokenId, {
          data: formattedData,
          timestamp: Date.now()
        });
        
        return formattedData;
      }

      // Fallback to contract if subgraph doesn't have it
      const contractData = await this.nftContract.getTokenData(tokenId);
      
      // Format contract data into proper object structure
      const formattedData = {
        creator: contractData[0],
        mintTimestamp: Number(contractData[1]),
        uri: contractData[2],
        lastPrice: contractData[3].toString(),
        lastPriceTimestamp: contractData[4].toString(),
        tokenId: tokenId
      };
      
      // Cache the contract data
      this.tokenDataCache.set(tokenId, {
        data: formattedData,
        timestamp: Date.now()
      });
      
      return formattedData;
    } catch (error: any) {
      this.error("Getting token:", error);
      return null;
    }
  }

  /**
   * Get royalty info for a specific token
   */
  async getRoyaltyInfo(tokenId: number, salePrice: bigint = BigInt(40000000)): Promise<[string, bigint] | null> {
    try {
      const royaltyInfo = await this.nftContract.royaltyInfo(tokenId, salePrice);
      return royaltyInfo;
    } catch (error: any) {
      this.error(`Error fetching royalty info for token ${tokenId}:`, error);
      return null;
    }
  }

  // Get token data from collection (using subgraph)
  async getStrDomainFromCollection(
    tokenId: number,
  ): Promise<FormattedToken | null> {
    try {
      // Try to get from subgraph first
      const subgraphToken = await this.subgraphService.getToken(tokenId);
      if (subgraphToken) {
        this.log(`Retrieved token data for #${tokenId} from subgraph - Creator: ${subgraphToken.creator}`);
        return subgraphToken;
      }

      // Fallback to contract if subgraph doesn't have it
      const data = await this.nftContract.getTokenData(tokenId);
      
      // Extract best-effort image URL and resolve IPFS
      const resolveIpfs = (url?: string): string | undefined => {
        if (!url) return undefined;
        if (url.startsWith("ipfs://")) {
          const path = url.replace("ipfs://", "");
          return `https://ipfs.io/ipfs/${path}`;
        }
        return url;
      };

      const formattedToken: FormattedToken = {
        tokenId: tokenId,
        creator: data[0],
        mintTimestamp: Number(data[1]),
        uri: data[2],
        lastPrice: data[3].toString(),
        lastPriceTimestamp: data[4].toString(),
        image: resolveIpfs(data[2]),
      };

      this.log(`Retrieved token data for #${tokenId} from contract - Creator: ${data[0]}`);
      return formattedToken;
    } catch (e: any) {
      // Don't log error, just return null
      return null;
    }
  }

  // Fetch all NFTs from the collection that belong to the connected wallet (subgraph-powered)
  async getMyDomainsFromCollection(): Promise<FormattedToken[]> {
    try {
      const myAddress = await this.signer.getAddress();
      this.log(`Fetching NFTs owned by ${myAddress} using subgraph...`);
      
      // Use subgraph to get owned NFTs
      const ownedNFTs = await this.subgraphService.getOwnedNFTs(myAddress);
      
      this.log(`Found ${ownedNFTs.length} domains owned by you via subgraph`);
      return ownedNFTs;
    } catch (error: any) {
      this.error("Error fetching owned NFTs via subgraph, falling back to contract:", error);
      
      // Fallback to original contract-based method
      return await this.getMyDomainsFromCollectionFallback();
    }
  }

  // Fallback method using contract calls (original implementation)
  private async getMyDomainsFromCollectionFallback(): Promise<FormattedToken[]> {
    const myTokenList: FormattedToken[] = [];
    let tokenId = 1;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const MAX_TOKENS = 20; // Reduced to avoid RPC issues

    const myAddress = await this.signer.getAddress();

    // Helper to delay between calls
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (
      tokenId <= MAX_TOKENS &&
      consecutiveFailures < MAX_CONSECUTIVE_FAILURES
    ) {
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
          error.code === "CALL_EXCEPTION" &&
          (error.reason?.includes("ERC721NonexistentToken") ||
            error.reason?.includes("nonexistent") ||
            error.message?.includes("could not decode"))
        ) {
          tokenId++;
          await delay(100);
          continue;
        }

        // RPC error - wait longer before continuing
        if (error.message?.includes("Internal JSON-RPC")) {
          this.warn(`RPC rate limit hit at token ${tokenId}, slowing down...`);
          await delay(500);
        }

        this.warn(`Error at tokenId ${tokenId}, continuing...`);
        tokenId++;
        await delay(200);
      }
    }

    this.warn(`Found ${myTokenList.length} domains owned by you (fallback method)`);
    return myTokenList;
  }

  // Get all NFTs from collection (subgraph-powered)
  async getAllStrDomainsFromCollection(): Promise<FormattedToken[]> {
    try {
      this.log("Fetching all collection NFTs using subgraph...");
      
      // Use subgraph to get all NFTs
      const allNFTs = await this.subgraphService.getAllCollectionNFTs();
      
      this.collectionCountTokens = allNFTs.length;
      this.log(`Found ${allNFTs.length} tokens in collection via subgraph`);
      return allNFTs;
    } catch (error: any) {
      this.error("Error fetching collection NFTs via subgraph, falling back to contract:", error);
      
      // Fallback to original contract-based method
      return await this.getAllStrDomainsFromCollectionFallback();
    }
  }

  // Get tokens created by a specific address (subgraph-powered)
  async getCreatedTokens(creatorAddress: string): Promise<FormattedToken[]> {
    try {
      this.log(`Fetching tokens created by ${creatorAddress} using subgraph...`);

      const createdTokens = await this.subgraphService.getCreatedTokens(creatorAddress);

      this.log(`Found ${createdTokens.length} tokens created by ${creatorAddress} via subgraph`);
      return createdTokens;
    } catch (error: any) {
      this.error("Error fetching created tokens via subgraph, falling back to contract:", error);

      const allTokens = await this.getAllStrDomainsFromCollection();
      return allTokens.filter(token => token.creator.toLowerCase() === creatorAddress.toLowerCase());
    }
  }

  // Fallback method using contract calls (original implementation)
  private async getAllStrDomainsFromCollectionFallback(): Promise<FormattedToken[]> {
    const tokenList: FormattedToken[] = [];
    let tokenId = 1;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const MAX_TOKENS = 50; // Limit to avoid RPC issues

    while (
      tokenId <= MAX_TOKENS &&
      consecutiveFailures < MAX_CONSECUTIVE_FAILURES
    ) {
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
          error.code === "CALL_EXCEPTION" &&
          error.reason?.includes("ERC721NonexistentToken")
        ) {
          tokenId++;
          continue;
        }
        this.warn(`Error at token ${tokenId}, continuing...`);
        tokenId++;
      }
    }

    this.collectionCountTokens = tokenList.length;
    this.warn(`Found ${tokenList.length} tokens in collection (fallback method)`);
    return tokenList;
  }

  // Get total count of listings
  async getListingCount(): Promise<number> {
    try {
      const result = await this.marketplaceContract.lastListingId();
      return Number(result);
    } catch (error: any) {
      this.error("Error getting listing count:", error);
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
        await new Promise((r) => setTimeout(r, 50));
      }
      this.cachedActiveListingCount = active;
      return active;
    } catch (e) {
      this.error("Error counting active listings:", e);
      return 0;
    }
  }

  // Get a page of active listings by scanning from the end and skipping inactive/missing
  async getActiveListingsPage(
    page: number,
    perPage: number,
  ): Promise<ListedToken[]> {
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
            tokenData = await this.getStrDomainFromCollection(
              Number(listing.tokenId),
            );
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
        await new Promise((r) => setTimeout(r, 60));
      }
    } catch (e) {
      this.error("Error fetching active listings page:", e);
    }
    return results;
  }

  // Owner only - Approve token for sale
  async approveTokenForSale(tokenId: number): Promise<string | null> {
    try {
      this.log(`Approving token ${tokenId} for marketplace...`);
      
      // Check ownership before attempting approval
      const userAddress = await this.signer.getAddress();
      const tokenOwner = await this.nftContract.ownerOf(tokenId);
      
      if (tokenOwner.toLowerCase() !== userAddress.toLowerCase()) {
        this.error(`User does not own token ${tokenId} for approval. Owner: ${tokenOwner}, User: ${userAddress}`);
        throw new Error("You don't own this token.");
      }
      
      this.log(`Sending approval transaction for token ${tokenId}...`);
      
      // Wait for network stability before sending transaction
      await this.ensureCorrectNetwork();
      
      // Estimate gas for approval transaction with fallback
      let gasEstimate;
      try {
        this.log("Attempting gas estimation for approval...");
        gasEstimate = await this.nftContractWrite.approve.estimateGas(
          this.marketplaceAddress,
          tokenId,
        );
        this.log(`Approval gas estimate successful: ${gasEstimate.toString()}`);
      } catch (gasError: any) {
        this.error("Approval gas estimation failed:", gasError);
        if (gasError.message?.includes("network changed")) {
          throw new Error("Network changed during gas estimation. Please try again.");
        }
        gasEstimate = BigInt(100000); // Default gas limit for approval
        this.warn(`Using default gas limit for approval: ${gasEstimate.toString()}`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(gasEstimate, 'approve');
      
      this.log(`Sending approval transaction with gas limit: ${gasSettings.gasLimit.toString()}`);
      
      const tx = await this.nftContractWrite.approve(
        this.marketplaceAddress,
        tokenId,
        {
          ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
        }
      );
      
      this.log(`Approval transaction sent: ${tx.hash}`);
      this.log("Waiting for approval confirmation...");
      
      // Wait for transaction with robust confirmation handling
      let receipt;
      try {
        receipt = await Promise.race([
          tx.wait(2), // Wait for 2 confirmations
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Transaction timeout after 5 minutes")), 5 * 60 * 1000)
          )
        ]);
      } catch (waitError: any) {
        this.error("Error waiting for approval transaction confirmation:", waitError);
        
        // If waiting fails, try to get the transaction status directly
        try {
          this.log("Attempting to get approval transaction status directly...");
          const txStatus = await this.signer.provider!.getTransactionReceipt(tx.hash);
          if (txStatus) {
            receipt = txStatus;
            this.log("Got approval transaction receipt directly:", txStatus);
          } else {
            // Transaction might still be pending
            this.log("Approval transaction is still pending, checking status...");
            const txDetails = await this.signer.provider!.getTransaction(tx.hash);
            if (txDetails && txDetails.blockNumber) {
              // Transaction is confirmed, try to get receipt again
              receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
              this.log("Got approval receipt after confirmation:", receipt);
            } else {
              throw new Error("Approval transaction is still pending or failed");
            }
          }
        } catch (directError: any) {
          this.error("Could not get approval transaction status directly:", directError);
          
          // Final fallback: Check if the approval was successful
          try {
            this.log("Checking if approval was successful as fallback verification...");
            const newApproval = await this.nftContract.getApproved(tokenId);
            
            if (newApproval.toLowerCase() === this.marketplaceAddress.toLowerCase()) {
              this.log("Approval verification: Approval succeeded! Token is now approved for marketplace.");
              // Return the transaction hash even though we couldn't get the receipt
              return tx.hash;
            } else {
              this.error(`Approval verification failed. Expected: ${this.marketplaceAddress}, Got: ${newApproval}`);
              throw new Error("Approval transaction confirmation failed and approval verification failed.");
            }
          } catch (approvalError: any) {
            this.error("Approval verification error:", approvalError);
            throw new Error("Approval transaction confirmation failed. Please check your wallet or try again.");
          }
        }
      }

      if (!receipt) {
        throw new Error("Approval transaction receipt not received");
      }

      this.log("Approval transaction receipt received:", receipt);

      // Check if transaction was successful
      if (receipt.status === 0) {
        this.error("Approval transaction failed on blockchain");
        this.error("Approval transaction receipt:", receipt);
        
        // Try to get more details about the failure
        try {
          const txDetails = await this.signer.provider!.getTransaction(tx.hash);
          this.error("Approval transaction details:", txDetails);
        } catch (txError) {
          this.error("Could not get approval transaction details:", txError);
        }
        
        throw new Error("Approval transaction failed on blockchain. Check the logs for details.");
      }

      this.log(`Approval successful! Transaction: ${receipt.hash}`);
      this.log(`Gas used: ${receipt.gasUsed.toString()}`);
      this.log(`Block number: ${receipt.blockNumber}`);
      return receipt.hash;
    } catch (error: any) {
      this.error(`Error approving token ${tokenId}:`, error);
      
      // Provide more specific error messages
      if (error.message?.includes("don't own")) {
        throw new Error("You don't own this token.");
      } else if (error.message?.includes("user rejected")) {
        throw new Error("Approval transaction was rejected by user.");
      } else if (error.message?.includes("network changed")) {
        throw new Error("Network is switching. Please wait for the network change to complete and try again.");
      } else if (error.message?.includes("switch to") || error.message?.includes("Chain ID:") || error.message?.includes("Failed to switch")) {
        throw new Error(`🔗 Please switch to ${NETWORK_CONFIG.name} network before listing. The system attempted to switch automatically but failed. Please manually switch to ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet.`);
      } else if (error.message?.includes("Internal JSON-RPC error") || error.code === "UNKNOWN_ERROR") {
        throw new Error("Network error during approval. Please try again in a few moments.");
      } else if (error.message?.includes("network")) {
        throw new Error("Network error. Please check your connection and try again.");
      } else {
        throw new Error(`Failed to approve token: ${error.message || "Unknown error"}`);
      }
    }
  }

  /**
   * Approve token with receipt and parsed events (for optimistic updates)
   */
  async approveTokenForSaleWithReceipt(tokenId: number): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    approvalEvent: ParsedApprovalEvent | null;
  }> {
    const txHash = await this.approveTokenForSale(tokenId);
    if (!txHash) {
      throw new Error("Transaction failed");
    }

    // Get receipt
    const receipt = await this.signer.provider!.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Could not get transaction receipt");
    }

    // Parse events
    const events = parseAllEvents(receipt, this.marketplaceAddress, this.nftAddress);

    return {
      txHash,
      receipt,
      approvalEvent: events.approval || null,
    };
  }

  // Get available fee balance from a splitter
  async getSplitterBalance(
    splitterAddress: string,
    walletAddress: string,
  ): Promise<bigint | null> {
    try {
      const contractInstance = new ethers.Contract(
        splitterAddress,
        RoyaltySplitterABI,
        this.signer,
      );
      const balance = await contractInstance.ethBalance(walletAddress);
      return balance;
    } catch (error: any) {
      this.error("Unexpected error fetching balance:", error);
      return null;
    }
  }

  // Get all splitter balances for a given wallet across the collection (Alchemy-enhanced)
  // Cache for splitter addresses to avoid repeated scanning
  private splitterCache: { addresses: string[]; timestamp: number } | null = null;
  private readonly SPLITTER_CACHE_DURATION = 300000; // 5 minutes cache

  /**
   * OPTIMIZED: Get splitter addresses by creator (if creator is known)
   * This is a more targeted approach when you know the creator address
   */
  async getSplitterAddressesByCreator(creatorAddress: string): Promise<string[]> {
    try {
      this.log(`Searching for splitters by creator ${creatorAddress}...`);
      const startTime = Date.now();

      // Get collection count first
      if (!this.collectionCountTokens) {
        await this.getAllStrDomainsFromCollection();
      }

      if (!this.collectionCountTokens) {
        this.warn("No token counter available");
        return [];
      }

      // Create array of all token IDs
      const allTokenIds = Array.from({ length: this.collectionCountTokens }, (_, i) => i + 1);
      
      // Process in chunks and filter by creator
      const chunkSize = 20;
      const chunks = [];
      for (let i = 0; i < allTokenIds.length; i += chunkSize) {
        chunks.push(allTokenIds.slice(i, i + chunkSize));
      }

      const splitterSet = new Set<string>();
      
      // Process chunks in parallel
      for (const chunk of chunks) {
        try {
          // Get royalty info and creator for all tokens in this chunk in parallel
          const tokenPromises = chunk.map(async (tokenId) => {
            try {
              const [splitterData, tokenData] = await Promise.all([
                this.nftContract.royaltyInfo(tokenId, 40000000),
                this.getTokenData(tokenId)
              ]);
              
              // Check if this token's creator matches our target creator
              if (tokenData && tokenData.creator.toLowerCase() === creatorAddress.toLowerCase()) {
                return splitterData[0];
              }
              return null;
            } catch (error) {
              return null;
            }
          });
          
          const chunkResults = await Promise.all(tokenPromises);
          
          // Add unique splitters to our set
          chunkResults.forEach(splitterAddress => {
            if (splitterAddress && splitterAddress !== '0x0000000000000000000000000000000000000000') {
              splitterSet.add(splitterAddress);
            }
          });
          
          // Small delay between chunks
          if (chunks.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          this.warn(`Error processing chunk:`, error);
        }
      }

      const splitterAddresses = Array.from(splitterSet);

      const endTime = Date.now();
      this.log(`Found ${splitterAddresses.length} splitters by creator in ${endTime - startTime}ms`);

      return splitterAddresses;
    } catch (error) {
      this.error("Error finding splitters by creator:", error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Get splitter addresses using batch processing and caching
   */
  async getSplitterAddressesOptimized(): Promise<string[]> {
    try {
      // Check cache first
      if (this.splitterCache && 
          Date.now() - this.splitterCache.timestamp < this.SPLITTER_CACHE_DURATION) {
        this.log(`Using cached splitter addresses: ${this.splitterCache.addresses.length} splitters`);
        return this.splitterCache.addresses;
      }

      this.log("Fetching fresh splitter addresses with optimized batch method...");
      const startTime = Date.now();

      // Get collection count first
      if (!this.collectionCountTokens) {
        await this.getAllStrDomainsFromCollection();
      }

      if (!this.collectionCountTokens) {
        this.warn("No token counter available");
        return [];
      }

      // Create array of all token IDs
      const allTokenIds = Array.from({ length: this.collectionCountTokens }, (_, i) => i + 1);
      
      // Process in chunks to avoid overwhelming the RPC
      const chunkSize = 20;
      const chunks = [];
      for (let i = 0; i < allTokenIds.length; i += chunkSize) {
        chunks.push(allTokenIds.slice(i, i + chunkSize));
      }

      this.log(`Processing ${allTokenIds.length} tokens in ${chunks.length} chunks for splitter discovery`);

      const splitterSet = new Set<string>();
      
      // Process chunks in parallel for much faster discovery
      for (const chunk of chunks) {
        try {
          // Get royalty info for all tokens in this chunk in parallel
          const royaltyPromises = chunk.map(async (tokenId) => {
            try {
              const splitterData = await this.nftContract.royaltyInfo(tokenId, 40000000);
              return splitterData[0];
            } catch (error) {
              return null;
            }
          });
          
          const chunkResults = await Promise.all(royaltyPromises);
          
          // Add unique splitters to our set
          chunkResults.forEach(splitterAddress => {
            if (splitterAddress && splitterAddress !== '0x0000000000000000000000000000000000000000') {
              splitterSet.add(splitterAddress);
            }
          });
          
          // Small delay between chunks to be nice to the RPC
          if (chunks.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          this.warn(`Error processing chunk:`, error);
        }
      }

      const splitterAddresses = Array.from(splitterSet);

      // Cache the result
      this.splitterCache = {
        addresses: splitterAddresses,
        timestamp: Date.now()
      };

      const endTime = Date.now();
      this.log(`OPTIMIZED: Found ${splitterAddresses.length} unique splitters in ${endTime - startTime}ms`);

      return splitterAddresses;
    } catch (error) {
      this.error("Error in optimized splitter discovery:", error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Get splitter count for progress indication
   */
  async getSplitterCountOptimized(): Promise<number> {
    try {
      const addresses = await this.getSplitterAddressesOptimized();
      return addresses.length;
    } catch (error) {
      this.error("Error getting splitter count:", error);
      return 0;
    }
  }

  /**
   * Get splitter balances using subgraph
   */
  async getSplitterBalanceOfWallet(
    walletAddress: string,
  ): Promise<SplitterBalance[]> {
    try {
      this.log(`Fetching splitter balances for ${walletAddress} using subgraph...`);
      const startTime = Date.now();

      // Use subgraph to get splitter balances
      const balances = await this.subgraphService.getSplitterBalances(walletAddress);

      const endTime = Date.now();
      this.log(`Subgraph fetch completed: Found ${balances.length} splitters with balances in ${endTime - startTime}ms.`);
      
      return balances;
    } catch (error: any) {
      this.error("Error fetching splitter balances from subgraph:", error);
      // Fallback to empty array
      return [];
    }
  }

  // Withdraw royalty from a specific splitter
  async withdrawRoyaltyFromSplitter(splitterAddress: string): Promise<any> {
    try {
      this.log(`Withdrawing royalty from splitter ${splitterAddress}...`);
      
      // Wait for network stability before withdrawing
      await this.ensureCorrectNetwork();
      
      // Use write contract for transactions (requires signer)
      const contract = new ethers.Contract(
        splitterAddress,
        RoyaltySplitterABI,
        this.signer,
      );
      const walletAddress = await this.signer.getAddress();
      const rawBalance = await contract.ethBalance(walletAddress);

      if (rawBalance <= 0n) {
        this.warn(`⏭ Skipping ${splitterAddress}: no funds to withdraw.`);
        return null;
      }

      const balance = ethers.formatEther(rawBalance);
      this.log(`Withdrawing ${balance} MATIC from splitter ${splitterAddress}...`);

      // Estimate gas for withdrawal transaction with fallback
      let gasEstimate;
      try {
        this.log("Attempting gas estimation for withdrawal...");
        gasEstimate = await contract.withdraw.estimateGas();
        this.log(`Withdrawal gas estimate successful: ${gasEstimate.toString()}`);
      } catch (gasError: any) {
        this.error("Withdrawal gas estimation failed:", gasError);
        if (gasError.message?.includes("network changed")) {
          throw new Error("Network changed during gas estimation. Please try again.");
        }
        gasEstimate = BigInt(150000); // Default gas limit for withdrawal
        this.warn(`Using default gas limit for withdrawal: ${gasEstimate.toString()}`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(gasEstimate, 'withdraw');
      
      this.log(`Sending withdrawal transaction with gas limit: ${gasSettings.gasLimit.toString()}`);
      
      const tx = await contract.withdraw({
        ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
      });
      
      if (!tx || !tx.hash) {
        this.warn(
          `No transaction hash returned from withdraw() on ${splitterAddress}`,
        );
        return null;
      }

      this.log(`Withdrawal transaction sent: ${tx.hash}`);
      this.log("Waiting for withdrawal confirmation...");
      
      // Wait for transaction with robust confirmation handling
      let receipt;
      try {
        this.log("Waiting for withdrawal transaction confirmation...");
        receipt = await tx.wait(2); // Wait for 2 confirmations
        this.log(`Withdrawal transaction confirmed in block ${receipt.blockNumber}`);
      } catch (waitError: any) {
        this.warn("Standard wait failed, trying alternative confirmation methods...");
        
        // Try direct receipt lookup
        try {
          this.log("Attempting direct receipt lookup...");
          receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
          if (receipt) {
            this.log(`Found receipt via direct lookup: ${receipt.blockNumber}`);
          }
        } catch (receiptError) {
          this.warn("Direct receipt lookup failed:", receiptError);
        }
        
        // If still no receipt, try checking transaction status
        if (!receipt) {
          try {
            this.log("Checking transaction status...");
            const txStatus = await this.signer.provider!.getTransaction(tx.hash);
            if (txStatus && txStatus.blockNumber) {
              this.log(`Transaction included in block: ${txStatus.blockNumber}`);
              // Try to get receipt again
              receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
            }
          } catch (statusError) {
            this.warn("Transaction status check failed:", statusError);
          }
        }
        
        // Final fallback - assume success if we have the transaction hash
        if (!receipt) {
          this.warn("Could not get transaction receipt, but transaction was sent successfully");
          this.log(`Withdrawal transaction hash: ${tx.hash}`);
          return {
            splitter: splitterAddress,
            transactionHash: tx.hash,
            withdrawn: balance,
          };
        }
      }

      this.log(`Withdrawn from splitter ${splitterAddress} successfully! Transaction: ${receipt.hash}`);
      this.log(`Amount: ${balance} MATIC`);
      this.log(`Gas used: ${receipt.gasUsed.toString()}`);
      this.log(`Block number: ${receipt.blockNumber}`);

      return {
        splitter: splitterAddress,
        transactionHash: receipt.hash,
        withdrawn: balance,
      };
    } catch (err: any) {
      this.error(`Error withdrawing from splitter ${splitterAddress}:`, err);
      
      // Provide more specific error messages
      if (err.message?.includes("user rejected")) {
        throw new Error("Withdrawal transaction was rejected by user.");
      } else if (err.message?.includes("network changed")) {
        throw new Error("Network is switching. Please wait for the network change to complete and try again.");
      } else if (err.message?.includes("switch to") || err.message?.includes("Chain ID:") || err.message?.includes("Failed to switch")) {
        throw new Error(`🔗 Please switch to ${NETWORK_CONFIG.name} network before withdrawing. The system attempted to switch automatically but failed. Please manually switch to ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet.`);
      } else if (err.message?.includes("Internal JSON-RPC error") || err.code === "UNKNOWN_ERROR") {
        throw new Error("Network error during withdrawal. Please try again in a few moments.");
      } else if (err.message?.includes("network")) {
        throw new Error("Network error. Please check your connection and try again.");
      } else {
        throw new Error(`Failed to withdraw from splitter: ${err.message || "Unknown error"}`);
      }
    }
  }

  /**
   * Withdraw royalty from splitter with receipt and parsed events (for optimistic updates)
   */
  async withdrawRoyaltyFromSplitterWithReceipt(splitterAddress: string): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    result: {
      splitter: string;
      transactionHash: string;
      withdrawn: string;
    };
  }> {
    try {
      const result = await this.withdrawRoyaltyFromSplitter(splitterAddress);
      if (!result) {
        throw new Error("Transaction failed");
      }

      // Get receipt
      const receipt = await this.signer.provider!.getTransactionReceipt(result.transactionHash);
      if (!receipt) {
        throw new Error("Could not get transaction receipt");
      }

      return {
        txHash: result.transactionHash,
        receipt,
        result,
      };
    } catch (error: any) {
      this.error("Error in withdrawRoyaltyFromSplitterWithReceipt:", error);
      throw error;
    }
  }

  // Withdraw royalty fees from all existing splitter contracts
  async withdrawAllRoyaltyFees(): Promise<any[] | null> {
    try {
      const walletAddress = await this.signer.getAddress();
      const splitterBalances =
        await this.getSplitterBalanceOfWallet(walletAddress);

      if (!splitterBalances || splitterBalances.length === 0) {
        this.warn("No splitter contracts with available balances found.");
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
      this.error("Error withdrawing all royalty fees:", error);
      return null;
    }
  }

  // Withdraw marketplace fees (only owner of the contract)
  async withdrawMarketPlaceFees(): Promise<string | null> {
    const isAdmin = await this.isAdmin();

    try {
      if (!isAdmin) {
        this.warn(
          "You are not an admin of the Marketplace contract. Withdraw not allowed.",
        );
        return null;
      }

      this.log("Withdrawing marketplace fees...");
      
      // Wait for network stability before withdrawing
      await this.ensureCorrectNetwork();

      // Estimate gas for fee withdrawal transaction with fallback
      let gasEstimate;
      try {
        this.log("Attempting gas estimation for fee withdrawal...");
        gasEstimate = await this.marketplaceContractWrite.withdrawFees.estimateGas();
        this.log(`Fee withdrawal gas estimate successful: ${gasEstimate.toString()}`);
      } catch (gasError: any) {
        this.error("Fee withdrawal gas estimation failed:", gasError);
        if (gasError.message?.includes("network changed")) {
          throw new Error("Network changed during gas estimation. Please try again.");
        }
        gasEstimate = BigInt(100000); // Default gas limit for fee withdrawal
        this.warn(`Using default gas limit for fee withdrawal: ${gasEstimate.toString()}`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(gasEstimate, 'withdraw');
      
      this.log(`Sending fee withdrawal transaction with gas limit: ${gasSettings.gasLimit.toString()}`);
      
      const tx = await this.marketplaceContractWrite.withdrawFees({
        ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
      });
      
      this.log(`Fee withdrawal transaction sent: ${tx.hash}`);
      this.log("Waiting for fee withdrawal confirmation...");
      
      // Wait for transaction with robust confirmation handling
      let receipt;
      try {
        this.log("Waiting for fee withdrawal transaction confirmation...");
        receipt = await tx.wait(2); // Wait for 2 confirmations
        this.log(`Fee withdrawal transaction confirmed in block ${receipt.blockNumber}`);
      } catch (waitError: any) {
        this.warn("Standard wait failed, trying alternative confirmation methods...");
        
        // Try direct receipt lookup
        try {
          this.log("Attempting direct receipt lookup...");
          receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
          if (receipt) {
            this.log(`Found receipt via direct lookup: ${receipt.blockNumber}`);
          }
        } catch (receiptError) {
          this.warn("Direct receipt lookup failed:", receiptError);
        }
        
        // If still no receipt, try checking transaction status
        if (!receipt) {
          try {
            this.log("Checking transaction status...");
            const txStatus = await this.signer.provider!.getTransaction(tx.hash);
            if (txStatus && txStatus.blockNumber) {
              this.log(`Transaction included in block: ${txStatus.blockNumber}`);
              // Try to get receipt again
              receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
            }
          } catch (statusError) {
            this.warn("Transaction status check failed:", statusError);
          }
        }
        
        // Final fallback - assume success if we have the transaction hash
        if (!receipt) {
          this.warn("Could not get transaction receipt, but transaction was sent successfully");
          this.log(`Fee withdrawal transaction hash: ${tx.hash}`);
          return tx.hash;
        }
      }

      this.log(`Marketplace fees withdrawn successfully! Transaction: ${receipt.hash}`);
      this.log(`Gas used: ${receipt.gasUsed.toString()}`);
      this.log(`Block number: ${receipt.blockNumber}`);

      return receipt.hash;
    } catch (error: any) {
      this.error(`Error withdrawing marketplace fees:`, error);
      
      // Provide more specific error messages
      if (error.message?.includes("user rejected")) {
        throw new Error("Fee withdrawal transaction was rejected by user.");
      } else if (error.message?.includes("network changed")) {
        throw new Error("Network is switching. Please wait for the network change to complete and try again.");
      } else if (error.message?.includes("switch to") || error.message?.includes("Chain ID:") || error.message?.includes("Failed to switch")) {
        throw new Error(`🔗 Please switch to ${NETWORK_CONFIG.name} network before withdrawing fees. The system attempted to switch automatically but failed. Please manually switch to ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet.`);
      } else if (error.message?.includes("Internal JSON-RPC error") || error.code === "UNKNOWN_ERROR") {
        throw new Error("Network error during fee withdrawal. Please try again in a few moments.");
      } else if (error.message?.includes("network")) {
        throw new Error("Network error. Please check your connection and try again.");
      } else {
        throw new Error(`Failed to withdraw marketplace fees: ${error.message || "Unknown error"}`);
      }
    }
  }

  /**
   * Withdraw marketplace fees with receipt and parsed events (for optimistic updates)
   */
  async withdrawMarketPlaceFeesWithReceipt(): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    feeWithdrawnEvent: ParsedFeeWithdrawnEvent | null;
  }> {
    const txHash = await this.withdrawMarketPlaceFees();
    if (!txHash) {
      throw new Error("Transaction failed");
    }

    // Get receipt
    const receipt = await this.signer.provider!.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Could not get transaction receipt");
    }

    // Parse events
    const events = parseAllEvents(receipt, this.marketplaceAddress, this.nftAddress);

    return {
      txHash,
      receipt,
      feeWithdrawnEvent: events.feeWithdrawn || null,
    };
  }

  // Check if connected wallet is admin
  async isAdmin(): Promise<boolean> {
    try {
      const ADMIN_ROLE =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
      const isAdmin = await this.nftContract.hasRole(
        ADMIN_ROLE,
        await this.signer.getAddress(),
      );
      if (!isAdmin) {
        this.warn(
          "Please connect with an admin account before running isAdmin method.",
        );
      }
      return isAdmin;
    } catch (e) {
      return false;
    }
  }

  // Admin only - Mint domain
  async mintDomain(
    originalCreator: string,
    URI: string,
    domainName: string,
  ): Promise<string | null> {
    if (!(await this.isAdmin())) return null;

    try {
      this.log(`Minting domain NFT for creator ${originalCreator} with URI ${URI} and domain name ${domainName}...`);
      
      // Wait for network stability before minting
      await this.ensureCorrectNetwork();

      // Estimate gas for minting transaction with fallback
      let gasEstimate;
      try {
        this.log("Attempting gas estimation for minting...");
        gasEstimate = await this.nftContractWrite.mint.estimateGas(originalCreator, URI, domainName);
        this.log(`Minting gas estimate successful: ${gasEstimate.toString()}`);
      } catch (gasError: any) {
        this.error("Minting gas estimation failed:", gasError);
        if (gasError.message?.includes("network changed")) {
          throw new Error("Network changed during gas estimation. Please try again.");
        }
        gasEstimate = BigInt(200000); // Default gas limit for minting
        this.warn(`Using default gas limit for minting: ${gasEstimate.toString()}`);
      }

      // Calculate optimal gas settings
      const gasSettings = await this.calculateOptimalGasSettings(gasEstimate, 'mint');
      
      this.log(`Sending minting transaction with gas limit: ${gasSettings.gasLimit.toString()}`);
      
      const tx = await this.nftContractWrite.mint(originalCreator, URI, domainName, {
        ...gasSettings, // Spread gas settings (gasLimit, maxFeePerGas, maxPriorityFeePerGas)
      });
      
      this.log(`Minting transaction sent: ${tx.hash}`);
      this.log("Waiting for minting confirmation...");
      
      // Wait for transaction with robust confirmation handling
      let receipt;
      try {
        this.log("Waiting for minting transaction confirmation...");
        receipt = await tx.wait(2); // Wait for 2 confirmations
        this.log(`Minting transaction confirmed in block ${receipt.blockNumber}`);
      } catch (waitError: any) {
        this.warn("Standard wait failed, trying alternative confirmation methods...");
        
        // Try direct receipt lookup
        try {
          this.log("Attempting direct receipt lookup...");
          receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
          if (receipt) {
            this.log(`Found receipt via direct lookup: ${receipt.blockNumber}`);
          }
        } catch (receiptError) {
          this.warn("Direct receipt lookup failed:", receiptError);
        }
        
        // If still no receipt, try checking transaction status
        if (!receipt) {
          try {
            this.log("Checking transaction status...");
            const txStatus = await this.signer.provider!.getTransaction(tx.hash);
            if (txStatus && txStatus.blockNumber) {
              this.log(`Transaction included in block: ${txStatus.blockNumber}`);
              // Try to get receipt again
              receipt = await this.signer.provider!.getTransactionReceipt(tx.hash);
            }
          } catch (statusError) {
            this.warn("Transaction status check failed:", statusError);
          }
        }
        
        // Final fallback - assume success if we have the transaction hash
        if (!receipt) {
          this.warn("Could not get transaction receipt, but transaction was sent successfully");
          this.log(`Minting transaction hash: ${tx.hash}`);
          return tx.hash;
        }
      }

      this.log(`Domain NFT minted successfully! Transaction: ${receipt.hash}`);
      this.log(`Creator: ${originalCreator}`);
      this.log(`URI: ${URI}`);
      this.log(`Domain Name: ${domainName}`);
      this.log(`Gas used: ${receipt.gasUsed.toString()}`);
      this.log(`Block number: ${receipt.blockNumber}`);
      
      return receipt.hash;
    } catch (error: any) {
      this.error(`Error minting domain NFT:`, error);
      
      // Provide more specific error messages
      if (error.message?.includes("user rejected")) {
        throw new Error("Minting transaction was rejected by user.");
      } else if (error.message?.includes("network changed")) {
        throw new Error("Network is switching. Please wait for the network change to complete and try again.");
      } else if (error.message?.includes("switch to") || error.message?.includes("Chain ID:") || error.message?.includes("Failed to switch")) {
        throw new Error(`🔗 Please switch to ${NETWORK_CONFIG.name} network before minting. The system attempted to switch automatically but failed. Please manually switch to ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet.`);
      } else if (error.message?.includes("Internal JSON-RPC error") || error.code === "UNKNOWN_ERROR") {
        throw new Error("Network error during minting. Please try again in a few moments.");
      } else if (error.message?.includes("network")) {
        throw new Error("Network error. Please check your connection and try again.");
      } else {
        throw new Error(`Failed to mint domain NFT: ${error.message || "Unknown error"}`);
      }
    }
  }

  /**
   * Mint domain with receipt and parsed events (for optimistic updates)
   */
  async mintDomainWithReceipt(
    originalCreator: string,
    URI: string,
    domainName: string,
  ): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
    mintedEvent: ParsedMintedEvent | null;
    transfers: ParsedTransferEvent[];
  }> {
    const txHash = await this.mintDomain(originalCreator, URI, domainName);
    if (!txHash) {
      throw new Error("Transaction failed");
    }

    // Get receipt
    const receipt = await this.signer.provider!.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Could not get transaction receipt");
    }

    // Parse events
    const events = parseAllEvents(receipt, this.marketplaceAddress, this.nftAddress);

    return {
      txHash,
      receipt,
      mintedEvent: events.minted || null,
      transfers: events.transfers || [],
    };
  }

  // Simple Network Guard - Forces network change before any transaction
  private async ensureCorrectNetwork(): Promise<void> {
    try {
      this.log(`Checking network - must be on ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId})`);
      
      // Get current network
      const network = await this.signer.provider!.getNetwork();
      const currentChainId = Number(network.chainId);
      
      if (currentChainId !== NETWORK_CONFIG.chainId) {
        this.log(`Wrong network detected: ${currentChainId}, switching to ${NETWORK_CONFIG.name}...`);
        await this.switchToTargetNetwork();
        
        // Wait a moment for the switch to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify the switch worked
        const newNetwork = await this.signer.provider!.getNetwork();
        const newChainId = Number(newNetwork.chainId);
        
        if (newChainId !== NETWORK_CONFIG.chainId) {
          throw new Error(`Please switch to ${NETWORK_CONFIG.name} network (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet and try again.`);
        }
        
        this.log(`✅ Successfully switched to ${NETWORK_CONFIG.name} network`);
      } else {
        this.log(`✅ Already on correct network: ${NETWORK_CONFIG.name}`);
      }
    } catch (error: any) {
      this.error("Network check failed:", error);
      throw error;
    }
  }

  // Detect if we're using a mobile wallet (MetaMask mobile, WalletConnect mobile, etc.)
  private isMetaMaskMobile(): boolean {
    try {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      
      // Check if it's a mobile device
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      
      // Check if it's a mobile wallet (MetaMask mobile, WalletConnect, etc.)
      const isMobileWallet = userAgent.includes('MetaMask') || 
                            userAgent.includes('WalletConnect') ||
                            userAgent.includes('Trust Wallet') ||
                            userAgent.includes('Coinbase Wallet') ||
                            (window as any).ethereum?.isMetaMask ||
                            (window as any).ethereum?.isWalletConnect;
      
      // Also check for mobile browser indicators
      const isMobileBrowser = isMobile || 
                             window.innerWidth < 768 || // Mobile screen size
                             /Mobi|Android/i.test(userAgent);
      
      return isMobileBrowser && isMobileWallet;
    } catch (error) {
      // If we can't detect, check screen size as fallback
      return window.innerWidth < 768;
    }
  }

  // Detect if we're using WalletConnect
  private isWalletConnect(): boolean {
    try {
      // Check for WalletConnect provider
      const ethereum = (window as any).ethereum;
      if (ethereum?.isWalletConnect) {
        return true;
      }
      
      // Check for WalletConnect in user agent
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      if (userAgent.includes('WalletConnect')) {
        return true;
      }
      
      // Check for WalletConnect session storage
      if (typeof localStorage !== 'undefined') {
        const walletConnectKeys = Object.keys(localStorage).filter(key => 
          key.includes('walletconnect') || key.includes('wc@')
        );
        if (walletConnectKeys.length > 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  // Wait for network to stabilize - handles "network changed" errors
  private async waitForNetworkStability(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Network stability check timed out. Please try again."));
      }, 10000); // 10 second timeout

      let isResolved = false;
      let checkCount = 0;
      const maxChecks = 10; // Maximum number of checks
      const checkInterval = 1000; // Check every 1 second

      const checkNetwork = async () => {
        if (isResolved) return;

        try {
          const network = await this.signer.provider!.getNetwork();
          const chainId = Number(network.chainId);
          
          this.log(`Network stability check ${checkCount + 1}: ${network.name} (${chainId})`);

          // If we get here, network is stable
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            this.log("✅ Network is stable and ready for transactions");
            resolve();
          }
          return;
        } catch (networkError: any) {
          checkCount++;

          if (networkError.message?.includes("network changed")) {
            if (checkCount >= maxChecks) {
              if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                reject(new Error("Network is still changing after maximum attempts. Please wait and try again."));
              }
              return;
            }

            // Continue checking
            if (checkCount === 1) {
              this.log("⏳ Network is changing, waiting for stability...");
            }

            setTimeout(checkNetwork, checkInterval);
          } else {
            // Other network error - resolve anyway as it might be a different issue
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              this.log("✅ Network check completed (non-network-change error)");
              resolve();
            }
          }
        }
      };

      // Start the initial check
      checkNetwork();
    });
  }

  // Automatic network switching to target network
  private async switchToTargetNetwork(): Promise<void> {
    try {
      this.log(`🔄 Attempting to switch to ${NETWORK_CONFIG.name} network...`);
      
      const targetChainId = NETWORK_CONFIG.chainId;
      const chainIdHex = `0x${targetChainId.toString(16)}`;
      
      // Try to switch network using wallet provider
      if (this.signer.provider && 'request' in this.signer.provider) {
        try {
          // First try wallet_switchEthereumChain
          await (this.signer.provider as any).request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
          });
          
          this.log(`✅ Network switch request sent successfully to ${NETWORK_CONFIG.name}`);
          
          // Wait a moment for the switch to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (switchError: any) {
          this.log(`wallet_switchEthereumChain failed: ${switchError.message}`);
          
          // If chain doesn't exist, try to add it
          if (switchError.code === 4902) {
            this.log(`Chain not added, attempting to add ${NETWORK_CONFIG.name}...`);
            
            const networkConfig = getWalletNetworkConfig();
            
            await (this.signer.provider as any).request({
              method: "wallet_addEthereumChain",
              params: [networkConfig],
            });
            
            this.log(`✅ ${NETWORK_CONFIG.name} network added successfully`);
            
            // Wait for network to be added and switched
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw new Error(`Network switching failed: ${switchError.message}`);
          }
        }
      } else {
        throw new Error("Wallet provider does not support network switching");
      }
    } catch (error: any) {
      this.log(`❌ Automatic network switching failed: ${error.message}`);
      throw new Error(`Failed to switch to ${NETWORK_CONFIG.name} network. Please manually switch to ${NETWORK_CONFIG.name} (Chain ID: ${NETWORK_CONFIG.chainId}) in your wallet. Error: ${error.message}`);
    }
  }

  // Logging methods
  log(...args: any[]) {
    if (this.develop) console.log(...args);
  }

  // =========================
  // OPTIMIZED BATCH METHODS
  // =========================

  /**
   * Get multiple listings in a single batch call using multicall (much faster than individual calls)
   */
  async getListingsBatch(listingIds: number[]): Promise<ListedToken[]> {
    if (listingIds.length === 0) return [];

    try {
      this.log(`Fetching ${listingIds.length} listings in batch with multicall...`);
      const startTime = Date.now();

      // Execute parallel calls for better performance
      let listings: any[] = [];
      
      // Use parallel individual calls for better performance
      const listingPromises = listingIds.map(async (listingId) => {
        try {
          const listing = await this.getListing(listingId);
          return listing;
        } catch (error) {
          return null;
        }
      });
      
      listings = await Promise.all(listingPromises);

      // Process listings and fetch token data
      const processedListings: ListedToken[] = [];
      
      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        const listingId = listingIds[i];
        
        if (!listing || !listing.active) continue;

        try {
          // Fetch token data in parallel for better performance
          const tokenData = await this.getStrDomainFromCollection(Number(listing.tokenId));
          
          processedListings.push({
            listingId: listingId,
            tokenId: Number(listing.tokenId),
            seller: listing.seller,
            price: ethers.formatEther(listing.price),
            active: listing.active,
            strCollectionAddress: this.nftAddress,
            tokenData: tokenData || undefined
          } as ListedToken);
        } catch (error) {
          this.warn(`Failed to process listing ${listingId}:`, error);
        }
      }

      const endTime = Date.now();
      this.log(`Batch fetched ${processedListings.length} listings in ${endTime - startTime}ms`);

      return processedListings;
    } catch (error) {
      this.error("Error in batch listings fetch:", error);
      return [];
    }
  }

  /**
   * Optimized method to get all active listings using subgraph
   */
  async getAllActiveListingsOptimized(): Promise<ListedToken[]> {
    try {
      this.log("Fetching all active listings from subgraph...");
      const startTime = Date.now();

      // Use subgraph to get all active listings
      const allListings = await this.subgraphService.getActiveListings();

      const endTime = Date.now();
      this.log(`Subgraph fetch completed: ${allListings.length} active listings in ${endTime - startTime}ms`);

      return allListings;
    } catch (error) {
      this.error("Error fetching listings from subgraph, falling back to contract:", error);
      // Fallback to contract-based method
      return await this.scanForListings(true);
    }
  }

  /**
   * Get active listings for a specific page using subgraph
   */
  async getActiveListingsPageOptimized(page: number, pageSize: number): Promise<ListedToken[]> {
    try {
      this.log(`Fetching page ${page} (${pageSize} items) from subgraph...`);
      const startTime = Date.now();

      // Use subgraph pagination
      const pageListings = await this.subgraphService.getActiveListingsPage(page, pageSize);

      const endTime = Date.now();
      this.log(`Subgraph page fetch completed: ${pageListings.length} listings in ${endTime - startTime}ms`);
      this.log(`Page ${page}: showing ${pageListings.length} listings`);

      return pageListings;
    } catch (error) {
      this.error("Error fetching page from subgraph, falling back to contract:", error);
      // Fallback: get all and paginate manually
      const allListings = await this.getAllActiveListingsOptimized();
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return allListings.slice(startIndex, endIndex);
    }
  }

  /**
   * Get listing count with caching to avoid repeated calls
   */
  private listingCountCache: { count: number; timestamp: number } | null = null;
  private activeListingsCache: { listings: ListedToken[]; timestamp: number } | null = null;
  private tokenDataCache: Map<number, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  private readonly TOKEN_DATA_CACHE_DURATION = 300000; // 5 minutes cache for token data

  /**
   * Clear all caches to force fresh data on next request
   */
  clearCaches(): void {
    this.listingCountCache = null;
    this.activeListingsCache = null;
    this.tokenDataCache.clear();
    this.cachedActiveListingCount = undefined;
    this.log("All caches cleared - next requests will fetch fresh data");
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    listingCountCache: boolean;
    activeListingsCache: boolean;
    tokenDataCacheSize: number;
    tokenDataCacheEntries: number[];
  } {
    const tokenDataEntries = Array.from(this.tokenDataCache.keys());
    return {
      listingCountCache: this.listingCountCache !== null,
      activeListingsCache: this.activeListingsCache !== null,
      tokenDataCacheSize: this.tokenDataCache.size,
      tokenDataCacheEntries: tokenDataEntries
    };
  }

  /**
   * Get current network gas prices for transparency
   */
  async getCurrentGasPrices(): Promise<{
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    network: string;
    supportsEIP1559: boolean;
  }> {
    try {
      const feeData = await this.provider.getFeeData();
      const network = await this.provider.getNetwork();
      
      const supportsEIP1559 = !!(feeData.maxFeePerGas && feeData.maxPriorityFeePerGas);
      
      return {
        gasPrice: feeData.gasPrice || undefined,
        maxFeePerGas: feeData.maxFeePerGas || undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
        network: network.name || `Chain ID ${network.chainId}`,
        supportsEIP1559
      };
    } catch (error) {
      this.error("Error getting gas prices:", error);
      return {
        network: "Unknown",
        supportsEIP1559: false
      };
    }
  }

  /**
   * Calculate optimal gas settings for transactions with robust fallbacks
   */
  private async calculateOptimalGasSettings(estimatedGas: bigint, operation: string): Promise<{ gasLimit: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasPrice?: bigint }> {
    try {
      // Add 20% buffer to gas estimate for safety
      let gasLimit = estimatedGas + (estimatedGas * BigInt(20)) / BigInt(100);
      
      // Set more generous limits based on operation type and network conditions
      const limits = {
        buy: { min: BigInt(100000), max: BigInt(1000000) }, // Increased max for complex buy operations
        list: { min: BigInt(200000), max: BigInt(800000) }, // Increased max for listing
        approve: { min: BigInt(50000), max: BigInt(300000) }, // Increased max for approvals
        update: { min: BigInt(100000), max: BigInt(500000) }, // Increased max for updates
        cancel: { min: BigInt(100000), max: BigInt(500000) }, // Increased max for cancellations
        withdraw: { min: BigInt(100000), max: BigInt(500000) }, // Increased max for withdrawals
        mint: { min: BigInt(150000), max: BigInt(600000) } // Increased max for minting
      };
      
      const operationLimits = limits[operation as keyof typeof limits] || limits.buy;
      
      // Apply limits with more intelligent logic
      if (gasLimit < operationLimits.min) {
        gasLimit = operationLimits.min;
        this.log(`Using minimum gas limit for ${operation}: ${gasLimit.toString()}`);
      } else if (gasLimit > operationLimits.max) {
        // If we exceed the max, check if it's a reasonable amount
        const reasonableMax = operationLimits.max * BigInt(2); // Allow up to 2x the max for complex operations
        if (gasLimit <= reasonableMax) {
          this.log(`Using higher gas limit for complex ${operation} operation: ${gasLimit.toString()} (exceeds normal max of ${operationLimits.max.toString()})`);
        } else {
          gasLimit = operationLimits.max;
          this.log(`Capping gas limit for ${operation} at maximum: ${gasLimit.toString()}`);
        }
      }
      
      // Try to get current gas price for EIP-1559 transactions with robust fallback
      let gasSettings: { gasLimit: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasPrice?: bigint } = { gasLimit };
      
      try {
        const feeData = await this.provider.getFeeData();
        
        // For certain testnets, prefer legacy gas pricing to avoid MetaMask issues
        const network = await this.provider.getNetwork();
        const isConfiguredTestnet = network.chainId === BigInt(NETWORK_CONFIG.chainId);
        
        if (isConfiguredTestnet) {
          this.log(`${NETWORK_CONFIG.name} detected - using legacy gas pricing to avoid MetaMask compatibility issues`);
          if (feeData.gasPrice) {
            gasSettings.gasPrice = feeData.gasPrice + (feeData.gasPrice * BigInt(15)) / BigInt(100);
            this.log(`Using legacy gas pricing for ${NETWORK_CONFIG.name}: gasPrice=${gasSettings.gasPrice}`);
          } else {
            this.log(`No gas price available for ${NETWORK_CONFIG.name}, using gas limit only`);
          }
        } else if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          // Add 15% buffer to gas prices for faster confirmation
          gasSettings.maxFeePerGas = feeData.maxFeePerGas + (feeData.maxFeePerGas * BigInt(15)) / BigInt(100);
          gasSettings.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas + (feeData.maxPriorityFeePerGas * BigInt(15)) / BigInt(100);
          this.log(`Using EIP-1559 gas pricing: maxFee=${gasSettings.maxFeePerGas}, priorityFee=${gasSettings.maxPriorityFeePerGas}`);
        } else if (feeData.gasPrice) {
          // Fallback to legacy gas pricing
          gasSettings.gasPrice = feeData.gasPrice + (feeData.gasPrice * BigInt(15)) / BigInt(100);
          this.log(`Using legacy gas pricing: gasPrice=${gasSettings.gasPrice}`);
        } else {
          this.log("No gas price data available, using gas limit only");
        }
      } catch (feeError) {
        this.log("Could not get fee data, using gas limit only");
        this.log("Fee data error:", feeError);
        // Ensure we don't use EIP-1559 parameters when fee data fails
        gasSettings.maxFeePerGas = undefined;
        gasSettings.maxPriorityFeePerGas = undefined;
        gasSettings.gasPrice = undefined;
      }
      
      return gasSettings;
    } catch (error) {
      this.error("Error calculating optimal gas settings:", error);
      // Fallback to simple gas limit with generous buffer
      return { gasLimit: estimatedGas + (estimatedGas * BigInt(30)) / BigInt(100) }; // Increased buffer to 30%
    }
  }

  async getActiveListingCountOptimized(): Promise<number> {
    try {
      // Check cache first
      if (this.listingCountCache && 
          Date.now() - this.listingCountCache.timestamp < this.CACHE_DURATION) {
        this.log(`Using cached listing count: ${this.listingCountCache.count}`);
        return this.listingCountCache.count;
      }

      this.log("Fetching fresh listing count from subgraph...");
      const startTime = Date.now();

      // Use subgraph to get count directly
      const activeCount = await this.subgraphService.getActiveListingCount();
      const endTime = Date.now();
      this.log(`Counted ${activeCount} active listings in ${endTime - startTime}ms`);

      // Cache the result
      this.listingCountCache = {
        count: activeCount,
        timestamp: Date.now()
      };

      return activeCount;
    } catch (error) {
      this.error("Error in optimized count fetch:", error);
      return 0;
    }
  }

  /**
   * Get my listings using subgraph
   */
  async getMyListingsOptimized(): Promise<ListedToken[]> {
    try {
      this.log("Fetching my listings from subgraph...");
      const startTime = Date.now();

      const myAddress = await this.signer.getAddress();
      
      // Use subgraph to get listings by seller
      const myListings = await this.subgraphService.getListingsBySeller(myAddress, true);

      const endTime = Date.now();
      this.log(`Subgraph fetch completed: Found ${myListings.length} of my listings in ${endTime - startTime}ms`);

      return myListings;
    } catch (error) {
      this.error("Error fetching my listings from subgraph, falling back to contract:", error);
      // Fallback to contract-based method
      return await this.scanForListings(false);
    }
  }

  // Get my all listed tokens on marketplace (OPTIMIZED)
  async getMyAllListedDomainsOnMarketplaceWithTokenData(): Promise<
    ListedToken[]
  > {
    // Use the subgraph method
    return await this.getMyListingsOptimized();
  }


  // Scan for listings (fallback method using contract)
  private async scanForListings(activeOnly: boolean): Promise<ListedToken[]> {
    const listings: ListedToken[] = [];
    let listingId = 1;

    try {
      this.log(`Scanning for listings (activeOnly: ${activeOnly}) using contract...`);
      
      while (true) {
        try {
          const listing = await this.getListing(listingId);
          if (!listing) break;

          if (!activeOnly || listing.active) {
            // Convert Listing to ListedToken
            const listedToken: ListedToken = {
              listingId: listingId,
              tokenId: Number(listing.tokenId),
              seller: listing.seller,
              price: ethers.formatEther(listing.price),
              active: listing.active,
              strCollectionAddress: this.nftAddress,
              tokenData: await this.getStrDomainFromCollection(Number(listing.tokenId)) || undefined
            };
            listings.push(listedToken);
          }
          listingId++;
        } catch (error: any) {
          this.warn(`Failed to scan listing ${listingId}:`, error.message);
          break;
        }
      }
    } catch (error: any) {
      this.error("Error scanning listings:", error);
    }

    return listings;
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
