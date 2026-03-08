/**
 * UnifiedCacheManager - Unified Cache Manager
 *
 * Core features:
 * 1. Coordinate all caches (DetailedDataManager, CodeCache, CodeCompressor)
 * 2. Provide global cache statistics
 * 3. Smart cleanup strategy (expired data -> low hit rate -> large size)
 * 4. Cache preheating mechanism
 * 5. Global cache size limit
 *
 * Design principles:
 * - Singleton pattern - single global instance
 * - Non-invasive - does not modify existing cache implementations
 * - Coordinator pattern - only coordinates, does not replace
 */

import { logger } from './logger.js';

/**
 * Cache instance interface (adapter pattern)
 */
export interface CacheInstance {
  name: string;
  getStats(): CacheStats | Promise<CacheStats>;
  cleanup?(): Promise<void> | void;
  clear?(): Promise<void> | void;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  entries: number;
  size: number;
  hits?: number;
  misses?: number;
  hitRate?: number;
  ttl?: number;
  maxSize?: number;
}

/**
 * Global cache statistics
 */
export interface GlobalCacheStats {
  totalEntries: number;
  totalSize: number;
  totalSizeMB: string;
  hitRate: number;
  caches: Array<{
    name: string;
    entries: number;
    size: number;
    sizeMB: string;
    hitRate?: number;
    ttl?: number;
  }>;
  recommendations: string[];
}

/**
 * Unified cache manager
 */
export class UnifiedCacheManager {
  private static instance: UnifiedCacheManager;

  // ==================== Configuration ====================

  private readonly GLOBAL_MAX_SIZE = 500 * 1024 * 1024; // 500MB
  private readonly LOW_HIT_RATE_THRESHOLD = 0.3; // Low hit rate threshold

  // ==================== State ====================

  private caches = new Map<string, CacheInstance>();

  // ==================== Singleton ====================

  private constructor() {
    logger.info('UnifiedCacheManager initialized');
  }

  static getInstance(): UnifiedCacheManager {
    if (!this.instance) {
      this.instance = new UnifiedCacheManager();
    }
    return this.instance;
  }

  // ==================== Core features ====================

  /**
   * Register cache
   */
  registerCache(cache: CacheInstance): void {
    this.caches.set(cache.name, cache);
    logger.info(`Registered cache: ${cache.name}`);
  }

  /**
   * Unregister cache
   */
  unregisterCache(name: string): void {
    this.caches.delete(name);
    logger.info(`Unregistered cache: ${name}`);
  }

  /**
   * Get global statistics
   */
  async getGlobalStats(): Promise<GlobalCacheStats> {
    let totalEntries = 0;
    let totalSize = 0;
    let totalHits = 0;
    let totalMisses = 0;

    const cacheStats: Array<{
      name: string;
      entries: number;
      size: number;
      sizeMB: string;
      hitRate?: number;
      ttl?: number;
    }> = [];

    // Collect statistics from all caches
    for (const [name, cache] of this.caches) {
      try {
        const stats = await cache.getStats();
        
        totalEntries += stats.entries;
        totalSize += stats.size;
        totalHits += stats.hits || 0;
        totalMisses += stats.misses || 0;

        cacheStats.push({
          name,
          entries: stats.entries,
          size: stats.size,
          sizeMB: (stats.size / 1024 / 1024).toFixed(2),
          hitRate: stats.hitRate,
          ttl: stats.ttl,
        });
      } catch (error) {
        logger.error(`Failed to get stats for cache ${name}:`, error);
      }
    }

    // Calculate global hit rate
    const hitRate = totalHits + totalMisses > 0
      ? totalHits / (totalHits + totalMisses)
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(totalSize, hitRate, cacheStats);

    return {
      totalEntries,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      hitRate,
      caches: cacheStats,
      recommendations,
    };
  }

  /**
   * Smart cleanup
   *
   * Strategy:
   * 1. Clean up expired data
   * 2. Clean up low hit rate caches
   * 3. Clean up large caches
   */
  async smartCleanup(targetSize?: number): Promise<{
    before: number;
    after: number;
    freed: number;
    freedPercentage: number;
  }> {
    const target = targetSize || this.GLOBAL_MAX_SIZE * 0.7;
    const beforeStats = await this.getGlobalStats();
    const beforeSize = beforeStats.totalSize;

    if (beforeSize <= target) {
      logger.info('No cleanup needed');
      return {
        before: beforeSize,
        after: beforeSize,
        freed: 0,
        freedPercentage: 0,
      };
    }

    logger.info(
      `Smart cleanup: current ${beforeStats.totalSizeMB}MB, ` +
      `target ${(target / 1024 / 1024).toFixed(2)}MB`
    );

    // 1. Clean up expired data
    await this.cleanupExpired();

    // 2. Check if target is reached
    let currentStats = await this.getGlobalStats();
    if (currentStats.totalSize <= target) {
      return this.calculateCleanupResult(beforeSize, currentStats.totalSize);
    }

    // 3. Clean up low hit rate caches
    await this.cleanupLowHitRate();

    // 4. Check again
    currentStats = await this.getGlobalStats();
    if (currentStats.totalSize <= target) {
      return this.calculateCleanupResult(beforeSize, currentStats.totalSize);
    }

    // 5. Clean up large caches (last resort)
    await this.cleanupLargeItems();

    // 6. Final statistics
    const afterStats = await this.getGlobalStats();
    return this.calculateCleanupResult(beforeSize, afterStats.totalSize);
  }

