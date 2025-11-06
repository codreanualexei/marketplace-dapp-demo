# Transaction Fee Calculation Explanation

## Overview

Transaction fees (gas fees) in your marketplace dApp are calculated using a multi-step process that includes gas estimation, safety buffers, and dynamic gas price fetching from the blockchain network.

## Fee Calculation Formula

### For EIP-1559 Networks (like Polygon):
```
Total Fee = Gas Limit × maxFeePerGas
```

### For Legacy Networks:
```
Total Fee = Gas Limit × gasPrice
```

## Step-by-Step Process

### Step 1: Gas Estimation
For each operation (mint, buy, list, etc.), the SDK first estimates how much gas will be needed:

```typescript
// Example for minting
gasEstimate = await this.nftContractWrite.mint.estimateGas(originalCreator, URI, domainName);
```

**What this does:**
- Calls the contract function in a dry-run mode
- Returns the exact amount of gas units needed
- This is the **base gas requirement** for your specific operation

### Step 2: Add Safety Buffer (20%)
The code adds a 20% safety buffer to the estimate:

```typescript
let gasLimit = estimatedGas + (estimatedGas * BigInt(20)) / BigInt(100);
```

**Example:**
- If estimation returns: 200,000 gas units
- With 20% buffer: 200,000 + 40,000 = **240,000 gas units**

**Why?** This prevents transactions from failing if contract execution uses slightly more gas than estimated.

### Step 3: Apply Operation-Specific Limits

Each operation type has minimum and maximum gas limits:

| Operation | Minimum | Maximum | Reason |
|-----------|---------|---------|--------|
| **Mint** | 150,000 | 600,000 | Creating NFT + royalty splitter |
| **Buy** | 100,000 | 1,000,000 | Complex: transfer NFT + pay royalties + fees |
| **List** | 200,000 | 800,000 | Approve + transfer NFT to marketplace |
| **Approve** | 50,000 | 300,000 | Simple approval operation |
| **Update** | 100,000 | 500,000 | Price update only |
| **Cancel** | 100,000 | 500,000 | Return NFT from marketplace |
| **Withdraw** | 100,000 | 500,000 | Transfer funds |

**Rules:**
- If calculated gas < minimum → Use minimum
- If calculated gas > maximum → Cap at maximum (unless it's reasonable up to 2x max)

### Step 4: Get Current Network Gas Prices

The SDK fetches current gas prices from the blockchain:

```typescript
const feeData = await this.provider.getFeeData();
```

This returns:
- **EIP-1559 networks**: `maxFeePerGas` and `maxPriorityFeePerGas`
- **Legacy networks**: `gasPrice`

**Important:** These prices come from the network itself and reflect current market conditions.

### Step 5: Add Gas Price Buffer (15%)

To ensure faster confirmation, the code adds a 15% buffer to gas prices:

```typescript
// For EIP-1559
maxFeePerGas = feeData.maxFeePerGas + (feeData.maxFeePerGas * 15) / 100
maxPriorityFeePerGas = feeData.maxPriorityFeePerGas + (feeData.maxPriorityFeePerGas * 15) / 100

// For Legacy
gasPrice = feeData.gasPrice + (feeData.gasPrice * 15) / 100
```

**Example:**
- Network suggests: 30 gwei
- With 15% buffer: 30 + 4.5 = **34.5 gwei**

**Why?** This makes your transaction more attractive to miners/validators, leading to faster confirmation.

### Step 6: Calculate Total Fee

Final calculation:

```typescript
// EIP-1559
Total Fee = Gas Limit × maxFeePerGas

// Legacy
Total Fee = Gas Limit × gasPrice
```

## Real-World Example: Minting

Let's trace through a mint operation:

1. **Gas Estimation**: 250,000 gas units
2. **Add 20% buffer**: 250,000 × 1.20 = 300,000 gas units
3. **Check limits**: 300,000 is within mint limits (150k-600k) ✅
4. **Get network gas price**: 30 gwei (from Polygon network)
5. **Add 15% buffer**: 30 × 1.15 = 34.5 gwei
6. **Calculate total**: 300,000 × 34.5 gwei = 10,350,000 gwei = 0.01035 MATIC

## Why Fees Might Increase

### 1. Network Gas Prices Increased
- Network congestion increases gas prices
- Your code fetches current prices, so fees adjust automatically
- **Solution**: Wait for less congested times, or this is normal network behavior

### 2. Gas Limit Buffers
- The 20% gas limit buffer ensures transactions don't fail
- The 15% gas price buffer ensures faster confirmation
- **Trade-off**: Higher fees but more reliable transactions

### 3. Operation Complexity
- More complex operations (like buy with royalties) need more gas
- Minting creates NFT + royalty splitter, so it's more expensive
- **This is normal** - more complex = more gas needed

### 4. Contract Changes
- If you updated the contract with more logic, it may use more gas
- New fields (like `domainName`) add to gas costs

## Polygon Amoy Testnet Considerations

For Polygon Amoy (your configured testnet), the code uses **legacy gas pricing**:

```typescript
if (isConfiguredTestnet) {
  // Uses legacy gasPrice instead of EIP-1559
  gasSettings.gasPrice = feeData.gasPrice + (feeData.gasPrice * 15) / 100;
}
```

This is done to avoid MetaMask compatibility issues on testnets.

## Fee Breakdown Summary

```
Transaction Fee = Gas Limit × Gas Price

Where:
- Gas Limit = Estimated Gas × 1.20 (with min/max caps)
- Gas Price = Network Price × 1.15 (for faster confirmation)

Total Buffers Applied:
- Gas Limit: +20% safety buffer
- Gas Price: +15% speed buffer
- Combined overhead: ~38% (1.20 × 1.15 = 1.38)
```

## Where Fees Are Visible

The fees you see in MetaMask are calculated by:
1. **Gas Limit**: From your SDK's calculation (with buffers)
2. **Gas Price**: From network + 15% buffer
3. **Total Cost**: MetaMask multiplies them together

MetaMask may also show:
- **USD equivalent**: Based on current MATIC price
- **Speed options**: You can adjust, but SDK suggests optimal settings

## Recommendations

If fees seem high:

1. **Check network congestion**: Polygon Amoy gas prices fluctuate
2. **Gas limit buffers are necessary**: They prevent failed transactions (which cost gas anyway)
3. **Gas price buffer ensures speed**: Without it, transactions might take longer
4. **Complex operations cost more**: Minting with royalty splitter is more expensive than simple transfers

## Code Locations

- Gas estimation: Each operation function (e.g., `mintDomain`, `buyToken`)
- Gas calculation: `calculateOptimalGasSettings()` method (lines 2728-2806)
- Gas price fetching: `getCurrentGasPrices()` method (lines 2696-2723)
- Network configuration: `src/config/network.ts`

## Monitoring Gas Usage

You can check actual gas usage in transaction receipts:
- `receipt.gasUsed` - Actual gas consumed
- Compare with `gasLimit` - What was allocated
- If `gasUsed` is much less than `gasLimit`, the buffer is working well

