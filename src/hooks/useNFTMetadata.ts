import { useState, useEffect } from 'react';

export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type?: string;
    value?: string | number;
    [key: string]: any;
  }>;
  [key: string]: any;
}

// Cache for metadata to avoid repeated fetches
const metadataCache = new Map<string, NFTMetadata | null>();

/**
 * Hook to fetch NFT metadata from tokenURI
 */
export function useNFTMetadata(tokenURI?: string | null): {
  metadata: NFTMetadata | null;
  isLoading: boolean;
  error: string | null;
} {
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenURI) {
      setMetadata(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cached = metadataCache.get(tokenURI);
    if (cached !== undefined) {
      setMetadata(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Fetch metadata
    setIsLoading(true);
    setError(null);

    const fetchMetadata = async () => {
      try {
        // Convert IPFS URL to HTTP gateway URL if needed
        let url = tokenURI;
        if (url.startsWith('ipfs://')) {
          const ipfsHash = url.replace('ipfs://', '');
          // Try multiple IPFS gateways
          const gateways = [
            `https://ipfs.io/ipfs/${ipfsHash}`,
            `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
            `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
          ];
          url = gateways[0]; // Use first gateway by default
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }

        const data: NFTMetadata = await response.json();
        
        // Cache the result
        metadataCache.set(tokenURI, data);
        setMetadata(data);
        setError(null);
      } catch (err: any) {
        console.error(`Error fetching metadata from ${tokenURI}:`, err);
        const errorMsg = err.message || 'Failed to fetch metadata';
        setError(errorMsg);
        setMetadata(null);
        // Cache null to prevent repeated failed requests
        metadataCache.set(tokenURI, null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [tokenURI]);

  return { metadata, isLoading, error };
}

/**
 * Helper function to get tokenURI from various data structures
 */
export function getTokenURI(tokenData: any): string | null {
  if (!tokenData) return null;

  // Try different possible locations for URI
  return (
    tokenData.uri ||
    tokenData.tokenURI ||
    tokenData[2] || // Contract data array index 2 (URI)
    tokenData.metadata?.rawMetadata?.token_uri ||
    tokenData.metadata?.tokenUri ||
    null
  );
}

