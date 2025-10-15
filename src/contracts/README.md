# Smart Contracts

This directory should contain your smart contract ABIs and addresses.

## Structure

```
contracts/
├── abis/
│   ├── NFTMarketplace.json
│   └── NFT.json
├── addresses.ts
└── README.md
```

## Example: Using Contracts

All contract interactions go through **MarketplaceSDK**:

```typescript
import { useMarketplaceSDK } from '../hooks/useMarketplaceSDK';

function MyComponent() {
  const sdk = useMarketplaceSDK();
  
  // All contract methods available:
  await sdk.buyToken(listingId);
  await sdk.listToken(tokenId, price);
  await sdk.getMyDomainsFromCollection();
  // etc.
}
```

## Getting Contract ABIs

After deploying your smart contracts, you can get the ABI from:

1. **Hardhat**: `artifacts/contracts/YourContract.sol/YourContract.json`
2. **Truffle**: `build/contracts/YourContract.json`
3. **Remix**: Copy from the compile tab
4. **Etherscan**: Verified contracts show the ABI

## Example Smart Contract (Solidity)

### NFT Marketplace Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    // NFT address => token ID => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    event NFTListed(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    event NFTSold(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );

    event ListingCanceled(
        address indexed nftAddress,
        uint256 indexed tokenId
    );

    function listNFT(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external {
        require(price > 0, "Price must be greater than 0");
        
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
            nft.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );

        listings[nftAddress][tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit NFTListed(nftAddress, tokenId, msg.sender, price);
    }

    function buyNFT(
        address nftAddress,
        uint256 tokenId
    ) external payable nonReentrant {
        Listing memory listing = listings[nftAddress][tokenId];
        require(listing.active, "NFT not listed");
        require(msg.value >= listing.price, "Insufficient payment");

        listings[nftAddress][tokenId].active = false;

        IERC721(nftAddress).safeTransferFrom(
            listing.seller,
            msg.sender,
            tokenId
        );

        payable(listing.seller).transfer(msg.value);

        emit NFTSold(nftAddress, tokenId, msg.sender, msg.value);
    }

    function cancelListing(
        address nftAddress,
        uint256 tokenId
    ) external {
        Listing memory listing = listings[nftAddress][tokenId];
        require(listing.active, "NFT not listed");
        require(listing.seller == msg.sender, "Not the seller");

        listings[nftAddress][tokenId].active = false;

        emit ListingCanceled(nftAddress, tokenId);
    }

    function getListing(
        address nftAddress,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return listings[nftAddress][tokenId];
    }
}
```

## Deployment

### Using Hardhat

1. Install Hardhat:
```bash
npm install --save-dev hardhat
```

2. Create deployment script:
```javascript
// scripts/deploy.js
async function main() {
  const NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
  const marketplace = await NFTMarketplace.deploy();
  await marketplace.deployed();
  
  console.log("NFTMarketplace deployed to:", marketplace.address);
}

main();
```

3. Deploy:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Update Your DApp

After deployment, update:
- Contract addresses in `src/hooks/useNFTMarketplace.ts`
- Contract ABIs if you have custom functions
- Network configuration in `src/utils/constants.ts`

## Testing Contracts

Before deploying to mainnet:
1. Test on local network (Hardhat/Ganache)
2. Deploy to testnet (Sepolia, Mumbai)
3. Thoroughly test all functions
4. Get contracts audited if handling significant value
5. Deploy to mainnet

## Resources

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [ethers.js Documentation](https://docs.ethers.org/v6/)

