# Integration Guide - Your Marketplace SDK

Your existing Marketplace SDK has been successfully integrated into the React frontend!

## What Was Done

### 1. SDK Conversion
- ✅ Converted your Node.js/CommonJS SDK to TypeScript
- ✅ Adapted for browser-based ethers.js usage
- ✅ Integrated with React Context for wallet management
- ✅ Location: `src/sdk/MarketplaceSDK.ts`

### 2. Environment Setup
- ✅ Created `.env.example` with your contract addresses
- ✅ All environment variables prefixed with `REACT_APP_` for Create React App

**Action Required:** Create your `.env` file:
```bash
cp .env.example .env
```

### 3. Contract ABIs
- ✅ `src/contracts/abis/Marketplace.json` - Marketplace contract
- ✅ `src/contracts/abis/StrDomainsNFT.json` - NFT collection contract
- ✅ `src/contracts/abis/RoyaltySplitter.json` - Royalty splitter contract

**Note:** These are minimal ABIs. If you need the full ABIs, replace them with your actual artifact files.

### 4. React Hook
- ✅ Created `useMarketplaceSDK` hook for easy access
- ✅ Automatically initializes with connected wallet
- ✅ Returns `null` when wallet is not connected

### 5. Example Pages
- ✅ `MyDomains.tsx` - Shows user's owned domains
- ✅ `Marketplace.tsx` - Shows all listed domains for sale

## How to Use

### Basic Usage

```typescript
import { useMarketplaceSDK } from './hooks/useMarketplaceSDK';

function MyComponent() {
  const sdk = useMarketplaceSDK();

  const buyDomain = async (listingId: number) => {
    if (!sdk) {
      alert('Please connect your wallet');
      return;
    }

    const txHash = await sdk.buyToken(listingId);
    if (txHash) {
      console.log('Purchase successful!', txHash);
    }
  };

  return <button onClick={() => buyDomain(1)}>Buy Domain #1</button>;
}
```

### Available SDK Methods

All your original methods are available:

#### Marketplace Operations
```typescript
// Buy a token
await sdk.buyToken(listingId);

// List a token
await sdk.listToken(tokenId, "2.5"); // price in MATIC

// Update listing price
await sdk.updateListing(listingId, "3.0");

// Cancel a listing
await sdk.cancelListing(listingId);

// Get listing details
await sdk.getListing(listingId);
```

#### NFT Operations
```typescript
// Get all domains from collection
const allDomains = await sdk.getAllStrDomainsFromCollection();

// Get your owned domains
const myDomains = await sdk.getMyDomainsFromCollection();

// Get specific token data
const tokenData = await sdk.getStrDomainFromCollection(tokenId);
```

#### Marketplace Queries
```typescript
// Get all active listings
const activeListings = await sdk.getAllActiveListedDomainsOnMarketplaceWithTokenData();

// Get all listings (including sold)
const allListings = await sdk.getAllListedDomainsOnMarketplaceWithTokenData();

// Get your listings
const myListings = await sdk.getMyAllListedDomainsOnMarketplaceWithTokenData();
```

#### Royalty Operations
```typescript
// Get splitter balances
const balances = await sdk.getSplitterBalanceOfWallet(walletAddress);

// Withdraw from specific splitter
await sdk.withdrawRoyaltyFromSplitter(splitterAddress);

// Withdraw from all splitters
await sdk.withdrawAllRoyaltyFees();
```

#### Admin Operations
```typescript
// Check if admin
const isAdmin = await sdk.isAdmin();

// Mint new domain (admin only)
await sdk.mintDomain(creatorAddress, "ipfs://...");

// Withdraw marketplace fees (admin only)
await sdk.withdrawMarketPlaceFees();
```

## Network Configuration

Your contracts are deployed on **Polygon Amoy Testnet** (Chain ID: 80002).

To add Amoy to MetaMask:
1. Open MetaMask
2. Click network dropdown
3. Click "Add Network"
4. Enter:
   - Network Name: Polygon Amoy
   - RPC URL: https://rpc-amoy.polygon.technology
   - Chain ID: 80002
   - Currency Symbol: MATIC
   - Block Explorer: https://amoy.polygonscan.com/

