/**
 * Detailed Data Manager - Solves context overflow issues
 *
 * Core idea:
 * 1. Large data is not returned directly, but cached on the server
 * 2. Returns a summary + access token (detailId)
 * 3. AI can use the token to retrieve full data on demand
 */

import { logger } from './logger.js';
import { safeStringify } from './safeJson.js';

export interface DataSummary {
  type: string;
  size: number;
  sizeKB: string;
  preview: string;
  structure?: {
    keys?: string[];
    methods?: string[];
    properties?: string[];
    length?: number;
  };
}

export interface DetailedDataResponse {
  summary: DataSummary;
  detailId: string;
  hint: string;
  expiresAt: number;
}

interface CacheEntry {
  data: any;
  expiresAt: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  size: number;
}

export class DetailedDataManager {
  private static instance: DetailedDataManager;
  private cache = new Map<string, CacheEntry>();

  // Optimization: extended TTL to reduce token expiration issues
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30-minute expiry (previously 10 minutes)
  private readonly MAX_TTL = 60 * 60 * 1000; // Maximum 1 hour
  private readonly MAX_CACHE_SIZE = 100; // Cache up to 100 objects

  // Auto-renewal configuration
  private readonly AUTO_EXTEND_ON_ACCESS = true; // Auto-renew on access
  private readonly EXTEND_DURATION = 15 * 60 * 1000; // Renew for 15 minutes

  private constructor() {
    // Optimization: reduced cleanup frequency from 60s to 5 minutes
    const timer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    timer.unref();
  }

  static getInstance(): DetailedDataManager {
    if (!this.instance) {
      this.instance = new DetailedDataManager();
    }
    return this.instance;
  }

  /**
   * Smart data handling: automatically determines whether layered return is needed
   */
  smartHandle(data: any, threshold = 50 * 1024): any {
    const jsonStr = safeStringify(data);
    const size = jsonStr.length;

    // Return small data directly
    if (size <= threshold) {
      return data;
    }

    // Return summary + detailId for large data
    logger.info(`Data too large (${(size / 1024).toFixed(1)}KB), returning summary with detailId`);
    return this.createDetailedResponse(data);
  }

  /**
   * Create detailed data response (summary + detailId)
   */
  private createDetailedResponse(data: any): DetailedDataResponse {
    const detailId = this.store(data);
    const summary = this.generateSummary(data);

    return {
      summary,
      detailId,
      hint: `⚠️ Data too large. Use get_detailed_data("${detailId}") to retrieve full data, or get_detailed_data("${detailId}", path="key.subkey") for specific part.`,
      expiresAt: Date.now() + this.DEFAULT_TTL,
    };
  }

