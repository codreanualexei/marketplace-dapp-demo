import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useMarketplaceSDK } from '../hooks/useMarketplaceSDK';
import { ethers } from 'ethers';
import './Debug.css';

const Debug: React.FC = () => {
  const { account, chainId, provider, signer } = useWallet();
  const sdk = useMarketplaceSDK();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const log = (message: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const runDiagnostics = async () => {
    setTestResults([]);
    setIsRunning(true);
    
    try {
      log('🔍 Starting Diagnostics...\n');

      // 1. Check environment
      log('📋 Environment Variables:');
      log(`MARKETPLACE_ADDRESS: ${process.env.REACT_APP_MARKETPLACE_ADDRESS}`);
      log(`NFT_COLLECTION: ${process.env.REACT_APP_STR_DOMAIN_NFT_COLLECTION}`);
      log(`CHAIN_ID: ${process.env.REACT_APP_CHAIN_ID}`);
      log(`RPC_URL: ${process.env.REACT_APP_AMOY_RPC_URL}\n`);

      // 2. Check wallet
      log('👛 Wallet Status:');
      log(`Connected: ${account ? 'Yes ✅' : 'No ❌'}`);
      log(`Address: ${account || 'Not connected'}`);
      log(`Chain ID: ${chainId || 'Unknown'}`);
      log(`Expected Chain: 80002 (Polygon Amoy)`);
      log(`Match: ${chainId === 80002 ? '✅' : '❌'}\n`);

      if (!sdk) {
        log('❌ SDK not initialized - wallet might not be connected');
        return;
      }

      // 3. Test Marketplace Contract
      log('🏪 Testing Marketplace Contract...');
      const marketplaceAddr = process.env.REACT_APP_MARKETPLACE_ADDRESS;
      log(`Address: ${marketplaceAddr}`);

      // Check if contract exists at this address
      if (provider) {
        const code = await provider.getCode(marketplaceAddr || '');
        if (code === '0x') {
          log(`❌ NO CONTRACT at ${marketplaceAddr} on current network!`);
          log(`⚠️ Are you on the RIGHT network?`);
          log(`⚠️ This contract should be on Polygon Amoy (Chain ID: 80002)`);
        } else {
          log(`✅ Contract exists at ${marketplaceAddr} (${code.length} bytes)`);
        }
      }

      try {
        const lastId = await sdk['marketplaceContract'].lastListingId();
        log(`✅ lastListingId() works! Value: ${lastId.toString()}`);
        
        if (Number(lastId) > 0) {
          log(`\n📝 Testing getListing(1)...`);
          const listing = await sdk['marketplaceContract'].getListing(1);
          log(`✅ Listing 1: Seller=${listing.seller}, TokenId=${listing.tokenId}, Price=${ethers.formatEther(listing.price)} MATIC, Active=${listing.active}`);
        } else {
          log(`⚠️ lastListingId is 0 - no listings created yet`);
        }
      } catch (error: any) {
        log(`❌ Marketplace error: ${error.message}`);
        log(`⚠️ Check: Are you on Polygon Amoy network?`);
      }

      // 4. Test NFT Contract
      log('\n🎨 Testing NFT Contract...');
      const nftAddr = process.env.REACT_APP_STR_DOMAIN_NFT_COLLECTION;
      log(`Address: ${nftAddr}`);

      // Check if contract exists
      if (provider) {
        const code = await provider.getCode(nftAddr || '');
        if (code === '0x') {
          log(`❌ NO CONTRACT at ${nftAddr} on current network!`);
          log(`⚠️ Your NFT contract is NOT on the network you're connected to!`);
          return;
        } else {
          log(`✅ NFT Contract exists (${code.length} bytes)`);
        }
      }

      try {
        // Try to get token 1
        const owner1 = await sdk['nftContract'].ownerOf(1);
        log(`✅ Token 1 exists! Owner: ${owner1}`);
        
        const tokenData = await sdk.getStrDomainFromCollection(1);
        if (tokenData) {
          log(`✅ Token 1 data: Creator=${tokenData.creator}, URI=${tokenData.uri}`);
        }
      } catch (error: any) {
        if (error.message?.includes('ERC721NonexistentToken') || error.message?.includes('nonexistent')) {
          log(`⚠️ Token 1 doesn't exist - no NFTs minted yet`);
        } else if (error.message?.includes('could not decode')) {
          log(`❌ Decode error - contract might not exist on this network`);
        } else {
          log(`❌ NFT error: ${error.message}`);
        }
      }

      // 5. Test connection
      log('\n🌐 Testing Network Connection...');
      if (provider) {
        try {
          const network = await provider.getNetwork();
          log(`✅ Connected to: ${network.name}`);
          log(`Chain ID: ${network.chainId.toString()}`);
          
          const blockNumber = await provider.getBlockNumber();
          log(`✅ Latest block: ${blockNumber}`);
        } catch (error: any) {
          log(`❌ Network error: ${error.message}`);
        }
      }

      log('\n✅ Diagnostics Complete!');

    } catch (error: any) {
      log(`\n❌ Fatal error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="debug">
      <div className="debug-container">
        <div className="page-header">
          <h1>🔧 Diagnostics</h1>
          <p>Debug your marketplace connection</p>
        </div>

        <div className="debug-card">
          <button 
            className="run-button"
            onClick={runDiagnostics}
            disabled={isRunning || !account}
          >
            {isRunning ? 'Running Tests...' : 'Run Diagnostics'}
          </button>

          {!account && (
            <div className="warning">
              ⚠️ Connect your wallet first
            </div>
          )}

          {testResults.length > 0 && (
            <div className="results">
              <h3>Test Results:</h3>
              <div className="console">
                {testResults.map((result, index) => (
                  <div key={index} className="log-line">
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="info-card">
          <h3>💡 What This Tests:</h3>
          <ul>
            <li>✅ Environment variables loaded correctly</li>
            <li>✅ Wallet connected to right network</li>
            <li>✅ Contract addresses valid</li>
            <li>✅ lastListingId() function works</li>
            <li>✅ NFT contract accessible</li>
            <li>✅ Network connection active</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Debug;

