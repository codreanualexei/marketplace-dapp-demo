// Silent WalletConnect wrapper that handles all errors internally
import { EthereumProvider } from '@walletconnect/ethereum-provider';

export class SilentWalletConnectProvider {
  private provider: InstanceType<typeof EthereumProvider> | null = null;
  private isConnecting = false;
  private retryCount = 0;
  private maxRetries = 3;

  async init(config: any): Promise<InstanceType<typeof EthereumProvider>> {
    // If already connecting, return existing provider
    if (this.isConnecting && this.provider) {
      return this.provider;
    }

    this.isConnecting = true;

    try {
      // Clean up existing provider if any
      if (this.provider) {
        try {
          await this.provider.disconnect();
        } catch (error) {
          console.log('Silent cleanup error (ignored):', error);
        }
        this.provider = null;
      }

      // Add delay for retries
      if (this.retryCount > 0) {
        const delay = 1000 + (this.retryCount * 500);
        console.log(`Silent retry delay: ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Initialize provider with error suppression
      this.provider = await EthereumProvider.init({
        ...config,
        // Add additional configuration to prevent errors
        disableProviderPing: true,
        optionalChains: [80002],
        events: ['session_request', 'session_update', 'session_delete'],
        methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
      });

      // Override provider methods to suppress errors
      this.overrideProviderMethods();

      this.isConnecting = false;
      this.retryCount = 0;
      return this.provider;

    } catch (error: any) {
      this.isConnecting = false;
      
      // Handle connection reset errors silently
      if (this.isConnectionResetError(error) && this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Silent retry ${this.retryCount}/${this.maxRetries} for connection reset`);
        return this.init(config);
      }

      // For other errors, throw them
      throw error;
    }
  }

  private isConnectionResetError(error: any): boolean {
    const message = error?.message || error?.toString() || '';
    return message.includes('Connection request reset') ||
           message.includes('Please try again') ||
           message.includes('connection was reset') ||
           message.includes('request was reset') ||
           message.includes('No matching key. session topic doesn\'t exist');
  }

  private overrideProviderMethods(): void {
    if (!this.provider) return;

    // Override request method to handle errors
    const originalRequest = this.provider.request;
    this.provider.request = async <T = unknown>(args: any, expiry?: number): Promise<T> => {
      try {
        return await originalRequest.call(this.provider, args, expiry) as T;
      } catch (error: any) {
        if (this.isConnectionResetError(error)) {
          console.log('Silent suppression of WalletConnect request error:', error.message);
          // Return a mock response or throw a different error
          throw new Error('Connection temporarily unavailable');
        }
        throw error;
      }
    };
  }

  async disconnect(): Promise<void> {
    if (this.provider) {
      try {
        await this.provider.disconnect();
      } catch (error) {
        console.log('Silent disconnect error (ignored):', error);
      }
      this.provider = null;
    }
    this.isConnecting = false;
    this.retryCount = 0;
  }

  getProvider(): InstanceType<typeof EthereumProvider> | null {
    return this.provider;
  }
}

// Singleton instance
export const silentWalletConnect = new SilentWalletConnectProvider();