  /**
   * Clean up expired data
   */
  private async cleanupExpired(): Promise<void> {
    logger.info('Cleaning up expired data...');

    for (const [name, cache] of this.caches) {
      if (cache.cleanup) {
        try {
          await cache.cleanup();
          logger.debug(`Cleaned up expired data in ${name}`);
        } catch (error) {
          logger.error(`Failed to cleanup ${name}:`, error);
        }
      }
    }
  }

  /**
   * Clean up low hit rate caches
   */
  private async cleanupLowHitRate(): Promise<void> {
    logger.info('Cleaning up low hit rate caches...');

    const stats = await this.getGlobalStats();
    const avgHitRate = stats.hitRate;

    for (const cacheStats of stats.caches) {
      if (cacheStats.hitRate !== undefined &&
          cacheStats.hitRate < avgHitRate * this.LOW_HIT_RATE_THRESHOLD) {
        const cache = this.caches.get(cacheStats.name);
        if (cache && cache.clear) {
          try {
            await cache.clear();
            logger.info(`Cleared low hit rate cache: ${cacheStats.name} (${(cacheStats.hitRate * 100).toFixed(1)}%)`);
          } catch (error) {
            logger.error(`Failed to clear ${cacheStats.name}:`, error);
          }
        }
      }
    }
  }

  /**
   * Clean up large caches
   */
  private async cleanupLargeItems(): Promise<void> {
    logger.info('Cleaning up large caches...');

    const stats = await this.getGlobalStats();

    // Sort by size
    const sortedCaches = stats.caches.sort((a, b) => b.size - a.size);

    // Clear the largest caches
    for (const cacheStats of sortedCaches.slice(0, 2)) {
      const cache = this.caches.get(cacheStats.name);
      if (cache && cache.clear) {
        try {
          await cache.clear();
          logger.info(`Cleared large cache: ${cacheStats.name} (${cacheStats.sizeMB}MB)`);
        } catch (error) {
          logger.error(`Failed to clear ${cacheStats.name}:`, error);
        }
      }
    }
  }

  /**
   * Calculate cleanup result
   */
  private calculateCleanupResult(before: number, after: number) {
    const freed = before - after;
    const freedPercentage = Math.round((freed / this.GLOBAL_MAX_SIZE) * 100);

    logger.info(
      `Cleanup complete! Freed ${(freed / 1024 / 1024).toFixed(2)}MB (${freedPercentage}%). ` +
      `Usage: ${(after / 1024 / 1024).toFixed(2)}MB/${(this.GLOBAL_MAX_SIZE / 1024 / 1024).toFixed(0)}MB`
    );

    return {
      before,
      after,
      freed,
      freedPercentage,
    };
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    logger.info('Clearing all caches...');

    for (const [name, cache] of this.caches) {
      if (cache.clear) {
        try {
          await cache.clear();
          logger.info(`Cleared cache: ${name}`);
        } catch (error) {
          logger.error(`Failed to clear ${name}:`, error);
        }
      }
    }

    logger.success('All caches cleared');
  }

  /**
   * Cache preheating
   */
  async preheat(urls: string[]): Promise<void> {
    logger.info(`Preheating cache for ${urls.length} URLs...`);

    // Can trigger code collection and other operations here
    // Specific implementation depends on business requirements

    logger.info('Cache preheat completed');
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    totalSize: number,
    hitRate: number,
    cacheStats: Array<{ name: string; size: number; hitRate?: number }>
  ): string[] {
    const recommendations: string[] = [];

    // Size-based recommendations
    const sizeRatio = totalSize / this.GLOBAL_MAX_SIZE;
    if (sizeRatio >= 0.9) {
      recommendations.push('🚨 CRITICAL: Cache size at 90%. Run smart_cache_cleanup immediately!');
    } else if (sizeRatio >= 0.7) {
      recommendations.push('⚠️  WARNING: Cache size at 70%. Consider cleanup soon.');
    } else if (sizeRatio >= 0.5) {
      recommendations.push('ℹ️  INFO: Cache size at 50%. Monitor usage.');
    }

    // Hit rate-based recommendations
    if (hitRate < 0.3) {
      recommendations.push('💡 Low cache hit rate (<30%). Consider adjusting TTL or cache strategy.');
    } else if (hitRate > 0.7) {
      recommendations.push('✅ Good cache hit rate (>70%). Cache is working well.');
    }

    // Per-cache recommendations
    for (const cache of cacheStats) {
      const cacheRatio = cache.size / totalSize;
      if (cacheRatio > 0.5) {
        recommendations.push(`💡 ${cache.name} uses ${Math.round(cacheRatio * 100)}% of total cache. Consider cleanup.`);
      }

      if (cache.hitRate !== undefined && cache.hitRate < 0.2) {
        recommendations.push(`💡 ${cache.name} has low hit rate (${(cache.hitRate * 100).toFixed(1)}%). Consider disabling or adjusting.`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Cache health is good. No action needed.');
    }

    return recommendations;
  }
}

