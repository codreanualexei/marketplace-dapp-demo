# Quick Start Guide

Get your NFT Marketplace dApp running in 5 minutes!

## 🚀 Quick Setup

1. **Install Dependencies**
```bash
yarn install
# or
npm install
```

2. **Start Development Server**
```bash
yarn start
# or
npm start
```

3. **Open Your Browser**
Navigate to [http://localhost:3000](http://localhost:3000)

4. **Connect MetaMask**
Click "Connect Wallet" and approve the connection in MetaMask

## ✅ What's Included

### Core Features
- ✅ Wallet connection with MetaMask
- ✅ Real-time balance display
- ✅ Account switching support
- ✅ Network detection
- ✅ Beautiful, responsive UI
- ✅ NFT marketplace template

### Project Structure
```
src/
├── contexts/          # React Context for state management
│   └── WalletContext.tsx
├── Components/        # Reusable UI components
│   ├── Header.tsx
│   ├── Hero.tsx
│   ├── WalletButton.tsx
│   └── NFTCard.tsx
├── Pages/            # Page components
│   └── Home.tsx
├── hooks/            # Custom React hooks
│   ├── useContract.ts
│   └── useNFTMarketplace.ts
├── utils/            # Helper functions
│   ├── helpers.ts
│   └── constants.ts
└── contracts/        # Smart contract ABIs (add yours here)
```

## 🎯 Next Steps

### 1. Add Your Smart Contracts

Update the contract address in `src/hooks/useNFTMarketplace.ts`:
```typescript
const MARKETPLACE_ADDRESS = 'YOUR_CONTRACT_ADDRESS';
```

Add your contract ABI:
```typescript
const MARKETPLACE_ABI = [...]; // Your ABI here
```

### 2. Customize the UI

- Update colors in CSS files
- Change the logo in `public/`
- Modify text in `src/Components/Hero.tsx`

### 3. Connect to Real NFT Data

Replace mock data in `src/Pages/Home.tsx` with real blockchain data:
```typescript
import { useNFTMarketplace } from '../hooks/useNFTMarketplace';

function Home() {
  const { getListing } = useNFTMarketplace();
  
  // Fetch real NFTs from your contract
  useEffect(() => {
    async function loadNFTs() {
      // Your logic here
    }
    loadNFTs();
  }, []);
}
```

### 4. Add More Features

Ideas for expansion:
- User profile pages
- NFT creation/minting
- Search and filters
- Auction functionality
- Collection pages
- Activity feed

## 🔧 Common Tasks

### Update Network

Edit `src/utils/constants.ts` to add/remove supported networks.

### Style Changes

All CSS is in component-specific `.css` files. Modify as needed.

### Add New Pages

1. Create page in `src/Pages/`
2. Install React Router: `npm install react-router-dom`
3. Set up routes in `App.tsx`

## 🐛 Troubleshooting

### "Please install MetaMask"
Install the MetaMask browser extension from [metamask.io](https://metamask.io)

### App won't start
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Wallet not connecting
- Ensure MetaMask is unlocked
- Try refreshing the page
- Check browser console for errors

## 📚 Learn More

- [Full Documentation](README.md)
- [Smart Contract Examples](src/contracts/README.md)
- [ethers.js Docs](https://docs.ethers.org/v6/)

## 🎨 Screenshots

Your marketplace includes:
- Professional header with wallet integration
- Eye-catching hero section
- Grid layout for NFT display
- Responsive design for all devices

Start building your NFT marketplace now! 🚀