  /**
   * Store large data and return access token (optimized - supports LRU)
   */
  store(data: any, customTTL?: number): string {
    // Smart cleanup: use LRU strategy when cache is full instead of clearing all
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    const detailId = `detail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    const ttl = customTTL || this.DEFAULT_TTL;
    const expiresAt = now + ttl;
    const size = safeStringify(data).length;

    const entry: CacheEntry = {
      data,
      expiresAt,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      size,
    };

    this.cache.set(detailId, entry);
    logger.debug(`Stored detailed data: ${detailId}, size: ${(size / 1024).toFixed(1)}KB, expires in ${ttl / 1000}s`);

    return detailId;
  }

  /**
   * Retrieve full or partial data (optimized - supports auto-renewal)
   */
  retrieve(detailId: string, path?: string): any {
    const cached = this.cache.get(detailId);

    if (!cached) {
      throw new Error(`DetailId not found or expired: ${detailId}`);
    }

    const now = Date.now();

    // Check if expired
    if (now > cached.expiresAt) {
      this.cache.delete(detailId);
      throw new Error(`DetailId expired: ${detailId}`);
    }

    // Update access statistics
    cached.lastAccessedAt = now;
    cached.accessCount++;

    // Auto-renewal: if enabled and remaining time is less than 5 minutes, auto-extend
    if (this.AUTO_EXTEND_ON_ACCESS) {
      const remainingTime = cached.expiresAt - now;
      if (remainingTime < 5 * 60 * 1000) {
        cached.expiresAt = Math.min(now + this.EXTEND_DURATION, now + this.MAX_TTL);
        logger.debug(`Auto-extended detailId ${detailId}, new expiry: ${new Date(cached.expiresAt).toISOString()}`);
      }
    }

    // If a path is specified, return partial data
    if (path) {
      return this.getByPath(cached.data, path);
    }

    // Return full data
    return cached.data;
  }

  /**
   * Get partial data from an object by path
   * Example: path="window.byted_acrawler.frontierSign"
   */
  private getByPath(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        throw new Error(`Path not found: ${path} (stopped at ${key})`);
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Generate data summary
   */
  private generateSummary(data: any): DataSummary {
    const jsonStr = safeStringify(data);
    const size = jsonStr.length;
    const type = Array.isArray(data) ? 'array' : typeof data;

    const summary: DataSummary = {
      type,
      size,
      sizeKB: (size / 1024).toFixed(1) + 'KB',
      preview: jsonStr.substring(0, 200) + (size > 200 ? '...' : ''),
    };

    // Object structure analysis
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      summary.structure = {
        keys: keys.slice(0, 50), // Show up to 50 keys
      };

      if (!Array.isArray(data)) {
        // Distinguish methods from properties
        const methods = keys.filter((k) => typeof data[k] === 'function');
        const properties = keys.filter((k) => typeof data[k] !== 'function');

        summary.structure.methods = methods.slice(0, 30);
        summary.structure.properties = properties.slice(0, 30);
      } else {
        summary.structure.length = data.length;
      }
    }

    return summary;
  }

  /**
   * Clean up expired data (optimized - removed force parameter)
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired detailed data entries`);
    }
  }

  /**
   * LRU eviction strategy: remove the least recently accessed entry
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;

    // Find the least recently accessed entry
    let oldestId: string | null = null;
    let oldestAccessTime = Infinity;

    for (const [id, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestAccessTime) {
        oldestAccessTime = entry.lastAccessedAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      const entry = this.cache.get(oldestId)!;
      this.cache.delete(oldestId);
      logger.info(`Evicted LRU entry: ${oldestId}, last accessed: ${new Date(entry.lastAccessedAt).toISOString()}, access count: ${entry.accessCount}`);
    }
  }

  /**
   * Manually extend the expiration time of a detailId
   */
  extend(detailId: string, additionalTime?: number): void {
    const cached = this.cache.get(detailId);

    if (!cached) {
      throw new Error(`DetailId not found: ${detailId}`);
    }

    const now = Date.now();
    if (now > cached.expiresAt) {
      throw new Error(`DetailId already expired: ${detailId}`);
    }

    const extendBy = additionalTime || this.EXTEND_DURATION;
    const newExpiresAt = Math.min(cached.expiresAt + extendBy, now + this.MAX_TTL);
    cached.expiresAt = newExpiresAt;

    logger.info(`Extended detailId ${detailId} by ${extendBy / 1000}s, new expiry: ${new Date(newExpiresAt).toISOString()}`);
  }

  /**
   * Get cache statistics (enhanced)
   */
  getStats() {
    let totalSize = 0;
    let totalAccessCount = 0;
    const entries = Array.from(this.cache.values());

    for (const entry of entries) {
      totalSize += entry.size;
      totalAccessCount += entry.accessCount;
    }

    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.MAX_CACHE_SIZE,
      defaultTTLSeconds: this.DEFAULT_TTL / 1000,
      maxTTLSeconds: this.MAX_TTL / 1000,
      totalSizeKB: (totalSize / 1024).toFixed(1),
      avgAccessCount: entries.length > 0 ? (totalAccessCount / entries.length).toFixed(1) : '0',
      autoExtendEnabled: this.AUTO_EXTEND_ON_ACCESS,
      extendDurationSeconds: this.EXTEND_DURATION / 1000,
    };
  }

  /**
   * Get detailed cache entry information
   */
  getDetailedStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([id, entry]) => ({
      detailId: id,
      sizeKB: (entry.size / 1024).toFixed(1),
      createdAt: new Date(entry.createdAt).toISOString(),
      lastAccessedAt: new Date(entry.lastAccessedAt).toISOString(),
      expiresAt: new Date(entry.expiresAt).toISOString(),
      remainingSeconds: Math.max(0, Math.floor((entry.expiresAt - now) / 1000)),
      accessCount: entry.accessCount,
      isExpired: now > entry.expiresAt,
    }));

    // Sort by last access time
    entries.sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());

    return entries;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cleared all detailed data cache');
  }
}
