# Update ABIs with Your Real Contract ABIs

## ⚠️ Important: Use Your Actual Contract ABIs

The minimal ABIs I created might not match your deployed contracts exactly. You need to replace them with the REAL ABIs from your artifacts.

## 📋 Steps to Fix

### Option 1: Copy ABIs from Your Backend Project

If you have the backend/contract project:

```bash
# From your contract project root, copy the ABIs:

# 1. Marketplace ABI
cp artifacts/contracts/Marketplace.sol/Marketplace.json \
   /Users/alex.codreanu/Desktop/marketplace-dapp/src/contracts/abis/Marketplace-full.json

# 2. StrDomainsNFT ABI
cp artifacts/contracts/StrDomainsNFT.sol/StrDomainsNFT.json \
   /Users/alex.codreanu/Desktop/marketplace-dapp/src/contracts/abis/StrDomainsNFT-full.json

# 3. RoyaltySplitter ABI
cp artifacts/contracts/RoyaltySplitter.sol/RoyaltySplitter.json \
   /Users/alex.codreanu/Desktop/marketplace-dapp/src/contracts/abis/RoyaltySplitter-full.json
```

Then update the imports in `src/sdk/MarketplaceSDK.ts`:

```typescript
// Change from:
import MarketplaceABI from '../contracts/abis/Marketplace.json';

// To:
import MarketplaceJSON from '../contracts/abis/Marketplace-full.json';
const MarketplaceABI = MarketplaceJSON.abi;
```

### Option 2: Manual Extraction

If the full JSON is too large, extract just the ABI:

**From your backend project:**

```bash
# Extract just the ABI array
node -e "console.log(JSON.stringify(require('./artifacts/contracts/Marketplace.sol/Marketplace.json').abi, null, 2))" > marketplace-abi.json
```

Then copy the content to: `src/contracts/abis/Marketplace.json`

### Option 3: Check Contract on Polygonscan

1. Go to: https://amoy.polygonscan.com/address/0x75201083D96114982B1b08176C87E2ec3e39dDb1#code

2. If verified, the ABI will be shown

3. Copy and paste into your JSON files

## 🔍 Verify the Contract Has These Functions

Check that your Marketplace contract has:

- ✅ `lastListingId()` returns uint256
- ✅ `getListing(uint256)` returns struct
- ✅ `listToken(address, uint256, uint256)`
- ✅ `buy(uint256)` payable
- ✅ `accruedFees()` returns uint256
- ✅ `withdrawFees()`

If `lastListingId()` doesn't exist, your contract might use a different method to track listings.

## 🛠️ Alternative: Check Your Contract

Run this script to test the contract:

```javascript
// test-contract.js
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
const marketplaceAddress = '0x75201083D96114982B1b08176C87E2ec3e39dDb1';

async function testContract() {
  // Try with minimal ABI
  const contract = new ethers.Contract(
    marketplaceAddress,
    ['function lastListingId() view returns (uint256)'],
    provider
  );

  try {
    const lastId = await contract.lastListingId();
    console.log('lastListingId:', lastId.toString());
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n❌ Contract might not have lastListingId() function');
    console.log('Check contract on Polygonscan for available functions');
  }
}

testContract();
```

Run: `node test-contract.js`

## 🎯 Quick Fix

Try these updated ABI files with explicit returns:

**Marketplace.json:**
```json
[
  {
    "inputs": [
      {"internalType": "address", "name": "nft", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "uint256", "name": "price", "type": "uint256"}
    ],
    "name": "listToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "listingId", "type": "uint256"}],
    "name": "buy",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lastListingId",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "listingId", "type": "uint256"}],
    "name": "getListing",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "seller", "type": "address"},
          {"internalType": "address", "name": "nft", "type": "address"},
          {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
          {"internalType": "uint256", "name": "price", "type": "uint256"},
          {"internalType": "bool", "name": "active", "type": "bool"}
        ],
        "internalType": "struct Marketplace.Listing",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "accruedFees",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "listingId", "type": "uint256"},
      {"internalType": "uint256", "name": "newPrice", "type": "uint256"}
    ],
    "name": "updateListing",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "listingId", "type": "uint256"}],
    "name": "cancelListing",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
```

## 🔧 Debug Steps

1. **Check Console:** Open DevTools → Console
2. **Look for:** Specific error about function
3. **Verify:** Contract address is correct
4. **Test:** Visit contract on Polygonscan
5. **Confirm:** Contract is verified and has the functions

## Still Not Working?

The contract might not have `lastListingId()`. In that case, you'll need to:

1. Use events to find listings OR
2. Add the function to your contract OR  
3. Use a different enumeration method

Let me know which function is missing and I can help adjust the SDK!