## Contract Addresses

```
Marketplace:     0x75201083D96114982B1b08176C87E2ec3e39dDb1
NFT Collection:  0x8255d9f7f51AD2B5CC7fBDFc1D9A967bD19EDD6a
Splitter Factory: 0x4C50CEF9c518789CFd0E014d8b1582B2dFE19A3b
Splitter Impl:   0xAAB70f560fee9Be4F03891c30B19A8EeE1eB2E80
```

## Complete Example Component

```typescript
import React, { useState, useEffect } from 'react';
import { useMarketplaceSDK } from '../hooks/useMarketplaceSDK';
import { useWallet } from '../contexts/WalletContext';

export const DomainListing: React.FC = () => {
  const { account } = useWallet();
  const sdk = useMarketplaceSDK();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (sdk) {
      loadListings();
    }
  }, [sdk]);

  const loadListings = async () => {
    if (!sdk) return;
    
    setIsLoading(true);
    try {
      const data = await sdk.getAllActiveListedDomainsOnMarketplaceWithTokenData();
      setListings(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuy = async (listingId: number) => {
    if (!sdk) {
      alert('Please connect wallet');
      return;
    }

    const confirmed = window.confirm('Confirm purchase?');
    if (!confirmed) return;

    const txHash = await sdk.buyToken(listingId);
    if (txHash) {
      alert('Purchase successful! TX: ' + txHash);
      loadListings(); // Reload
    } else {
      alert('Purchase failed');
    }
  };

  if (!account) {
    return <div>Please connect your wallet</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>Active Listings</h2>
      {listings.map((listing) => (
        <div key={listing.listingId}>
          <h3>Domain #{listing.tokenId}</h3>
          <p>Price: {listing.price} MATIC</p>
          <p>Seller: {listing.seller}</p>
          <button onClick={() => handleBuy(listing.listingId)}>
            Buy Now
          </button>
        </div>
      ))}
    </div>
  );
};
```

## Testing

1. **Connect to Amoy Testnet** in MetaMask
2. **Get testnet MATIC** from https://faucet.polygon.technology/
3. **Start the app**:
   ```bash
   npm start
   ```
4. **Connect your wallet**
5. **Navigate to pages**:
   - `/` - Home page
   - `/marketplace` - View all listings
   - `/my-domains` - View your domains

## Important Notes

### Transaction Handling
All transactions return a transaction hash or `null` on failure:

```typescript
const txHash = await sdk.buyToken(listingId);
if (txHash) {
  // Success - show success message
  console.log('Transaction:', txHash);
} else {
  // Failed - show error message
  console.error('Transaction failed');
}
```

### Error Handling
The SDK includes built-in logging (when `develop` mode is enabled):

```typescript
// SDK automatically logs warnings and errors to console
// Check browser console for detailed error messages
```

### Gas Estimation
Always ensure users have enough MATIC for:
- Transaction gas fees
- Purchase price (for buying)

### Loading States
Always show loading states during async operations:

```typescript
const [isLoading, setIsLoading] = useState(false);

const doSomething = async () => {
  setIsLoading(true);
  try {
    await sdk.someMethod();
  } finally {
    setIsLoading(false);
  }
};
```

## Next Steps

1. **Update ABIs**: Replace minimal ABIs with full versions from your artifacts
2. **Add Router**: Install React Router to enable page navigation
3. **Enhance UI**: Customize the components to match your design
4. **Add Features**: 
   - Search and filters
   - Sorting options
   - User profiles
   - Transaction history
   - Notifications

## Need Help?

- Check browser console for errors
- Verify network is Polygon Amoy (80002)
- Ensure wallet has testnet MATIC
- Check contract addresses in `.env`
- Verify ABIs match your deployed contracts

## Resources

- [Polygon Amoy Explorer](https://amoy.polygonscan.com/)
- [Polygon Faucet](https://faucet.polygon.technology/)
- [ethers.js v6 Docs](https://docs.ethers.org/v6/)

