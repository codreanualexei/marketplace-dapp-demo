# Features Guide - STR Domains Marketplace

## 🎉 Your Marketplace is Fully Integrated!

All SDK functionality is now accessible through a beautiful, user-friendly interface.

---

## 📄 Pages Overview

### 1. **Home** (`/`)
- Hero section with call-to-action buttons
- Featured domains (first 6 active listings)
- Quick navigation to marketplace and your domains

### 2. **Marketplace** (`/marketplace`)
**Browse and Buy Domains**
- View all listed domains
- Filter: Active Listings / All Listings
- Real-time data from blockchain
- Buy domains with one click
- See seller information, prices, and token IDs

**Features:**
- ✅ Buy NFTs instantly
- ✅ Filter active/sold listings
- ✅ Refresh listings
- ✅ Shows listing status (active/sold)
- ✅ Your own listings show "Your Listing" (can't buy your own)

### 3. **My Domains** (`/my-domains`)
**List Your NFTs for Sale**
- View all domains you own
- List domains on the marketplace
- Set custom prices in MATIC
- See domain metadata (creator, mint date, last price)

**Features:**
- ✅ View all your owned domains
- ✅ List domains with custom price
- ✅ Automatic approval handling
- ✅ Domain count statistics

### 4. **My Listings** (`/my-listings`)
**Manage Your Active Listings**
- View all your listings (active and sold)
- Update listing prices
- Cancel listings
- Track sales history

**Features:**
- ✅ Update prices for active listings
- ✅ Cancel listings
- ✅ View listing statistics (active/sold/total)
- ✅ Separate sections for active and sold

### 5. **Royalties** (`/royalties`)
**Claim Your Earnings**
- **Creator Royalties:** Earnings from domains you created
- **Minter Royalties:** Earnings from NFTs you minted
- **Marketplace Fees:** (Admin only) Platform fees from all sales

**Features:**
- ✅ View all splitter balances
- ✅ Withdraw from individual splitters
- ✅ Withdraw all royalties at once
- ✅ Admin: Withdraw marketplace fees
- ✅ Real-time balance updates

---

## 🎯 Complete Feature List

### Marketplace Features

#### 🛒 **Buy Domains**
1. Go to **Marketplace**
2. Browse available domains
3. Click **Buy Now** on any domain
4. Confirm the transaction in MetaMask
5. ✅ Domain is transferred to you!

#### 📝 **List Your Domains**
1. Go to **My Domains**
2. Click **List for Sale** on any domain
3. Enter price in MATIC
4. Click **Confirm**
5. Approve in MetaMask (automatic)
6. ✅ Domain is listed on marketplace!

#### 💰 **Update Listing Price**
1. Go to **My Listings**
2. Find your active listing
3. Click **Update Price**
4. Enter new price
5. Click **Update**
6. Confirm in MetaMask
7. ✅ Price updated!

#### ❌ **Cancel Listing**
1. Go to **My Listings**
2. Find your active listing
3. Click **Cancel Listing**
4. Confirm in MetaMask
5. ✅ Listing removed from marketplace!

#### 💎 **Claim Creator/Minter Royalties**
1. Go to **Royalties**
2. See your available royalties
3. Options:
   - **Withdraw** from individual splitter
   - **Withdraw All** from all splitters at once
4. Confirm in MetaMask
5. ✅ Royalties sent to your wallet!

#### ⚙️ **Claim Marketplace Fees (Admin Only)**
1. Go to **Royalties**
2. Scroll to "Marketplace Fees" section
3. Click **Withdraw Marketplace Fees**
4. Confirm in MetaMask
5. ✅ Fees sent to your wallet!

---

## 🚀 Quick Start Guide

### First Time Setup
1. **Connect Wallet**
   - Click "Connect Wallet" in header
   - Approve in MetaMask
   - Switch to Polygon Amoy if needed

2. **Get Test MATIC**
   - Visit: https://faucet.polygon.technology/
   - Enter your wallet address
   - Receive testnet MATIC for transactions

3. **Explore Marketplace**
   - Click "Marketplace" in navigation
   - Browse available domains
   - Click "Buy Now" to purchase

### Buy Your First Domain
```
1. Marketplace → Find a domain you like
2. Click "Buy Now"
3. Confirm in MetaMask
4. Wait for transaction
5. Check "My Domains" to see your purchase!
```

### List Your First Domain
```
1. My Domains → See your domains
2. Click "List for Sale"
3. Enter price (e.g., "2.5" for 2.5 MATIC)
4. Click "Confirm"
5. Approve in MetaMask (2 transactions)
6. Check "Marketplace" to see your listing!
```

### Claim Your First Royalties
```
1. Royalties → View available balances
2. Click "Withdraw All" for all splitters
3. Or click "Withdraw" for individual splitter
4. Confirm in MetaMask
5. MATIC sent to your wallet!
```

---

## 💡 Pro Tips

### For Buyers
- ✅ Check creator address before buying
- ✅ Compare prices across similar domains
- ✅ Your purchased domains appear in "My Domains"
- ✅ Can't buy your own listings (they show "Your Listing")

### For Sellers
- ✅ List at competitive prices to sell faster
- ✅ Update prices anytime in "My Listings"
- ✅ Cancel listings to delist from marketplace
- ✅ Track sales in "My Listings" (sold section)

### For Creators/Minters
- ✅ Check royalties regularly in "Royalties" page
- ✅ Withdraw all at once to save on gas fees
- ✅ Each splitter contract holds royalties from specific NFTs
- ✅ Royalties accumulate automatically from sales

### For Marketplace Owners
- ✅ Admin status detected automatically
- ✅ Marketplace fees section only visible to admins
- ✅ Withdraw accumulated platform fees anytime
- ✅ Check fees balance before withdrawing

---

## 🔄 Transaction Flow

### Buying a Domain
```
User clicks "Buy Now"
  ↓
Confirmation dialog
  ↓
Transaction sent to blockchain
  ↓
Payment transferred to seller
  ↓
NFT transferred to buyer
  ↓
Royalties distributed to splitters
  ↓
Success! Domain now in "My Domains"
```

### Listing a Domain
```
User clicks "List for Sale"
  ↓
Enter price
  ↓
Approve NFT for marketplace (Transaction 1)
  ↓
List on marketplace (Transaction 2)
  ↓
Success! Domain appears on marketplace
```

### Claiming Royalties
```
User clicks "Withdraw"
  ↓
Transaction sent to splitter contract
  ↓
Balance checked
  ↓
MATIC transferred to wallet
  ↓
Success! Balance received
```

---

## 📊 Dashboard Statistics

### Home Page
- Featured domains (live from blockchain)
- Quick action buttons

### Marketplace
- Active listings count
- Total listings count
- Filter toggle

### My Domains
- Total domains owned

### My Listings
- Active listings count
- Sold listings count
- Total listings count

### Royalties
- Total royalties available
- Number of splitter contracts
- Marketplace fees (if admin)

---

## 🎨 UI Features

### Visual Indicators
- **Active listings:** Full color, "Buy Now" button
- **Sold listings:** Grayed out with "SOLD" overlay
- **Your listings:** "Your Listing" button (disabled)
- **Admin sections:** Blue border highlighting

### Interactive Elements
- **Hover effects:** Cards lift on hover
- **Loading states:** Spinners during transactions
- **Success/Error messages:** Alert dialogs
- **Confirmation dialogs:** Before important actions

### Responsive Design
- **Desktop:** Full grid layout, all features visible
- **Tablet:** Responsive grid, mobile menu
- **Mobile:** Single column, hamburger menu

---

## 🛠️ Troubleshooting

### "Transaction Failed"
- ✅ Check you have enough MATIC for gas
- ✅ Verify you're on Polygon Amoy (Chain ID: 80002)
- ✅ Try refreshing and retrying

### "Failed to load listings"
- ✅ Check your internet connection
- ✅ Verify RPC URL is working
- ✅ Try refreshing the page

### "Please connect wallet"
- ✅ Click "Connect Wallet" in header
- ✅ Make sure MetaMask is unlocked
- ✅ Approve the connection

### "Not enough MATIC"
- ✅ Visit faucet: https://faucet.polygon.technology/
- ✅ Request testnet MATIC
- ✅ Wait for confirmation

---

## 📈 Advanced Features

### Multiple Splitters
Each NFT has its own splitter contract that:
- Distributes royalties to creators and minters
- Accumulates fees from secondary sales
- Can be withdrawn independently

### Price Updates
Update listing prices without canceling:
- No need to cancel and relist
- Instant price change
- No re-approval needed

### Batch Withdrawals
Withdraw from all splitters at once:
- Saves gas compared to individual withdrawals
- Processes all available balances
- Single transaction

---

## 🎓 Learn More

### Smart Contract Addresses
```
Marketplace:     0x75201083D96114982B1b08176C87E2ec3e39dDb1
NFT Collection:  0x8255d9f7f51AD2B5CC7fBDFc1D9A967bD19EDD6a
```

### Block Explorer
View all transactions on:
https://amoy.polygonscan.com/

### Network Details
- Name: Polygon Amoy Testnet
- Chain ID: 80002
- RPC: https://rpc-amoy.polygon.technology
- Faucet: https://faucet.polygon.technology/

---

## 🎉 You're Ready!

All features are live and ready to use. Connect your wallet and start:
- 🛒 Buying domains
- 📝 Listing your domains
- 💰 Earning royalties
- ⚙️ Managing the marketplace (if admin)

**Happy trading! 🚀**

