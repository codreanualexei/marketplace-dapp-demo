# Extract Real ABIs from Your Contract Project

## 🎯 You Need the Full ABIs!

The minimal ABIs I created don't match your deployed contracts. You need to extract the real ABIs from your Hardhat/Truffle artifacts.

## 📋 Where Are Your Contract Artifacts?

Your backend SDK uses:
```javascript
require("../artifacts/contracts/Marketplace.sol/Marketplace.json").abi
require("../artifacts/contracts/StrDomainsNFT.sol/StrDomainsNFT.json").abi
require("../artifacts/contracts/RoyaltySplitter.sol/RoyaltySplitter.json").abi
```

Find this `artifacts/` folder in your contract project!

## 🛠️ Steps to Fix

### Step 1: Find Your Contract Project

Where did you compile these contracts? You should have a folder structure like:
```
your-contract-project/
├── contracts/
│   ├── Marketplace.sol
│   ├── StrDomainsNFT.sol
│   └── RoyaltySplitter.sol
├── artifacts/
│   └── contracts/
│       ├── Marketplace.sol/
│       │   └── Marketplace.json  ← NEED THIS
│       ├── StrDomainsNFT.sol/
│       │   └── StrDomainsNFT.json  ← NEED THIS
│       └── RoyaltySplitter.sol/
│           └── RoyaltySplitter.json  ← NEED THIS
```

### Step 2: Extract the ABIs

Run this script in your contract project:

```bash
# Save this as extract-abis.js in your contract project
cat > extract-abis.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Read artifact files
const marketplace = require('./artifacts/contracts/Marketplace.sol/Marketplace.json');
const nft = require('./artifacts/contracts/StrDomainsNFT.sol/StrDomainsNFT.json');
const splitter = require('./artifacts/contracts/RoyaltySplitter.sol/RoyaltySplitter.json');

// Extract just the ABI
const marketplaceABI = marketplace.abi;
const nftABI = nft.abi;
const splitterABI = splitter.abi;

// Save to files
fs.writeFileSync('Marketplace-abi.json', JSON.stringify(marketplaceABI, null, 2));
fs.writeFileSync('StrDomainsNFT-abi.json', JSON.stringify(nftABI, null, 2));
fs.writeFileSync('RoyaltySplitter-abi.json', JSON.stringify(splitterABI, null, 2));

console.log('✅ ABIs extracted successfully!');
console.log('📁 Files created:');
console.log('  - Marketplace-abi.json');
console.log('  - StrDomainsNFT-abi.json');
console.log('  - RoyaltySplitter-abi.json');
EOF

# Run it
node extract-abis.js
```

### Step 3: Copy ABIs to React Project

```bash
# Copy the extracted ABIs
cp Marketplace-abi.json /Users/alex.codreanu/Desktop/marketplace-dapp/src/contracts/abis/Marketplace.json
cp StrDomainsNFT-abi.json /Users/alex.codreanu/Desktop/marketplace-dapp/src/contracts/abis/StrDomainsNFT.json
cp RoyaltySplitter-abi.json /Users/alex.codreanu/Desktop/marketplace-dapp/src/contracts/abis/RoyaltySplitter.json
```

## 🚨 Quick Alternative: Manual Copy

If you can't run the script, manually:

1. Open: `artifacts/contracts/Marketplace.sol/Marketplace.json`
2. Find the `"abi": [...]` section
3. Copy just the array `[...]`
4. Paste into: `/Users/alex.codreanu/Desktop/marketplace-dapp/src/contracts/abis/Marketplace.json`

Repeat for the other two contracts.

## 🎯 Based on Your Contracts

Your contracts have these key functions:

### Marketplace.sol
```solidity
uint256 public lastListingId;  // Auto-generates: lastListingId() returns (uint256)

mapping(uint256 => Listing) public listings;  // Auto-generates: listings(uint256) returns (Listing)

function listToken(address nft, uint256 tokenId, uint256 price) external returns (uint256)
function buy(uint256 listingId) external payable
function updateListing(uint256 listingId, uint256 newPrice) external
function cancelListing(uint256 listingId) external
function getListing(uint256 listingId) external view returns (Listing memory)
function withdrawFees() external
```

### StrDomainsNFT.sol
```solidity
function mint(address to, string memory uri) external returns (uint256)
function getTokenData(uint256) external view returns (address, uint64, string, uint256, uint64)
function ownerOf(uint256) external view returns (address)
function royaltyInfo(uint256, uint256) external view returns (address, uint256)
function hasRole(bytes32, address) external view returns (bool)
```

## ✅ Verify the Fix

After copying the real ABIs, the app should work because:

1. ✅ `lastListingId()` will properly return `0` (not empty bytes)
2. ✅ All other functions will match the deployed contract
3. ✅ The SDK will work exactly like your backend

## 📍 Where Are You Stuck?

Tell me:
1. **Where is your contract project?** (the folder with `artifacts/`)
2. **Can you access those artifact JSON files?**
3. **Do you want me to generate the ABIs from the Solidity code?**

Once you provide the real ABIs, everything will work! The fallback scanning I added will handle empty marketplaces correctly.

