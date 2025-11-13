import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { ethers } from "ethers";
import { EthereumProvider } from "@walletconnect/ethereum-provider";

export type WalletType = "metamask" | "walletconnect";

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
  setError: (error: string | null) => void;
  walletType: WalletType | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
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
  // Store WalletConnect provider globally to prevent multiple initializations
  const [wcProviderInstance, setWcProviderInstance] = useState<any>(null);

  // Comprehensive WalletConnect cleanup function
  const cleanupWalletConnect = useCallback(async () => {
    try {
      // Disconnect existing provider if it exists
      if (wcProviderInstance) {
        try {
          await wcProviderInstance.disconnect();
        } catch (disconnectError) {
          // Ignore disconnect errors as they're usually harmless
        }
      }

      // Clear all WalletConnect related state
      setWcProviderInstance(null);
      setWalletConnectProvider(null);

      // Clear WalletConnect from localStorage and sessionStorage
      const clearStorage = (storage: Storage) => {
        const keysToRemove = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (
            key &&
            (key.startsWith("walletconnect") || key.startsWith("wc@"))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => storage.removeItem(key));
      };

      clearStorage(localStorage);
      clearStorage(sessionStorage);

      // Add a delay to ensure cleanup completes before next connection
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("Error during WalletConnect cleanup:", error);
      // Even if cleanup fails, we should clear the state
      setWcProviderInstance(null);
      setWalletConnectProvider(null);
    }
  }, [wcProviderInstance]);

  const updateBalance = useCallback(async (
    address: string,
    provider: ethers.BrowserProvider,
  ) => {
    // Skip balance update if we're in the middle of a network switch
    if (isNetworkSwitching) {
      console.log("Skipping balance update during network switch");
      return;
    }

    try {
      const balanceWei = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balanceWei);
      setBalance(parseFloat(balanceEth).toFixed(4));
    } catch (err: any) {
      console.error("Error fetching balance:", err);
      // Check if it's a network change error and handle gracefully
      if (err.message?.includes("network changed")) {
        console.log(
          "Network change detected during balance update, skipping...",
        );
        return;
      }
      // Don't set balance to null on error, keep previous value
    }
  }, [isNetworkSwitching]);

  const connectWallet = async (walletType: WalletType = "metamask") => {
    setIsConnecting(true);
    setError(null);

    try {
      // Always clean up WalletConnect before connecting any wallet
      await cleanupWalletConnect();

      if (walletType === "metamask") {
        await connectMetaMask();
      } else if (walletType === "walletconnect") {
        // For WalletConnect, force a page reload to ensure completely clean state
        // This is necessary because WalletConnect Core maintains global state that can't be easily reset
        console.log(
          "Connecting to WalletConnect - forcing page reload for clean state",
        );
        localStorage.setItem("pendingWalletConnect", "true");
        window.location.reload();
        return;
      }
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setError(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const connectMetaMask = async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      console.log("Wallet connection already in progress, skipping...");
      return;
    }

    try {
      setIsConnecting(true);

      if (typeof window.ethereum === "undefined") {
        throw new Error("Please install MetaMask to use this dApp");
      }

      // Check if MetaMask is locked
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length === 0) {
          // MetaMask is locked or no accounts connected
          console.log(
            "MetaMask is locked or no accounts connected, requesting access...",
          );
        }
      } catch (error) {
        console.log("MetaMask is locked, requesting access...");
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);

      const accounts = await browserProvider.send("eth_requestAccounts", []);

      if (accounts.length === 0) {
        throw new Error(
          "No accounts found. Please unlock MetaMask and try again.",
        );
      }

      const userSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();

      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setWalletType("metamask");

      await updateBalance(accounts[0], browserProvider);

      // Store preferred wallet type
      localStorage.setItem("preferredWallet", "metamask");
      localStorage.removeItem("walletDisconnected");

      console.log("MetaMask connected successfully:", {
        account: accounts[0],
        chainId: Number(network.chainId),
      });
    } catch (error: any) {
      console.error("MetaMask connection error:", error);
      if (error.code === 4001) {
        throw new Error("MetaMask connection was rejected by user");
      } else if (error.message?.includes("User rejected")) {
        throw new Error("MetaMask connection was rejected by user");
      } else if (error.message?.includes("locked")) {
        throw new Error(
          "MetaMask is locked. Please unlock MetaMask and try again.",
        );
      } else {
        throw new Error(
          `MetaMask connection failed: ${error.message || "Unknown error"}`,
        );
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWalletConnect = async (): Promise<void> => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      throw new Error(
        "Connection already in progress. Please wait for the current connection to complete.",
      );
    }

    try {
      setIsConnecting(true);

      // Create WalletConnect provider
      const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID;
      if (!projectId) {
        throw new Error(
          "WalletConnect Project ID not configured. Please set REACT_APP_WALLETCONNECT_PROJECT_ID in your environment variables.",
        );
      }

      // Create WalletConnect provider configuration
      const wcConfig = {
        projectId: projectId,
        chains: [1, 137, 56, 43114, 80002], // Ethereum, Polygon, BSC, Avalanche, Polygon Amoy
        showQrModal: true,
        metadata: {
          name: "STR Domains Marketplace",
          description: "Decentralized marketplace for STR domains",
          url: window.location.origin,
          icons: [`${window.location.origin}/logo192.png`],
        },
        relayUrl: "wss://relay.walletconnect.com",
        qrModalOptions: {
          themeMode: "light" as const,
          themeVariables: {
            "--wcm-z-index": "1000",
          },
        },
        disableProviderPing: true,
        optionalChains: [80002] as [number, ...number[]],
        events: ["session_request", "session_update", "session_delete"],
        methods: [
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_sign",
          "personal_sign",
          "eth_signTypedData",
        ],
      };

      let wcProvider;
      try {
        wcProvider = await EthereumProvider.init(wcConfig);
        setWcProviderInstance(wcProvider);
      } catch (initError: any) {
        // If we get "already initialized" error, this is expected and we should continue
        if (initError.message?.includes("already initialized")) {
          // The global Core is already initialized, we can continue
          wcProvider = await EthereumProvider.init(wcConfig);
          setWcProviderInstance(wcProvider);
        } else {
          throw initError;
        }
      }

      // Enable session (triggers QR Code modal)
      try {
        await wcProvider.enable();
      } catch (enableError: any) {
        setWcProviderInstance(null);
        throw enableError;
      }

      // Create ethers provider from WalletConnect provider
      const browserProvider = new ethers.BrowserProvider(wcProvider);
      const accounts = await browserProvider.listAccounts();

      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const userSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();

      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(accounts[0].address);
      setChainId(Number(network.chainId));
      setWalletType("walletconnect");
      setWalletConnectProvider(wcProvider);

      await updateBalance(accounts[0].address, browserProvider);

      // Store preferred wallet type
      localStorage.setItem("preferredWallet", "walletconnect");
      localStorage.removeItem("walletDisconnected");
    } catch (error: any) {
      console.error("WalletConnect connection error:", error);
      if (error.message?.includes("User rejected")) {
        throw new Error("Connection cancelled by user");
      } else if (
        error.message?.includes("Connection request reset") ||
        error.message?.includes("Please try again") ||
        error.message?.includes("connection was reset") ||
        error.message?.includes("request was reset")
      ) {
        throw new Error(
          "Connection request was reset. Please try connecting again.",
        );
      } else if (
        error.message?.includes("No matching key. session topic doesn't exist")
      ) {
        throw new Error(
          "WalletConnect session expired. Please try connecting again.",
        );
      } else if (error.message?.includes("already initialized")) {
        throw new Error(
          "WalletConnect is already initializing. Please wait and try again.",
        );
      }
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const switchNetwork = async (targetChainId: number) => {
    if (!walletType) {
      throw new Error("No wallet connected");
    }

    // Set network switching flag to prevent balance updates during transition
    setIsNetworkSwitching(true);

    try {
      if (walletType === "metamask") {
        await switchMetaMaskNetwork(targetChainId);
      } else if (walletType === "walletconnect") {
        await switchWalletConnectNetwork(targetChainId);
      } else {
        throw new Error(`Unsupported wallet type: ${walletType}`);
      }
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
    if (typeof window.ethereum === "undefined") {
      throw new Error("MetaMask not detected");
    }

    const chainIdHex = `0x${targetChainId.toString(16)}`;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
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
    if (typeof window.ethereum === "undefined") {
      throw new Error("MetaMask not detected");
    }

    const networkConfig = getNetworkConfig(chainId);

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [networkConfig],
    });
  };

  const switchWalletConnectNetwork = async (targetChainId: number) => {
    if (!walletConnectProvider) {
      throw new Error("WalletConnect not connected");
    }

    const chainIdHex = `0x${targetChainId.toString(16)}`;

    try {
      // Try wallet_switchEthereumChain first
      await walletConnectProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });

      // Wait a moment for the network change to propagate
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create a new provider and signer with the updated network
      // Retry a few times in case the network change is still propagating
      let newProvider: ethers.BrowserProvider | null = null;
      let newSigner: ethers.JsonRpcSigner | null = null;
      let network: ethers.Network | null = null;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          newProvider = new ethers.BrowserProvider(walletConnectProvider);
          newSigner = await newProvider.getSigner();
          network = await newProvider.getNetwork();

          // Verify we're on the correct network
          if (Number(network.chainId) === targetChainId) {
            break;
          }
          
          retries++;
          if (retries < maxRetries) {
            console.log(`Network not yet switched, retrying... (${retries}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          retries++;
          if (retries < maxRetries) {
            console.log(`Error getting network info, retrying... (${retries}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            throw error;
          }
        }
      }

      if (!network || Number(network.chainId) !== targetChainId) {
        throw new Error(`Network switch failed. Expected ${targetChainId}, got ${network?.chainId || 'unknown'}`);
      }

      if (!newProvider || !newSigner) {
        throw new Error("Failed to create new provider and signer after network switch");
      }

      // Update all the state with the new provider/signer
      setProvider(newProvider);
      setSigner(newSigner);
      setChainId(targetChainId);

      console.log("WalletConnect network switched successfully to:", targetChainId);
    } catch (switchError: any) {
      console.log("wallet_switchEthereumChain failed:", switchError);

      // If chain doesn't exist, try to add it
      if (switchError.code === 4902) {
        try {
          const networkConfig = getNetworkConfig(targetChainId);
          await walletConnectProvider.request({
            method: "wallet_addEthereumChain",
            params: [networkConfig],
          });

          // Wait for network to be added and switched
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Create a new provider and signer with the updated network
          // Retry a few times in case the network change is still propagating
          let newProvider: ethers.BrowserProvider | null = null;
          let newSigner: ethers.JsonRpcSigner | null = null;
          let network: ethers.Network | null = null;
          let retries = 0;
          const maxRetries = 3;

          while (retries < maxRetries) {
            try {
              newProvider = new ethers.BrowserProvider(walletConnectProvider);
              newSigner = await newProvider.getSigner();
              network = await newProvider.getNetwork();

              // Verify we're on the correct network
              if (Number(network.chainId) === targetChainId) {
                break;
              }
              
              retries++;
              if (retries < maxRetries) {
                console.log(`Network not yet switched after add, retrying... (${retries}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            } catch (error) {
              retries++;
              if (retries < maxRetries) {
                console.log(`Error getting network info after add, retrying... (${retries}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
              } else {
                throw error;
              }
            }
          }

          if (!network || Number(network.chainId) !== targetChainId) {
            throw new Error(`Network switch failed. Expected ${targetChainId}, got ${network?.chainId || 'unknown'}`);
          }

          if (!newProvider || !newSigner) {
            throw new Error("Failed to create new provider and signer after network switch");
          }

          // Update all the state with the new provider/signer
          setProvider(newProvider);
          setSigner(newSigner);
          setChainId(targetChainId);

          console.log("WalletConnect network added and switched successfully to:", targetChainId);
        } catch (addError: any) {
          console.log("wallet_addEthereumChain failed:", addError);
          throw new Error(
            `Network switching not supported by your wallet. Please manually switch to Polygon Amoy (Chain ID: ${targetChainId}) in your wallet app.`,
          );
        }
      } else {
        // Other errors - provide helpful message
        console.log("Network switch error:", switchError);

        if (
          switchError.message?.includes("User rejected") ||
          switchError.code === 4001
        ) {
          throw new Error("Network switch was cancelled by user.");
        } else if (
          switchError.message?.includes("not supported") ||
          switchError.message?.includes("unsupported")
        ) {
          throw new Error(
            `Your wallet doesn't support automatic network switching. Please manually switch to Polygon Amoy (Chain ID: ${targetChainId}) in your wallet app.`,
          );
        } else {
          throw new Error(
            `Failed to switch network: ${switchError.message || "Unknown error"}. Please manually switch to Polygon Amoy (Chain ID: ${targetChainId}) in your wallet app.`,
          );
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
          chainName: "Polygon Amoy Testnet",
          nativeCurrency: {
            name: "MATIC",
            symbol: "MATIC",
            decimals: 18,
          },
          rpcUrls: ["https://rpc-amoy.polygon.technology"],
          blockExplorerUrls: ["https://amoy.polygonscan.com/"],
        };
      case 137: // Polygon Mainnet
        return {
          chainId: chainIdHex,
          chainName: "Polygon Mainnet",
          nativeCurrency: {
            name: "MATIC",
            symbol: "MATIC",
            decimals: 18,
          },
          rpcUrls: ["https://polygon-rpc.com"],
          blockExplorerUrls: ["https://polygonscan.com/"],
        };
      case 1: // Ethereum Mainnet
        return {
          chainId: chainIdHex,
          chainName: "Ethereum Mainnet",
          nativeCurrency: {
            name: "Ethereum",
            symbol: "ETH",
            decimals: 18,
          },
          rpcUrls: ["https://mainnet.infura.io/v3/"],
          blockExplorerUrls: ["https://etherscan.io/"],
        };
      default:
        throw new Error(`Unsupported network: ${chainId}`);
    }
  };

  const disconnectWallet = useCallback(async () => {
    console.log("Disconnecting wallet:", walletType);

    // Use comprehensive cleanup for WalletConnect
    await cleanupWalletConnect();

    // Clear all wallet state
    setAccount(null);
    setBalance(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setError(null);
    setWalletType(null);
    setWalletConnectProvider(null);
    setIsNetworkSwitching(false); // Reset network switching state

    // Store disconnect state with wallet type to prevent auto-connect
    localStorage.setItem("walletDisconnected", "true");
    localStorage.removeItem("preferredWallet");

    console.log("Wallet disconnected successfully");
  }, [walletType, cleanupWalletConnect]);

  // Listen for account changes
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];

    // MetaMask event listeners
    if (typeof window.ethereum !== "undefined" && walletType === "metamask") {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log("MetaMask accounts changed:", accounts);
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
        console.log("MetaMask chain changed:", chainIdHex);
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);

        // Don't update balance immediately - let the network switch process handle it
        console.log("MetaMask network changed to:", newChainId);
      };

      window.ethereum.on?.("accountsChanged", handleAccountsChanged);
      window.ethereum.on?.("chainChanged", handleChainChanged);

      cleanupFunctions.push(() => {
        if (typeof window.ethereum !== "undefined") {
          (window.ethereum as any).removeListener?.(
            "accountsChanged",
            handleAccountsChanged,
          );
          (window.ethereum as any).removeListener?.(
            "chainChanged",
            handleChainChanged,
          );
        }
      });
    }

    // WalletConnect event listeners
    if (walletConnectProvider && walletType === "walletconnect") {
      const handleAccountsChanged = (accounts: string[]) => {
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

      const handleChainChanged = async (chainId: number | string) => {
        // Ensure chainId is always a number
        const numericChainId =
          typeof chainId === "string" ? parseInt(chainId, 16) : chainId;
        
        console.log("WalletConnect chain changed to:", numericChainId);
        
        // Update chainId immediately
        setChainId(numericChainId);
        
        // Create new provider and signer with the updated network
        try {
          const newProvider = new ethers.BrowserProvider(walletConnectProvider);
          const newSigner = await newProvider.getSigner();
          
          setProvider(newProvider);
          setSigner(newSigner);
          
          console.log("WalletConnect provider updated for new network:", numericChainId);
        } catch (error) {
          console.error("Error updating WalletConnect provider after network change:", error);
        }
      };

      const handleDisconnect = () => {
        disconnectWallet();
      };

      const handleSessionUpdate = (session: any) => {
        // Don't disconnect on session updates, just log them
        // Session updates are normal and shouldn't cause disconnection
      };

      const handleSessionExpire = () => {
        // Only disconnect if not in the middle of a network switch
        if (!isNetworkSwitching) {
          disconnectWallet();
        }
      };

      walletConnectProvider.on("accountsChanged", handleAccountsChanged);
      walletConnectProvider.on("chainChanged", handleChainChanged);
      walletConnectProvider.on("disconnect", handleDisconnect);
      walletConnectProvider.on("session_update", handleSessionUpdate);
      walletConnectProvider.on("session_expire", handleSessionExpire);

      cleanupFunctions.push(() => {
        walletConnectProvider.off("accountsChanged", handleAccountsChanged);
        walletConnectProvider.off("chainChanged", handleChainChanged);
        walletConnectProvider.off("disconnect", handleDisconnect);
        walletConnectProvider.off("session_update", handleSessionUpdate);
        walletConnectProvider.off("session_expire", handleSessionExpire);
      });
    }

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [account, provider, walletType, walletConnectProvider, disconnectWallet, isNetworkSwitching, updateBalance]);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      // Check if there's a pending WalletConnect connection after page reload
      const pendingWalletConnect = localStorage.getItem("pendingWalletConnect");
      if (pendingWalletConnect === "true") {
        localStorage.removeItem("pendingWalletConnect");
        try {
          await connectWalletConnect();
          return;
        } catch (error) {
          setError("Failed to connect to WalletConnect. Please try again.");
        }
      }

      // Only auto-connect if not explicitly disconnected and no account is connected
      if (localStorage.getItem("walletDisconnected") === "true" || account) {
        return;
      }

      const preferredWallet = localStorage.getItem("preferredWallet");

      // Try preferred wallet first, then fallback to both
      const walletsToTry = preferredWallet
        ? [preferredWallet, "metamask", "walletconnect"]
        : ["metamask", "walletconnect"];

      for (const walletType of walletsToTry) {
        if (
          walletType === "metamask" &&
          typeof window.ethereum !== "undefined"
        ) {
          try {
            // First check if MetaMask is unlocked and has accounts
            const accounts = await window.ethereum.request({
              method: "eth_accounts",
            });

            if (accounts.length > 0) {
              const browserProvider = new ethers.BrowserProvider(
                window.ethereum,
              );

              try {
                const userSigner = await browserProvider.getSigner();
                const network = await browserProvider.getNetwork();

                setProvider(browserProvider);
                setSigner(userSigner);
                setAccount(accounts[0]);
                setChainId(Number(network.chainId));
                setWalletType("metamask");

                await updateBalance(accounts[0], browserProvider);
                return; // Exit early if MetaMask connected
              } catch (signerError: any) {
                // MetaMask is likely locked, skip auto-connect
              }
            }
          } catch (err) {
            console.error("Error checking MetaMask connection:", err);
          }
        }

        if (walletType === "walletconnect") {
          try {
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
                    name: "STR Domains Marketplace",
                    description: "Decentralized marketplace for STR domains",
                    url: window.location.origin,
                    icons: [`${window.location.origin}/logo192.png`],
                  },
                  optionalChains: [80002] as [number, ...number[]], // Make Amoy optional for better compatibility
                  // Additional configuration to prevent session errors
                  events: [
                    "session_request",
                    "session_update",
                    "session_delete",
                  ],
                  methods: [
                    "eth_sendTransaction",
                    "eth_signTransaction",
                    "eth_sign",
                    "personal_sign",
                    "eth_signTypedData",
                  ],
                });
                setWcProviderInstance(wcProvider);
              }

              if (wcProvider.session) {
                const browserProvider = new ethers.BrowserProvider(wcProvider);
                const accounts = await browserProvider.listAccounts();

                if (accounts.length > 0) {
                  const userSigner = await browserProvider.getSigner();
                  const network = await browserProvider.getNetwork();

                  setProvider(browserProvider);
                  setSigner(userSigner);
                  setAccount(accounts[0].address);
                  setChainId(Number(network.chainId));
                  setWalletType("walletconnect");
                  setWalletConnectProvider(wcProvider);

                  await updateBalance(accounts[0].address, browserProvider);
                  return; // Exit early if WalletConnect connected
                }
              }
            }
          } catch (err) {
            console.error("Error checking WalletConnect connection:", err);
          }
        }
      }

      console.log("No previous wallet connections found");
    };

    // Add a small delay to prevent race conditions
    const timeoutId = setTimeout(checkConnection, 100);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setError,
    walletType,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};
