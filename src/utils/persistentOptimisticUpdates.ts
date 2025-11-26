/**
 * Persistent Optimistic Updates Utility
 * 
 * Stores optimistic updates in localStorage so they survive page refreshes.
 * On page load, checks pending updates and re-applies them if transactions are confirmed.
 */

export type OptimisticUpdateType = 
  | 'purchase' 
  | 'list' 
  | 'update' 
  | 'cancel' 
  | 'approve' 
  | 'withdraw' 
  | 'withdrawFees'
  | 'mint';

export interface PendingOptimisticUpdate {
  type: OptimisticUpdateType;
  txHash: string;
  timestamp: number;
  data: {
    listingId?: number;
    tokenId?: number;
    price?: string;
    newPrice?: string;
    splitterAddress?: string;
    amount?: string;
    [key: string]: any;
  };
}

const STORAGE_KEY = 'pendingOptimisticUpdates';
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes - cleanup old updates

/**
 * Store a pending optimistic update
 */
export function storePendingUpdate(update: Omit<PendingOptimisticUpdate, 'timestamp'>): void {
  try {
    const pending = getPendingUpdates();
    const newUpdate: PendingOptimisticUpdate = {
      ...update,
      timestamp: Date.now(),
    };
    
    // Add to pending list
    pending.push(newUpdate);
    
    // Clean up old updates (older than 5 minutes)
    const beforeCount = pending.length;
    const filtered = pending.filter(
      u => Date.now() - u.timestamp < MAX_AGE_MS
    );
    const cleanedCount = beforeCount - filtered.length;
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old pending update(s) (older than 5 minutes)`);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    console.log('💾 [PERSISTENT UPDATE] Stored pending optimistic update:', {
      type: newUpdate.type,
      txHash: newUpdate.txHash,
      data: newUpdate.data,
      timestamp: new Date(newUpdate.timestamp).toISOString(),
      totalPending: filtered.length
    });
  } catch (error) {
    console.error('❌ [PERSISTENT UPDATE] Error storing pending update:', error);
  }
}

/**
 * Get all pending optimistic updates
 */
export function getPendingUpdates(): PendingOptimisticUpdate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('📭 [PERSISTENT UPDATE] No pending updates found in storage');
      return [];
    }
    
    const updates: PendingOptimisticUpdate[] = JSON.parse(stored);
    console.log(`📋 [PERSISTENT UPDATE] Found ${updates.length} pending update(s) in storage`);
    
    // Filter out old updates
    const beforeCount = updates.length;
    const valid = updates.filter(
      u => Date.now() - u.timestamp < MAX_AGE_MS
    );
    const removedCount = beforeCount - valid.length;
    
    // Update storage if we filtered anything
    if (valid.length !== updates.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      console.log(`🧹 [PERSISTENT UPDATE] Removed ${removedCount} expired update(s), ${valid.length} remaining`);
    }
    
    if (valid.length > 0) {
      console.log('📋 [PERSISTENT UPDATE] Valid pending updates:', valid.map(u => ({
        type: u.type,
        txHash: u.txHash,
        age: `${Math.round((Date.now() - u.timestamp) / 1000)}s ago`
      })));
    }
    
    return valid;
  } catch (error) {
    console.error('❌ [PERSISTENT UPDATE] Error getting pending updates:', error);
    return [];
  }
}

/**
 * Remove a pending update (after successful subgraph sync)
 */
export function removePendingUpdate(txHash: string): void {
  try {
    const pending = getPendingUpdates();
    const updateToRemove = pending.find(u => u.txHash === txHash);
    
    if (!updateToRemove) {
      console.log(`⚠️ [PERSISTENT UPDATE] Update not found for removal: ${txHash}`);
      return;
    }
    
    const filtered = pending.filter(u => u.txHash !== txHash);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    
    const age = Math.round((Date.now() - updateToRemove.timestamp) / 1000);
    console.log('🗑️ [PERSISTENT UPDATE] Removed pending optimistic update:', {
      type: updateToRemove.type,
      txHash: updateToRemove.txHash,
      age: `${age}s old`,
      reason: 'Subgraph sync completed',
      remainingPending: filtered.length
    });
  } catch (error) {
    console.error('❌ [PERSISTENT UPDATE] Error removing pending update:', error);
  }
}

/**
 * Remove all pending updates (cleanup)
 */
export function clearPendingUpdates(): void {
  try {
    const pending = getPendingUpdates();
    const count = pending.length;
    localStorage.removeItem(STORAGE_KEY);
    console.log(`🧹 [PERSISTENT UPDATE] Cleared all ${count} pending optimistic update(s)`);
  } catch (error) {
    console.error('❌ [PERSISTENT UPDATE] Error clearing pending updates:', error);
  }
}

/**
 * Check if a transaction is confirmed by checking its receipt
 */
export async function isTransactionConfirmed(
  txHash: string,
  provider: any
): Promise<boolean> {
  try {
    console.log(`🔍 [PERSISTENT UPDATE] Checking transaction confirmation: ${txHash}`);
    const receipt = await provider.getTransactionReceipt(txHash);
    const isConfirmed = receipt !== null && receipt.status === 1;
    
    if (isConfirmed) {
      console.log(`✅ [PERSISTENT UPDATE] Transaction confirmed: ${txHash}`, {
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed'
      });
    } else {
      console.log(`⏳ [PERSISTENT UPDATE] Transaction not confirmed yet: ${txHash}`);
    }
    
    return isConfirmed;
  } catch (error) {
    console.error(`❌ [PERSISTENT UPDATE] Error checking transaction confirmation for ${txHash}:`, error);
    return false;
  }
}

/**
 * Get pending updates for a specific type
 */
export function getPendingUpdatesByType(
  type: OptimisticUpdateType
): PendingOptimisticUpdate[] {
  return getPendingUpdates().filter(u => u.type === type);
}

