# Quick Setup Instructions

## ⚡ Fast Start

```bash
# 1. Install dependencies
yarn install

# 2. Create environment file
cp .env.example .env

# 3. Start the app
yarn start
```

## 📋 Pre-Launch Checklist

### ✅ 1. Environment Setup
- [ ] `.env` file created from `.env.example`
- [ ] Contract addresses verified in `.env`

### ✅ 2. MetaMask Configuration
- [ ] MetaMask extension installed
- [ ] Polygon Amoy network added to MetaMask
- [ ] Testnet MATIC obtained from faucet

### ✅ 3. Network Details (Polygon Amoy)

Add this network to MetaMask:

| Parameter | Value |
|-----------|-------|
| Network Name | Polygon Amoy |
| RPC URL | https://rpc-amoy.polygon.technology |
| Chain ID | 80002 |
| Currency Symbol | MATIC |
| Block Explorer | https://amoy.polygonscan.com/ |

### ✅ 4. Get Test MATIC

Visit: https://faucet.polygon.technology/

You'll need MATIC for:
- Gas fees for transactions
- Buying domain NFTs
- Listing your domains

## 🎯 Your Deployed Contracts

All contracts are already deployed on Polygon Amoy testnet:

```
Marketplace:          0x75201083D96114982B1b08176C87E2ec3e39dDb1
NFT Collection:       0x8255d9f7f51AD2B5CC7fBDFc1D9A967bD19EDD6a
Splitter Factory:     0x4C50CEF9c518789CFd0E014d8b1582B2dFE19A3b
Splitter Implementation: 0xAAB70f560fee9Be4F03891c30B19A8EeE1eB2E80
```

View on Block Explorer:
- [Marketplace](https://amoy.polygonscan.com/address/0x75201083D96114982B1b08176C87E2ec3e39dDb1)
- [NFT Collection](https://amoy.polygonscan.com/address/0x8255d9f7f51AD2B5CC7fBDFc1D9A967bD19EDD6a)

## 🚀 Testing the App

1. **Connect Wallet**
   - Open http://localhost:3000
   - Click "Connect Wallet"
   - Approve in MetaMask
   - Ensure you're on Amoy network

2. **View Marketplace**
   - Browse listed domains
   - See prices and sellers
   - Filter active/all listings

3. **View Your Domains**
   - Check your owned domains
   - See token metadata

4. **Test Transactions** (if you have NFTs)
   - List a domain for sale
   - Buy a domain
   - Update listing price
   - Cancel a listing

## 🔧 Troubleshooting

### "Connect Wallet" not working
- Refresh the page
- Check MetaMask is unlocked
- Verify you're on Polygon Amoy network

### "Failed to load" errors
- Check console for detailed errors
- Verify RPC URL is working
- Try switching networks in MetaMask

### Transaction failing
- Ensure you have enough MATIC for gas
- Check you're on the correct network (Amoy)
- Verify contract addresses in `.env`

### App not starting
```bash
# Clear cache and reinstall
rm -rf node_modules
yarn install
yarn start
```

## 📚 Next Steps

1. **Read the guides:**
   - [README.md](README.md) - Overview and features
   - [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - SDK usage
   - [QUICKSTART.md](QUICKSTART.md) - Quick reference

2. **Explore the code:**
   - `src/sdk/MarketplaceSDK.ts` - Your SDK implementation
   - `src/hooks/useMarketplaceSDK.ts` - React hook
   - `src/Pages/` - Example page implementations

3. **Customize:**
   - Update colors and branding
   - Add more features
   - Enhance UI components

## 🎨 Development Tips

### Hot Reload
The app supports hot reload. Changes to code will automatically refresh.

### Console Logging
SDK has built-in logging. Check browser console for:
- Transaction details
- Error messages
- Debug information

### React DevTools
Install React DevTools browser extension to:
- Inspect component state
- View context values
- Debug rendering

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Verify network configuration
3. Ensure contracts are deployed correctly
4. Check `.env` file has correct addresses
5. Review the integration guide

## ✨ You're Ready!

Your marketplace dApp is fully integrated and ready to use. All your SDK methods are available through React hooks.

Happy coding! 🚀

