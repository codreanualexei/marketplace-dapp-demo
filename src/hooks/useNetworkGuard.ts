import { useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';

export const useNetworkGuard = () => {
  const { switchNetwork, chainId } = useWallet();

  const ensureCorrectNetwork = useCallback(async (): Promise<boolean> => {
    try {
      // Check if we're on the correct network
      if (chainId !== 80002) {
        console.log(`❌ Wrong network detected: ${chainId}. Need Polygon Amoy (80002)`);
        
        // Try to automatically switch network
        try {
          await switchNetwork(80002);
          console.log("✅ Network switch initiated successfully");
          
          // Wait a moment for the switch to complete
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check if switch was successful (this will be updated by the wallet context)
          return true; // Assume success, let the transaction methods handle verification
        } catch (switchError: any) {
          console.error("❌ Automatic network switching failed:", switchError);
          throw new Error(`Failed to switch to Polygon Amoy network. Please manually switch to Polygon Amoy (Chain ID: 80002) in your wallet. Error: ${switchError.message}`);
        }
      } else {
        console.log(`✅ Network confirmed: Polygon Amoy (${chainId})`);
        return true;
      }
    } catch (error: any) {
      console.error("Network guard error:", error);
      throw error;
    }
  }, [chainId, switchNetwork]);

  return {
    ensureCorrectNetwork,
    isCorrectNetwork: chainId === 80002,
    currentChainId: chainId
  };
};
