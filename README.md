# NFT Marketplace DApp - STR Domains

A modern, fully-featured NFT marketplace for STR Domain NFTs built with React, TypeScript, and ethers.js. Integrated with your existing smart contracts on Polygon Amoy testnet.

## Features

### ✅ Wallet Connection
- **MetaMask Integration** - Connect/disconnect wallet with MetaMask
- **Real-time Balance** - Display MATIC balance
- **Network Detection** - Automatically detect Polygon Amoy
- **Account Switching** - Handle account changes seamlessly
- **Auto-reconnect** - Remember user's connection preference

### 🎨 UI Components
- **Header** - Responsive navigation with wallet button
- **Hero Section** - Eye-catching landing page with stats
- **NFT Cards** - Beautiful card layout for displaying NFTs
- **Marketplace** - Browse and buy domain NFTs
- **My Domains** - View your owned domains
- **Responsive Design** - Mobile-first, works on all devices

### 🏗️ Architecture
- **Context API** - Global wallet state management
- **TypeScript SDK** - Full marketplace SDK integration
- **Component-based** - Reusable, modular components
- **Modern CSS** - Gradient backgrounds, animations, hover effects

### 🔗 Smart Contract Integration
- **Marketplace Contract** - List, buy, and manage NFT sales
- **NFT Collection** - STR Domains NFT contract
- **Royalty Splitter** - Automated royalty distribution
- **Full SDK Support** - All your existing SDK methods available

## Project Structure

```
marketplace-dapp/
├── src/
│   ├── contexts/
│   │   └── WalletContext.tsx      # Wallet state management
│   ├── Components/
│   │   ├── Header.tsx             # Navigation header
│   │   ├── Header.css
│   │   ├── Hero.tsx               # Landing page hero section
│   │   ├── Hero.css
│   │   ├── WalletButton.tsx       # Wallet connection button
│   │   ├── WalletButton.css
│   │   ├── NFTCard.tsx            # NFT display card
│   │   └── NFTCard.css
│   ├── Pages/
│   │   ├── Home.tsx               # Home page
│   │   └── Home.css
│   ├── App.tsx                    # Main app component
│   ├── App.css
│   ├── index.tsx                  # Entry point
│   ├── global.d.ts                # TypeScript declarations
│   └── ...
├── public/
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask browser extension
- Polygon Amoy testnet MATIC (for testing)

### Installation

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Create your `.env` file:
```bash
cp .env.example .env
```

The `.env` file is already configured with your deployed contract addresses on Polygon Amoy testnet.

3. Configure MetaMask for Polygon Amoy:
   - Network Name: Polygon Amoy
   - RPC URL: https://rpc-amoy.polygon.technology
   - Chain ID: 80002
   - Currency Symbol: MATIC

4. Get testnet MATIC from the [Polygon Faucet](https://faucet.polygon.technology/)

5. Start the development server:
```bash
npm start
# or
yarn start
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Connecting a Wallet

1. Click the "Connect Wallet" button in the header
2. MetaMask will prompt you to connect
3. Approve the connection
4. Your address and balance will be displayed

### Using the Wallet Context

The `WalletContext` provides access to wallet functionality throughout your app:

```tsx
import { useWallet } from './contexts/WalletContext';

function MyComponent() {
  const { 
    account,          // Connected wallet address
    balance,          // MATIC balance
    chainId,          // Current chain ID (should be 80002 for Amoy)
    provider,         // ethers.js provider
    signer,           // ethers.js signer
    connectWallet,    // Function to connect wallet
    disconnectWallet, // Function to disconnect wallet
    isConnecting,     // Loading state
    error            // Error message
  } = useWallet();

  return (
    <div>
      {account ? (
        <p>Connected: {account}</p>
      ) : (
        <button onClick={connectWallet}>Connect</button>
      )}
    </div>
  );
}
```

### Using the Marketplace SDK

Your full marketplace SDK is integrated and ready to use:

```tsx
import { useMarketplaceSDK } from './hooks/useMarketplaceSDK';

function DomainsList() {
  const sdk = useMarketplaceSDK();
  
  const loadDomains = async () => {
    if (!sdk) return;
    
    // Get all active listings
    const listings = await sdk.getAllActiveListedDomainsOnMarketplaceWithTokenData();
    
    // Get your domains
    const myDomains = await sdk.getMyDomainsFromCollection();
    
    // Buy a domain
    const txHash = await sdk.buyToken(listingId);
    
    // List your domain
    await sdk.listToken(tokenId, "2.5"); // price in MATIC
  };
  
  return <div>...</div>;
}
```

See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for complete SDK documentation.

## Next Steps for Development

### 1. Smart Contract Integration

Add your smart contract ABI and address:

```tsx
// src/contracts/NFTMarketplace.ts
export const MARKETPLACE_ADDRESS = "0x...";
export const MARKETPLACE_ABI = [...];
```

Connect to your contract:

```tsx
import { ethers } from 'ethers';
import { useWallet } from './contexts/WalletContext';
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from './contracts/NFTMarketplace';

function useMarketplace() {
  const { signer } = useWallet();
  
  const getContract = () => {
    if (!signer) return null;
    return new ethers.Contract(
      MARKETPLACE_ADDRESS,
      MARKETPLACE_ABI,
      signer
    );
  };
  
  return { getContract };
}
```

### 2. Add More Pages

Create additional pages for:
- NFT details page
- Create/Mint NFT page
- User profile page
- Marketplace listing page

### 3. Implement NFT Functionality

```tsx
// Example: Fetch NFTs from contract
async function fetchNFTs() {
  const contract = getContract();
  const nfts = await contract.getAllNFTs();
  return nfts;
}

// Example: Buy NFT
async function buyNFT(tokenId: number, price: string) {
  const contract = getContract();
  const tx = await contract.buyNFT(tokenId, {
    value: ethers.parseEther(price)
  });
  await tx.wait();
}
```

### 4. Add IPFS Support

For decentralized image/metadata storage:

```bash
npm install ipfs-http-client
```

### 5. Add React Router

For multi-page navigation:

```bash
npm install react-router-dom @types/react-router-dom
```

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **ethers.js v6** - Ethereum interaction
- **MetaMask** - Wallet provider
- **CSS3** - Styling with gradients and animations

## Testing

```bash
npm test
# or
yarn test
```

## Building for Production

```bash
npm run build
# or
yarn build
```

## Common Issues

### MetaMask not detected
- Ensure MetaMask extension is installed
- Refresh the page after installing MetaMask

### Wrong Network
- Make sure you're connected to the correct network in MetaMask
- The app will display the current chain ID

### Transaction Errors
- Ensure you have enough ETH for gas fees
- Check if you're on the correct network

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT

## Resources

- [ethers.js Documentation](https://docs.ethers.org/v6/)
- [MetaMask Documentation](https://docs.metamask.io/)
- [React Documentation](https://react.dev/)
- [Ethereum Development Documentation](https://ethereum.org/en/developers/)
