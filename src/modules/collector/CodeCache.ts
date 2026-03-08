/**
 * Code cache manager - caches collected code to avoid redundant collection
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import type { CodeFile, CollectCodeResult } from '../../types/index.js';

export interface CacheEntry {
  url: string;
  files: CodeFile[];
  totalSize: number;
  collectTime: number;
  timestamp: number;
  hash: string;
}

export interface CacheOptions {
  cacheDir?: string;
  maxAge?: number; // Cache expiration time (milliseconds)
  maxSize?: number; // Maximum cache size (bytes)
}

export class CodeCache {
  private cacheDir: string;
  private maxAge: number;
  private maxSize: number;
  private memoryCache: Map<string, CacheEntry> = new Map();

  // Memory cache size limit (prevents memory leaks)
  private readonly MAX_MEMORY_CACHE_SIZE = 100; // Maximum 100 entries

  constructor(options: CacheOptions = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.cache', 'code');
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // Default 24 hours
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // Default 100MB
  }

  /**
   * Initialize cache directory
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.debug(`Cache directory initialized: ${this.cacheDir}`);
    } catch (error) {
      logger.error('Failed to initialize cache directory:', error);
    }
  }

  /**
   * Generate cache key
   */
  private generateKey(url: string, options?: Record<string, unknown>): string {
    const data = JSON.stringify({ url, options });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Get cache file path
   */
  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.maxAge;
  }

  /**
   * Get from cache
   */
  async get(url: string, options?: Record<string, unknown>): Promise<CollectCodeResult | null> {
    const key = this.generateKey(url, options);

    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      if (!this.isExpired(entry)) {
        logger.debug(`Cache hit (memory): ${url}`);
        return {
          files: entry.files,
          dependencies: { nodes: [], edges: [] },
          totalSize: entry.totalSize,
          collectTime: entry.collectTime,
        };
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check disk cache
    try {
      const cachePath = this.getCachePath(key);
      const data = await fs.readFile(cachePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(data);

      if (this.isExpired(entry)) {
        logger.debug(`Cache expired: ${url}`);
        await fs.unlink(cachePath);
        return null;
      }

      // Load into memory cache
      this.memoryCache.set(key, entry);

      logger.debug(`Cache hit (disk): ${url}`);
      return {
        files: entry.files,
        dependencies: { nodes: [], edges: [] },
        totalSize: entry.totalSize,
        collectTime: entry.collectTime,
      };
    } catch (error) {
      // Cache does not exist or read failed
      return null;
    }
  }

  /**
   * Save to cache
   */
  async set(url: string, result: CollectCodeResult, options?: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(url, options);
    const hash = crypto.createHash('md5').update(JSON.stringify(result.files)).digest('hex');

    const entry: CacheEntry = {
      url,
      files: result.files,
      totalSize: result.totalSize,
      collectTime: result.collectTime,
      timestamp: Date.now(),
      hash,
    };

    // Save to memory cache
    this.memoryCache.set(key, entry);

    // Fix: limit memory cache size (LRU strategy)
    if (this.memoryCache.size > this.MAX_MEMORY_CACHE_SIZE) {
      // Delete the oldest entry (Map preserves insertion order)
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
        logger.debug(`Memory cache evicted: ${firstKey}`);
      }
    }

    // Save to disk cache
    try {
      const cachePath = this.getCachePath(key);
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
      logger.debug(`Cache saved: ${url} (${(result.totalSize / 1024).toFixed(2)} KB)`);
    } catch (error) {
      logger.error('Failed to save cache:', error);
    }

    // Check cache size
    await this.cleanup();
  }

  /**
   * Clean up expired cache
   */
  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      const entries: Array<{ file: string; mtime: Date; size: number }> = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        entries.push({
          file: filePath,
          mtime: stats.mtime,
          size: stats.size,
        });
      }

      // If total size exceeds limit, delete the oldest files
      if (totalSize > this.maxSize) {
        entries.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

        let removedSize = 0;
        for (const entry of entries) {
          if (totalSize - removedSize <= this.maxSize * 0.8) break;

          await fs.unlink(entry.file);
          removedSize += entry.size;
          logger.debug(`Removed old cache: ${entry.file}`);
        }

        logger.info(`Cache cleanup: removed ${removedSize} bytes`);
      }
    } catch (error) {
      logger.error('Failed to cleanup cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }

      logger.info('All cache cleared');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memoryEntries: number;
    diskEntries: number;
    totalSize: number;
  }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      let diskEntries = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        diskEntries++;
      }

      return {
        memoryEntries: this.memoryCache.size,
        diskEntries,
        totalSize,
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        memoryEntries: this.memoryCache.size,
        diskEntries: 0,
        totalSize: 0,
      };
    }
  }

  /**
   * Warm up cache (load frequently used URLs into memory)
   */
  async warmup(urls: string[]): Promise<void> {
    logger.info(`Warming up cache for ${urls.length} URLs...`);

    for (const url of urls) {
      await this.get(url);
    }

    logger.info('Cache warmup completed');
  }
}

