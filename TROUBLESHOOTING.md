# Troubleshooting Guide

## Common Issues and Solutions

### 🔍 Issue: "No listings found" / Empty Marketplace

**Why this happens:**
- The marketplace contract may have no listings yet
- This is **normal** if no one has listed domains yet

**Solution:**
1. ✅ This is expected behavior - the marketplace starts empty
2. List your first domain:
   - Go to "My Domains"
   - Click "List for Sale" on any domain you own
   - Set a price and confirm
   - Your domain will appear on the marketplace!

**If you don't own any domains:**
- You'll need NFTs minted first
- Contact the contract admin to mint domains
- Or wait for someone else to list

---

### 🔍 Issue: Royalties Page Shows Errors

**Console Error:** `Error get token data`

**Why this happens:**
- The SDK is scanning for tokens in the collection
- Some token IDs don't exist (normal for NFTs)
- The scanner stops after finding consecutive gaps

**Solution:**
✅ **This is normal!** The errors are handled gracefully:
- The SDK automatically skips non-existent tokens
- Stops after 5 consecutive failures
- Returns valid tokens found

**What you'll see:**
- If no tokens exist: Empty state "No royalties available"
- If tokens exist but no royalties: Shows 0 balance
- If royalties available: Shows withdrawal buttons

---

### 🔍 Issue: Contract Call Errors

**Error:** `could not decode result data (value="0x")`

**Why this happens:**
1. Contract might not have that function
2. Contract returns empty data (no listings/tokens)
3. Wrong contract address

**Solution:**

**Step 1: Verify Contract Addresses**
Check your `.env` file:
```bash
cat .env
```

Should show:
```
REACT_APP_MARKETPLACE_ADDRESS=0x75201083D96114982B1b08176C87E2ec3e39dDb1
REACT_APP_STR_DOMAIN_NFT_COLLECTION=0x8255d9f7f51AD2B5CC7fBDFc1D9A967bD19EDD6a
```

**Step 2: Verify Network**
- Make sure you're on **Polygon Amoy** (Chain ID: 80002)
- Check MetaMask shows the correct network

**Step 3: Check Contracts on Explorer**
Visit: https://amoy.polygonscan.com/

Search for your contract addresses and verify they're deployed.

---

### 🔍 Issue: Transactions Failing

**Error:** Transaction reverted or failed

**Common Causes & Solutions:**

1. **Insufficient MATIC for gas**
   - Get testnet MATIC: https://faucet.polygon.technology/
   - Need ~0.01 MATIC per transaction

2. **Wrong network**
   - Switch to Polygon Amoy in MetaMask
   - Chain ID should be 80002

3. **NFT not approved**
   - When listing, two transactions needed:
     1. Approve NFT for marketplace
     2. List on marketplace
   - Don't reject the first transaction!

4. **Already listed**
   - Can't list the same NFT twice
   - Cancel existing listing first

---

### 🔍 Issue: Can't See My Domains

**Why this happens:**
- You don't own any NFTs in the collection
- Wrong wallet connected
- Contract not returning data

**Solution:**

1. **Verify Wallet**
   - Check connected address in header
   - Make sure it's the right wallet

2. **Check Ownership**
   - View contract on Polygonscan
   - Check "Read Contract" → `ownerOf(tokenId)`
   - Your address should match

3. **Request Minting** (if admin)
   - Go to "My Domains" (future feature)
   - Or ask contract owner to mint

---

### 🔍 Issue: Wallet Won't Connect

**Solutions:**

1. **Install MetaMask**
   - Download from: https://metamask.io/

2. **Unlock MetaMask**
   - Open extension
   - Enter password
   - Try connecting again

3. **Refresh Page**
   - Sometimes a simple refresh helps
   - Clear cache if needed

4. **Check Browser**
   - Use Chrome, Firefox, or Brave
   - MetaMask supported browsers only

---

### 🔍 Issue: "Please approve..." Message

**This is normal!** Some operations need approval:

**Listing a domain:**
1. First TX: Approve NFT for marketplace ✅
2. Second TX: List on marketplace ✅
3. Both must succeed!

**Don't reject either transaction** or listing will fail.

---

### 🔍 Issue: Slow Loading

**Why this happens:**
- Blockchain calls take time
- Many tokens to scan
- Network congestion

**Solution:**
✅ **Be patient!** The app is working:
- Loading spinners show progress
- Console logs show what's happening
- Can take 10-30 seconds for large collections

**To speed up:**
- Better internet connection
- Try during off-peak hours
- The app caches data when possible

---

## Debug Mode

**Check Console Logs:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for:
   - ✅ Green "success" messages
   - ⚠️ Yellow "warn" messages (often OK)
   - ❌ Red "error" messages (issues)

**What warnings are OK:**
- `No listings found on marketplace` ← Normal if empty
- `Token X does not exist` ← Normal when scanning
- `Failed to get tokenData` ← Normal for gaps

**What errors need attention:**
- `Failed to connect wallet` ← Check MetaMask
- `Wrong network` ← Switch to Amoy
- `Transaction failed` ← Check gas/network

---

## Contract Verification Checklist

**Before reporting an issue, verify:**

✅ **Network Settings**
- [ ] On Polygon Amoy (Chain ID: 80002)
- [ ] RPC URL: https://rpc-amoy.polygon.technology
- [ ] Have testnet MATIC

✅ **Wallet**
- [ ] MetaMask installed
- [ ] Wallet unlocked
- [ ] Connected to dApp
- [ ] Correct account selected

✅ **Contracts**
- [ ] Marketplace: 0x75201083D96114982B1b08176C87E2ec3e39dDb1
- [ ] NFT Collection: 0x8255d9f7f51AD2B5CC7fBDFc1D9A967bD19EDD6a
- [ ] Both deployed on Amoy

✅ **Environment**
- [ ] `.env` file exists
- [ ] Contract addresses correct
- [ ] App restarted after `.env` changes

---

## Expected Behavior

### When Marketplace is Empty:
✅ "No listings found"
✅ Empty grid
✅ Message to list domains
✅ **This is normal!**

### When No Royalties:
✅ "No royalties available"
✅ 0 MATIC balance
✅ Empty splitter list
✅ **This is normal!**

### When No Tokens:
✅ "No domains found"
✅ Empty collection
✅ **This is normal!**

---

## Getting Help

**If issues persist:**

1. **Check Console**
   - Copy full error message
   - Note which page/action caused it

2. **Verify Contracts**
   - Visit Polygonscan
   - Confirm contracts exist
   - Check contract has the functions

3. **Test Network**
   - Try simple transaction
   - Transfer small MATIC
   - Confirms network works

4. **Report Issue**
   - Include error message
   - Which page/action
   - Network details
   - Contract addresses used

---

## Quick Fixes

**90% of issues solved by:**

1. ✅ Refresh the page
2. ✅ Reconnect wallet
3. ✅ Switch to correct network
4. ✅ Get testnet MATIC
5. ✅ Restart browser

**Try these first!** ⚡

---

## Still Having Issues?

**The app has robust error handling:**
- Empty states are normal
- Warnings in console are OK
- Errors are caught gracefully

**Most "errors" are actually:**
- Empty marketplace (no listings yet)
- No tokens in collection
- No royalties accumulated

**All of these are normal states!** ✅

Just start using the marketplace and the data will populate! 🚀

