/**
 * Cache Adapters - Adapt existing caches to UnifiedCacheManager
 *
 * Adapter pattern:
 * - Does not modify existing cache implementations
 * - Provides a unified interface
 * - Supports async and sync methods
 */

import type { CacheInstance, CacheStats } from './UnifiedCacheManager.js';
import type { DetailedDataManager } from './detailedDataManager.js';
import type { CodeCache } from '../modules/collector/CodeCache.js';
import type { CodeCompressor } from '../modules/collector/CodeCompressor.js';

/**
 * DetailedDataManager adapter
 */
export class DetailedDataManagerAdapter implements CacheInstance {
  name = 'DetailedDataManager';

  constructor(private manager: DetailedDataManager) {}

  getStats(): CacheStats {
    const stats = this.manager.getStats();
    return {
      entries: stats.cacheSize,
      size: this.estimateSize(stats.cacheSize),
      hits: 0, // DetailedDataManager does not track hit rate
      misses: 0,
      ttl: stats.defaultTTLSeconds * 1000, // Use defaultTTLSeconds
      maxSize: stats.maxCacheSize,
    };
  }

  clear(): void {
    this.manager.clear();
  }

  /**
   * Estimate cache size
   *
   * Note: This is a rough estimate; actual size may vary significantly
   * - Assumes each entry averages 50KB
   * - Actual size depends on data type and content
   */
  private estimateSize(entries: number): number {
    return entries * 50 * 1024; // 50KB per entry (estimated)
  }
}

/**
 * CodeCache adapter
 */
export class CodeCacheAdapter implements CacheInstance {
  name = 'CodeCache';

  constructor(private cache: CodeCache) {}

  async getStats(): Promise<CacheStats> {
    const stats = await this.cache.getStats();
    return {
      entries: stats.memoryEntries + stats.diskEntries,
      size: stats.totalSize,
      hits: 0, // CodeCache does not track hit rate
      misses: 0,
    };
  }

  async cleanup(): Promise<void> {
    await this.cache.cleanup();
  }

  async clear(): Promise<void> {
    await this.cache.clear();
  }
}

/**
 * CodeCompressor adapter
 */
export class CodeCompressorAdapter implements CacheInstance {
  name = 'CodeCompressor';

  constructor(private compressor: CodeCompressor) {}

  getStats(): CacheStats {
    const stats = this.compressor.getStats();
    const cacheSize = this.compressor.getCacheSize();

    // Calculate hit rate
    const total = stats.cacheHits + stats.cacheMisses;
    const hitRate = total > 0 ? stats.cacheHits / total : 0;

    return {
      entries: cacheSize,
      size: this.estimateSize(cacheSize, stats.totalCompressedSize),
      hits: stats.cacheHits,
      misses: stats.cacheMisses,
      hitRate,
    };
  }

  clear(): void {
    this.compressor.clearCache();
  }

  /**
   * Estimate cache size
   *
   * Note: Uses cumulative compressed size to calculate average
   * - totalCompressed is a historical cumulative value, not the current cache size
   * - Actual cache size may be smaller than the estimate
   */
  private estimateSize(entries: number, totalCompressed: number): number {
    if (entries === 0) return 0;
    const avgSize = totalCompressed / Math.max(1, entries);
    return entries * avgSize; // Estimate based on average
  }
}

/**
 * Factory function to create all adapters
 */
export function createCacheAdapters(
  detailedDataManager: DetailedDataManager,
  codeCache: CodeCache,
  codeCompressor: CodeCompressor
): CacheInstance[] {
  return [
    new DetailedDataManagerAdapter(detailedDataManager),
    new CodeCacheAdapter(codeCache),
    new CodeCompressorAdapter(codeCompressor),
  ];
}

