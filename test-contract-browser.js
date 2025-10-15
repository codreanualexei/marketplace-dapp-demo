// Paste this in browser console when on your dApp
// This will test if the contract has the required functions

async function testMarketplaceContract() {
  console.log('🔍 Testing Marketplace Contract...\n');
  
  const marketplaceAddress = '0x75201083D96114982B1b08176C87E2ec3e39dDb1';
  const provider = new ethers.BrowserProvider(window.ethereum);
  
  // Test 1: Check if lastListingId exists
  console.log('Test 1: Checking lastListingId()...');
  const contractMinimal = new ethers.Contract(
    marketplaceAddress,
    ['function lastListingId() view returns (uint256)'],
    provider
  );
  
  try {
    const lastId = await contractMinimal.lastListingId();
    console.log('✅ lastListingId() works! Value:', lastId.toString());
  } catch (error) {
    console.error('❌ lastListingId() failed:', error.message);
    console.log('\n📋 Your contract might not have this function.');
    console.log('Check on Polygonscan what functions it has.');
  }
  
  // Test 2: Try getting listing 1
  console.log('\nTest 2: Checking getListing(1)...');
  const contractListing = new ethers.Contract(
    marketplaceAddress,
    ['function getListing(uint256) view returns (tuple(address seller, address nft, uint256 tokenId, uint256 price, bool active))'],
    provider
  );
  
  try {
    const listing = await contractListing.getListing(1);
    console.log('✅ getListing() works! Listing 1:', listing);
  } catch (error) {
    console.error('❌ getListing(1) failed:', error.message);
  }
}

// Run the test
testMarketplaceContract();
