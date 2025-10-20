# Wallet Integration Guide

## Overview
This dapp supports two wallet types:
- **MetaMask**: Browser extension wallet
- **WalletConnect**: Mobile wallet connection via QR code

## How It Works

### 1. Wallet Selection
- Users can choose between MetaMask and WalletConnect
- Both options are available in the header and hero section
- The selected wallet type is remembered for future sessions

### 2. Connection Flow
1. User clicks "Connect Wallet"
2. Dropdown appears with wallet options
3. User selects preferred wallet type
4. Connection process begins
5. Wallet type is stored in localStorage as `preferredWallet`

### 3. Auto-Connect Logic
- On page refresh, the app checks for previous connections
- If user has a preferred wallet, it tries that first
- Falls back to checking both MetaMask and WalletConnect
- Only auto-connects if user hasn't explicitly disconnected

### 4. Disconnection
- When user disconnects, both wallets are properly cleaned up
- `walletDisconnected` flag is set to prevent auto-connect
- `preferredWallet` is removed from localStorage

## Technical Details

### localStorage Keys
- `preferredWallet`: Stores user's preferred wallet type ('metamask' or 'walletconnect')
- `walletDisconnected`: Set to 'true' when user manually disconnects

### WalletConnect Configuration
- Project ID required: `REACT_APP_WALLETCONNECT_PROJECT_ID`
- Supported chains: Ethereum, Polygon, BSC, Avalanche, Polygon Amoy
- Relay URL: `wss://relay.walletconnect.com`

### Network Switching
- Both wallets support network switching
- Automatic network addition for MetaMask
- Manual setup guide for WalletConnect when automatic switching fails

## Troubleshooting

### WalletConnect Not Working
1. Ensure `REACT_APP_WALLETCONNECT_PROJECT_ID` is set in environment variables
2. Check browser console for connection logs
3. Try refreshing the page and connecting again
4. Ensure mobile wallet app supports WalletConnect

### MetaMask Auto-Connecting
1. This is expected behavior if user previously connected MetaMask
2. To prevent auto-connect, disconnect explicitly using the disconnect button
3. Clear browser storage if needed

### Network Switching Issues
1. For WalletConnect: Use the "Need Help?" button for manual setup
2. For MetaMask: Ensure the network is added to your wallet
3. Check that you're on the correct network (Polygon Amoy for this dapp)

## Development Notes

### File Structure
- `src/contexts/WalletContext.tsx`: Main wallet logic and state management
- `src/Components/WalletButton.tsx`: Header wallet connection component
- `src/Components/Hero.tsx`: Hero section wallet connection
- `src/Components/NetworkChecker.tsx`: Network validation and switching

### Key Functions
- `connectWallet(walletType)`: Connect to specified wallet type
- `disconnectWallet()`: Disconnect current wallet and cleanup
- `switchNetwork(chainId)`: Switch to specified network
- Auto-connect logic in useEffect with proper cleanup

### Event Handling
- Account changes: Updates balance and state
- Chain changes: Reloads page to update network
- Disconnect events: Properly cleans up state
- Session updates: Logs but doesn't disconnect

## Best Practices

1. **Always check wallet state** before making blockchain calls
2. **Handle connection errors gracefully** with user-friendly messages
3. **Provide clear feedback** during connection process
4. **Respect user preferences** for wallet type selection
5. **Clean up properly** on disconnection to prevent memory leaks

