# Network Configuration Guide

This marketplace DApp supports configurable networks through environment variables. You can easily switch between different networks by updating your `.env` file.

## Environment Variables

The following environment variables control the network configuration:

```bash
# Network configuration
REACT_APP_CHAIN_ID=80002
REACT_APP_NETWORK_NAME="Polygon Amoy"
REACT_APP_RPC_URL=https://rpc-amoy.polygon.technology
REACT_APP_BLOCK_EXPLORER_URL=https://amoy.polygonscan.com
```

## Supported Networks

### Polygon Amoy (Testnet) - Default
```bash
REACT_APP_CHAIN_ID=80002
REACT_APP_NETWORK_NAME="Polygon Amoy"
REACT_APP_RPC_URL=https://rpc-amoy.polygon.technology
REACT_APP_BLOCK_EXPLORER_URL=https://amoy.polygonscan.com
```

### Polygon Mainnet
```bash
REACT_APP_CHAIN_ID=137
REACT_APP_NETWORK_NAME="Polygon"
REACT_APP_RPC_URL=https://polygon-rpc.com
REACT_APP_BLOCK_EXPLORER_URL=https://polygonscan.com
```

### Ethereum Mainnet
```bash
REACT_APP_CHAIN_ID=1
REACT_APP_NETWORK_NAME="Ethereum"
REACT_APP_RPC_URL=https://eth.llamarpc.com
REACT_APP_BLOCK_EXPLORER_URL=https://etherscan.io
```

### Ethereum Sepolia (Testnet)
```bash
REACT_APP_CHAIN_ID=11155111
REACT_APP_NETWORK_NAME="Sepolia"
REACT_APP_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
REACT_APP_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
```

### Arbitrum One
```bash
REACT_APP_CHAIN_ID=42161
REACT_APP_NETWORK_NAME="Arbitrum One"
REACT_APP_RPC_URL=https://arb1.arbitrum.io/rpc
REACT_APP_BLOCK_EXPLORER_URL=https://arbiscan.io
```

### Arbitrum Sepolia (Testnet)
```bash
REACT_APP_CHAIN_ID=421614
REACT_APP_NETWORK_NAME="Arbitrum Sepolia"
REACT_APP_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
REACT_APP_BLOCK_EXPLORER_URL=https://sepolia.arbiscan.io
```

### Optimism
```bash
REACT_APP_CHAIN_ID=10
REACT_APP_NETWORK_NAME="Optimism"
REACT_APP_RPC_URL=https://mainnet.optimism.io
REACT_APP_BLOCK_EXPLORER_URL=https://optimistic.etherscan.io
```

### Base
```bash
REACT_APP_CHAIN_ID=8453
REACT_APP_NETWORK_NAME="Base"
REACT_APP_RPC_URL=https://mainnet.base.org
REACT_APP_BLOCK_EXPLORER_URL=https://basescan.org
```

## How to Switch Networks

1. **Copy the environment template:**
   ```bash
   cp env.example .env
   ```

2. **Update your `.env` file** with the desired network configuration

3. **Restart the development server:**
   ```bash
   npm start
   ```

## Features

### Automatic Network Detection
- The DApp automatically detects the configured network on startup
- Validates network configuration and shows errors if invalid

### Automatic Network Switching
- When users try to perform transactions on the wrong network, the DApp automatically attempts to switch to the correct network
- Falls back to manual switching instructions if automatic switching fails

### Smart Network Guard
- All transactions are protected by a network guard that ensures users are on the correct network
- Provides clear error messages and switching instructions

### Dynamic UI Updates
- Network checker banner shows the correct network name
- Error messages use the configured network name
- All network-related UI elements are dynamically updated

## Custom Networks

You can also configure custom networks by providing:

- `REACT_APP_CHAIN_ID`: The chain ID of your network
- `REACT_APP_NETWORK_NAME`: A friendly name for your network
- `REACT_APP_RPC_URL`: The RPC endpoint URL
- `REACT_APP_BLOCK_EXPLORER_URL`: The block explorer URL (optional)

The DApp will automatically handle native currency detection based on common chain IDs, but you can extend the configuration in `src/config/network.ts` for custom networks.

## Security Notes

- Always verify the RPC URL and chain ID before using in production
- Use HTTPS URLs for RPC endpoints
- Consider using your own RPC provider for better reliability and rate limits
