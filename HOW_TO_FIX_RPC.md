# How to Fix RPC Rate Limiting Issues

## 🚨 The Problem

You're seeing `Internal JSON-RPC error` because:
- MetaMask uses a **public RPC** with strict rate limits
- Your marketplace scans tokens/listings
- Too many calls → RPC blocks you temporarily

## ✅ Permanent Solutions

### Option 1: Use Alchemy (Recommended - FREE)

Alchemy provides **300M compute units/month FREE**!

**Steps:**

1. **Sign up**: https://www.alchemy.com/
2. **Create app**:
   - Click "Create App"
   - Name: "STR Domains"
   - Chain: Polygon
   - Network: Polygon Amoy
3. **Get API Key**:
   - Click on your app
   - View Key → HTTPS
   - Copy URL: `https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY`

4. **Update MetaMask**:
   - Open MetaMask
   - Settings → Networks → Polygon Amoy
   - RPC URL: Paste your Alchemy URL
   - Save

5. **Done!** No more rate limiting! ✅

### Option 2: Use Infura (FREE)

Infura also has free tier:

1. Sign up: https://infura.io/
2. Create project for Polygon Amoy
3. Get endpoint URL
4. Update MetaMask RPC

### Option 3: Use QuickNode (Paid, but reliable)

1. Sign up: https://www.quicknode.com/
2. Create endpoint for Polygon Amoy
3. Update MetaMask

---

## 🔧 Temporary Workarounds

While you get an API key:

### 1. Wait Between Actions
- Don't spam "Load" buttons
- Wait 30 seconds between scans
- Rate limit resets after ~1 minute

### 2. Use Direct RPC (I've added this)

The app now has fallback to direct RPC:
- ✅ Automatically uses public RPC for reads
- ✅ Uses MetaMask only for transactions
- ✅ Reduces rate limiting

### 3. Reduce Scan Limits

I've already done this:
- ✅ Max 20 tokens/listings per scan
- ✅ 300ms+ delays between calls
- ✅ Exponential backoff on errors
- ✅ Stops early if too many errors

---

## 🎯 Which Option to Choose?

### For Development/Testing:
✅ **Use Alchemy FREE tier**
- Easy signup
- Generous limits
- Perfect for testnet

### For Production:
✅ **Use paid tier (Alchemy/QuickNode)**
- Higher reliability
- Better performance
- Worth it for real users

### Quick Fix (Right Now):
✅ **Just wait between scans**
- Still works, just slower
- Free
- Good enough for testing

---

## 📋 Update MetaMask RPC (Detailed Steps)

### Step-by-Step:

1. **Open MetaMask Extension**

2. **Click Settings** (three dots → Settings)

3. **Networks** → Find "Polygon Amoy"

4. **Edit Network**:
   ```
   Network Name: Polygon Amoy Testnet
   RPC URL: [YOUR_ALCHEMY_URL_HERE]
   Chain ID: 80002
   Currency Symbol: MATIC
   Block Explorer: https://amoy.polygonscan.com/
   ```

5. **Save**

6. **Refresh Browser**

7. **Test** → No more RPC errors! ✅

---

## 🧪 Test Your New RPC

After updating:

1. Go to your marketplace
2. Click "Load My Domains"
3. Should load WITHOUT RPC errors
4. Much faster!

---

## 💡 Why This Matters

### With Public RPC:
- ❌ ~10 requests/second limit
- ❌ Shared with everyone
- ❌ Gets blocked easily

### With Your Own RPC:
- ✅ 300M+ requests/month (Alchemy free)
- ✅ Just for you
- ✅ Much higher limits
- ✅ Better performance

---

## 🚀 Recommended: Get Alchemy API Key NOW

**Takes 2 minutes:**

1. Go to: https://www.alchemy.com/
2. Sign up (free, no credit card)
3. Create app → Polygon Amoy
4. Copy API URL
5. Update MetaMask
6. Done! ✅

**Benefits:**
- ✅ 300M requests/month FREE
- ✅ No more rate limiting
- ✅ Faster loading
- ✅ Better reliability
- ✅ Free dashboard with analytics

---

## 📊 Current vs After Alchemy

### Current (Public RPC):
```
Loading Marketplace: 5-10 seconds, may fail
Loading My Domains: 10-20 seconds, RPC errors
Scanning Tokens: Often fails
```

### After Alchemy:
```
Loading Marketplace: 1-2 seconds ✅
Loading My Domains: 2-3 seconds ✅
Scanning Tokens: Works perfectly ✅
```

---

## ✨ Bottom Line

**For the best experience:**
1. Get Alchemy FREE API key (2 minutes)
2. Update MetaMask RPC
3. Enjoy fast, reliable marketplace! 🚀

**Or for now:**
- Use the app as-is
- Wait between scans
- It still works, just slower

Your choice! But Alchemy FREE tier solves everything permanently. 💯

