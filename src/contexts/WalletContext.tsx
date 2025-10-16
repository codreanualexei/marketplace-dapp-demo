import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ethers } from 'ethers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { withWalletConnectErrorSuppression } from '../utils/walletConnectErrorSuppression';
import { silentWalletConnect } from '../utils/silentWalletConnect';

export type WalletType = 'metamask' | 'walletconnect';

interface WalletContextType {
  account: string | null;
  balance: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  connectWallet: (walletType?: WalletType) => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  isConnecting: boolean;
  isNetworkSwitching: boolean;
  error: string | null;
  walletType: WalletType | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [walletConnectProvider, setWalletConnectProvider] = useState<any>(null);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<number>(0);
  
  // Store WalletConnect provider globally to prevent multiple initializations
  const [wcProviderInstance, setWcProviderInstance] = useState<any>(null);

  // Add comprehensive error handling for WalletConnect session errors
  useEffect(() => {
    const handleWalletConnectError = (event: ErrorEvent) => {
      if (event.error && event.error.message && 
          event.error.message.includes('No matching key. session topic doesn\'t exist')) {
        console.log('Suppressing WalletConnect session topic error:', event.error.message);
        event.preventDefault();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message && 
          event.reason.message.includes('No matching key. session topic doesn\'t exist')) {
        console.log('Suppressing WalletConnect session topic promise rejection:', event.reason.message);
        event.preventDefault();
        return false;
      }
    };

    // Override console.error to suppress WalletConnect session errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('No matching key. session topic doesn\'t exist')) {
        console.log('Suppressing WalletConnect session topic console error:', message);
        return;
      }
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', handleWalletConnectError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleWalletConnectError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      console.error = originalConsoleError;
    };
  }, []);

  const updateBalance = async (address: string, provider: ethers.BrowserProvider) => {
    // Skip balance update if we're in the middle of a network switch
    if (isNetworkSwitching) {
      console.log('Skipping balance update during network switch');
      return;
    }
    
    try {
      const balanceWei = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balanceWei);
      setBalance(parseFloat(balanceEth).toFixed(4));
    } catch (err) {
      console.error('Error fetching balance:', err);
      // Don't set balance to null on error, keep previous value
    }
  };

  const connectWallet = async (walletType: WalletType = 'metamask') => {
    setIsConnecting(true);
    setError(null);

    try {
      if (walletType === 'metamask') {
        await connectMetaMask();
      } else if (walletType === 'walletconnect') {
        await connectWalletConnect();
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const connectMetaMask = async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      console.log('Wallet connection already in progress, skipping...');
      return;
    }

    try {
      setIsConnecting(true);
      
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Please install MetaMask to use this dApp');
      }

      // Check if MetaMask is locked
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length === 0) {
          // MetaMask is locked or no accounts connected
          console.log('MetaMask is locked or no accounts connected, requesting access...');
        }
      } catch (error) {
        console.log('MetaMask is locked, requesting access...');
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask and try again.');
      }

      const userSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();
      
      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setWalletType('metamask');
      
      await updateBalance(accounts[0], browserProvider);
      
      // Store preferred wallet type
      localStorage.setItem('preferredWallet', 'metamask');
      localStorage.removeItem('walletDisconnected');
      
      console.log('MetaMask connected successfully:', {
        account: accounts[0],
        chainId: Number(network.chainId)
      });
    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      if (error.code === 4001) {
        throw new Error('MetaMask connection was rejected by user');
      } else if (error.message?.includes('User rejected')) {
        throw new Error('MetaMask connection was rejected by user');
      } else if (error.message?.includes('locked')) {
        throw new Error('MetaMask is locked. Please unlock MetaMask and try again.');
      } else {
        throw new Error(`MetaMask connection failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWalletConnect = async (retryCount = 0): Promise<void> => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      console.log('WalletConnect connection already in progress, skipping...');
      return;
    }

    // Prevent rapid successive connection attempts (minimum 2 seconds between attempts)
    const now = Date.now();
    if (now - lastConnectionAttempt < 2000) {
      console.log('Too soon since last connection attempt, please wait...');
      // Instead of throwing an error, just return silently
      return;
    }
    setLastConnectionAttempt(now);

    return withWalletConnectErrorSuppression(async () => {
      try {
        setIsConnecting(true);
        console.log('Starting WalletConnect connection...');
        
        // Create WalletConnect provider
        const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID;
        if (!projectId) {
          throw new Error('WalletConnect Project ID not configured. Please set REACT_APP_WALLETCONNECT_PROJECT_ID in your environment variables.');
        }

        // Use silent WalletConnect wrapper to handle all errors internally
        console.log('Initializing silent WalletConnect provider...');
        const wcProvider = await silentWalletConnect.init({
          projectId: projectId,
          chains: [1, 137, 56, 43114, 80002], // Ethereum, Polygon, BSC, Avalanche, Polygon Amoy
          showQrModal: true,
          metadata: {
            name: 'STR Domains Marketplace',
            description: 'Decentralized marketplace for STR domains',
            url: window.location.origin,
            icons: [`${window.location.origin}/logo192.png`]
          },
          // Add better session management
          relayUrl: 'wss://relay.walletconnect.com',
          qrModalOptions: {
            themeMode: 'light',
            themeVariables: {
              '--wcm-z-index': '1000'
            }
          },
        });
        
        setWcProviderInstance(wcProvider);

      console.log('WalletConnect provider initialized, enabling session...');
      // Enable session (triggers QR Code modal) with comprehensive error handling
      try {
        await wcProvider.enable();
      } catch (enableError: any) {
        console.error('Error enabling WalletConnect session:', enableError);
        // If session enable fails, try to clean up and throw the error
        setWcProviderInstance(null);
        throw enableError;
      }

      console.log('WalletConnect session enabled, setting up ethers provider...');
      // Create ethers provider from WalletConnect provider
      const browserProvider = new ethers.BrowserProvider(wcProvider);
      const accounts = await browserProvider.listAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const userSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();
      
      console.log('WalletConnect connected:', {
        account: accounts[0].address,
        chainId: Number(network.chainId)
      });
      
      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(accounts[0].address);
      setChainId(Number(network.chainId));
      setWalletType('walletconnect');
      setWalletConnectProvider(wcProvider);
      
      await updateBalance(accounts[0].address, browserProvider);
      
      // Store preferred wallet type
      localStorage.setItem('preferredWallet', 'walletconnect');
      localStorage.removeItem('walletDisconnected');
      
        console.log('WalletConnect connection completed successfully');
      } catch (error: any) {
        console.error('WalletConnect connection error:', error);
        if (error.message?.includes('User rejected')) {
          throw new Error('Connection cancelled by user');
        } else if (error.message?.includes('Connection request reset') || 
                   error.message?.includes('Please try again') ||
                   error.message?.includes('connection was reset') ||
                   error.message?.includes('request was reset')) {
          // Handle connection reset silently with automatic retry
          console.log('Connection request reset detected, attempting silent retry...');
          if (retryCount < 3) {
            // Wait a bit and retry silently
            await new Promise(resolve => setTimeout(resolve, 1000 + (retryCount * 500)));
            console.log(`Silent retry attempt ${retryCount + 1}/3`);
            return connectWalletConnect(retryCount + 1);
          } else {
            console.log('Max retry attempts reached, connection failed silently');
            // Don't throw error, just fail silently
            return;
          }
        }
        throw error;
      } finally {
        setIsConnecting(false);
      }
    });
  };

  const switchNetwork = async (targetChainId: number) => {
    console.log('switchNetwork called:', { targetChainId, walletType, account });
    
    if (!walletType) {
      throw new Error('No wallet connected');
    }
    
    // Set network switching flag to prevent balance updates during transition
    setIsNetworkSwitching(true);
    
    try {
      if (walletType === 'metamask') {
        console.log('Switching MetaMask network to:', targetChainId);
        await switchMetaMaskNetwork(targetChainId);
      } else if (walletType === 'walletconnect') {
        console.log('Switching WalletConnect network to:', targetChainId);
        await switchWalletConnectNetwork(targetChainId);
      } else {
        throw new Error(`Unsupported wallet type: ${walletType}`);
      }
      
      console.log('Network switch completed successfully');
    } finally {
      // Clear network switching flag after a delay to allow provider to stabilize
      setTimeout(() => {
        setIsNetworkSwitching(false);
        // Update balance after network switch is complete
        if (account && provider) {
          updateBalance(account, provider);
        }
      }, 2000);
    }
  };

  const switchMetaMaskNetwork = async (targetChainId: number) => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not detected');
    }

    const chainIdHex = `0x${targetChainId.toString(16)}`;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      // Chain not added to MetaMask, try to add it
      if (switchError.code === 4902) {
        await addMetaMaskNetwork(targetChainId);
      } else {
        throw switchError;
      }
    }
  };

  const addMetaMaskNetwork = async (chainId: number) => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not detected');
    }

    const chainIdHex = `0x${chainId.toString(16)}`;
    const networkConfig = getNetworkConfig(chainId);

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [networkConfig],
    });
  };

  const switchWalletConnectNetwork = async (targetChainId: number) => {
    if (!walletConnectProvider) {
      throw new Error('WalletConnect not connected');
    }

    const chainIdHex = `0x${targetChainId.toString(16)}`;

    try {
      // Try wallet_switchEthereumChain first
      await walletConnectProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      
      // Wait a moment for the network change to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update the chainId state after successful switch
      setChainId(targetChainId);
      
    } catch (switchError: any) {
      console.log('wallet_switchEthereumChain failed:', switchError);
      
      // If chain doesn't exist, try to add it
      if (switchError.code === 4902) {
        try {
          const networkConfig = getNetworkConfig(targetChainId);
          await walletConnectProvider.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
          
          // Wait for network to be added and switched
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Update the chainId state after successful add and switch
          setChainId(targetChainId);
          
        } catch (addError: any) {
          console.log('wallet_addEthereumChain failed:', addError);
          throw new Error(`Network switching not supported by your wallet. Please manually switch to Polygon Amoy (Chain ID: ${targetChainId}) in your wallet app.`);
        }
      } else {
        // Other errors - provide helpful message
        console.log('Network switch error:', switchError);
        
        if (switchError.message?.includes('User rejected') || switchError.code === 4001) {
          throw new Error('Network switch was cancelled by user.');
        } else if (switchError.message?.includes('not supported') || switchError.message?.includes('unsupported')) {
          throw new Error(`Your wallet doesn't support automatic network switching. Please manually switch to Polygon Amoy (Chain ID: ${targetChainId}) in your wallet app.`);
        } else {
          throw new Error(`Failed to switch network: ${switchError.message || 'Unknown error'}. Please manually switch to Polygon Amoy (Chain ID: ${targetChainId}) in your wallet app.`);
        }
      }
    }
  };

  const getNetworkConfig = (chainId: number) => {
    const chainIdHex = `0x${chainId.toString(16)}`;

    switch (chainId) {
      case 80002: // Polygon Amoy
        return {
          chainId: chainIdHex,
          chainName: 'Polygon Amoy Testnet',
          nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18,
          },
          rpcUrls: ['https://rpc-amoy.polygon.technology'],
          blockExplorerUrls: ['https://amoy.polygonscan.com/'],
        };
      case 137: // Polygon Mainnet
        return {
          chainId: chainIdHex,
          chainName: 'Polygon Mainnet',
          nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18,
          },
          rpcUrls: ['https://polygon-rpc.com'],
          blockExplorerUrls: ['https://polygonscan.com/'],
        };
      case 1: // Ethereum Mainnet
        return {
          chainId: chainIdHex,
          chainName: 'Ethereum Mainnet',
          nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: ['https://mainnet.infura.io/v3/'],
          blockExplorerUrls: ['https://etherscan.io/'],
        };
      default:
        throw new Error(`Unsupported network: ${chainId}`);
    }
  };

  const disconnectWallet = useCallback(async () => {
    console.log('Disconnecting wallet:', walletType);
    
    // Disconnect WalletConnect if it's connected
    if (walletConnectProvider && walletType === 'walletconnect') {
      try {
        console.log('Disconnecting WalletConnect provider...');
        await silentWalletConnect.disconnect();
        console.log('WalletConnect provider disconnected successfully');
      } catch (error) {
        console.error('Error disconnecting WalletConnect:', error);
        // Even if disconnect fails, we should clear the state
      }
    }

    // Clear all wallet state
    setAccount(null);
    setBalance(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setError(null);
    setWalletType(null);
    setWalletConnectProvider(null);
    setWcProviderInstance(null); // Clear the global instance
    setIsNetworkSwitching(false); // Reset network switching state
    
    // Store disconnect state with wallet type to prevent auto-connect
    localStorage.setItem('walletDisconnected', 'true');
    localStorage.removeItem('preferredWallet');
    
    console.log('Wallet disconnected successfully');
  }, [walletConnectProvider, walletType]);

  // Listen for account changes
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];

    // MetaMask event listeners
    if (typeof window.ethereum !== 'undefined' && walletType === 'metamask') {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('MetaMask accounts changed:', accounts);
        if (accounts.length === 0 && !isNetworkSwitching) {
          // Only disconnect if we're not in the middle of a network switch
          disconnectWallet();
        } else if (accounts[0] !== account) {
          setAccount(accounts[0]);
          if (provider && !isNetworkSwitching) {
            updateBalance(accounts[0], provider);
          }
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        console.log('MetaMask chain changed:', chainIdHex);
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        
        // Don't update balance immediately - let the network switch process handle it
        console.log('MetaMask network changed to:', newChainId);
      };

      window.ethereum.on?.('accountsChanged', handleAccountsChanged);
      window.ethereum.on?.('chainChanged', handleChainChanged);

      cleanupFunctions.push(() => {
        if (typeof window.ethereum !== 'undefined') {
          (window.ethereum as any).removeListener?.('accountsChanged', handleAccountsChanged);
          (window.ethereum as any).removeListener?.('chainChanged', handleChainChanged);
        }
      });
    }

    // WalletConnect event listeners
    if (walletConnectProvider && walletType === 'walletconnect') {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('WalletConnect accounts changed:', accounts);
        if (accounts.length === 0 && !isNetworkSwitching) {
          // Only disconnect if we're not in the middle of a network switch
          disconnectWallet();
        } else if (accounts[0] !== account) {
          setAccount(accounts[0]);
          if (provider && !isNetworkSwitching) {
            updateBalance(accounts[0], provider);
          }
        }
      };

      const handleChainChanged = (chainId: number | string) => {
        console.log('WalletConnect chain changed:', chainId);
        // Ensure chainId is always a number
        const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
        setChainId(numericChainId);
        
        // Don't update balance immediately - let the network switch process handle it
        console.log('WalletConnect network changed to:', numericChainId);
      };

      const handleDisconnect = () => {
        console.log('WalletConnect disconnected');
        disconnectWallet();
      };

      const handleSessionUpdate = (session: any) => {
        console.log('WalletConnect session updated:', session);
        // Don't disconnect on session updates, just log them
        // Session updates are normal and shouldn't cause disconnection
      };
      
      const handleSessionExpire = () => {
        console.log('WalletConnect session expired');
        // Only disconnect if not in the middle of a network switch
        if (!isNetworkSwitching) {
          disconnectWallet();
        }
      };

      walletConnectProvider.on('accountsChanged', handleAccountsChanged);
      walletConnectProvider.on('chainChanged', handleChainChanged);
      walletConnectProvider.on('disconnect', handleDisconnect);
      walletConnectProvider.on('session_update', handleSessionUpdate);
      walletConnectProvider.on('session_expire', handleSessionExpire);

      cleanupFunctions.push(() => {
        walletConnectProvider.off('accountsChanged', handleAccountsChanged);
        walletConnectProvider.off('chainChanged', handleChainChanged);
        walletConnectProvider.off('disconnect', handleDisconnect);
        walletConnectProvider.off('session_update', handleSessionUpdate);
        walletConnectProvider.off('session_expire', handleSessionExpire);
      });
    }

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [account, provider, walletType, walletConnectProvider, disconnectWallet]);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      // Only auto-connect if not explicitly disconnected and no account is connected
      if (localStorage.getItem('walletDisconnected') === 'true' || account) {
        return;
      }

      console.log('Attempting auto-connect...');
      const preferredWallet = localStorage.getItem('preferredWallet');
      
      // Try preferred wallet first, then fallback to both
      const walletsToTry = preferredWallet ? [preferredWallet, 'metamask', 'walletconnect'] : ['metamask', 'walletconnect'];
      
      for (const walletType of walletsToTry) {
        if (walletType === 'metamask' && typeof window.ethereum !== 'undefined') {
          try {
            console.log('Checking MetaMask connection...');
            
            // First check if MetaMask is unlocked and has accounts
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            
            if (accounts.length > 0) {
              console.log('MetaMask has accounts, attempting auto-connect...');
              const browserProvider = new ethers.BrowserProvider(window.ethereum);
              
              try {
                const userSigner = await browserProvider.getSigner();
                const network = await browserProvider.getNetwork();
                
                setProvider(browserProvider);
                setSigner(userSigner);
                setAccount(accounts[0]);
                setChainId(Number(network.chainId));
                setWalletType('metamask');
                
                await updateBalance(accounts[0], browserProvider);
                
                console.log('MetaMask auto-connected successfully:', {
                  account: accounts[0],
                  chainId: Number(network.chainId)
                });
                return; // Exit early if MetaMask connected
              } catch (signerError: any) {
                console.log('MetaMask signer error (likely locked):', signerError.message);
                // MetaMask is likely locked, skip auto-connect
              }
            } else {
              console.log('MetaMask has no accounts or is locked');
            }
          } catch (err) {
            console.error('Error checking MetaMask connection:', err);
          }
        }
        
        if (walletType === 'walletconnect') {
          try {
            console.log('Checking WalletConnect session...');
            const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID;
            if (projectId) {
              
              let wcProvider = wcProviderInstance;
              
              // Only initialize if not already initialized
              if (!wcProvider) {
                wcProvider = await EthereumProvider.init({
                  projectId: projectId,
                  chains: [1, 137, 56, 43114, 80002],
                  showQrModal: false,
                  metadata: {
                    name: 'STR Domains Marketplace',
                    description: 'Decentralized marketplace for STR domains',
                    url: window.location.origin,
                    icons: [`${window.location.origin}/logo192.png`]
                  },
                  optionalChains: [80002], // Make Amoy optional for better compatibility
                  // Additional configuration to prevent session errors
                  events: ['session_request', 'session_update', 'session_delete'],
                  methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
                });
                setWcProviderInstance(wcProvider);
              }

              if (wcProvider.session) {
                console.log('Auto-connecting WalletConnect...');
                const browserProvider = new ethers.BrowserProvider(wcProvider);
                const accounts = await browserProvider.listAccounts();
                
                if (accounts.length > 0) {
                  const userSigner = await browserProvider.getSigner();
                  const network = await browserProvider.getNetwork();
                  
                  setProvider(browserProvider);
                  setSigner(userSigner);
                  setAccount(accounts[0].address);
                  setChainId(Number(network.chainId));
                  setWalletType('walletconnect');
                  setWalletConnectProvider(wcProvider);
                  
                  await updateBalance(accounts[0].address, browserProvider);
                  return; // Exit early if WalletConnect connected
                }
              }
            }
          } catch (err) {
            console.error('Error checking WalletConnect connection:', err);
          }
        }
      }
      
      console.log('No previous wallet connections found');
    };

    // Add a small delay to prevent race conditions
    const timeoutId = setTimeout(checkConnection, 100);
    
    return () => clearTimeout(timeoutId);
  }, []); // No dependencies to prevent re-runs

  const value: WalletContextType = {
    account,
    balance,
    chainId,
    provider,
    signer,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    isConnecting,
    isNetworkSwitching,
    error,
    walletType,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

