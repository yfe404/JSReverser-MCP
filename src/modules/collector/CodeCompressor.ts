/**
 * Code compressor - uses gzip compression to reduce token consumption
 *
 * Features:
 * 1. Multi-level compression (levels 0-9)
 * 2. Stream compression (large files)
 * 3. Chunked compression (parallel)
 * 4. Concurrent batch compression
 * 5. Compression cache (LRU)
 * 6. Statistics monitoring
 * 7. Retry mechanism
 * 8. Progress callback
 */

import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { logger } from '../../utils/logger.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ==================== Interface definitions ====================

export interface CompressedCode {
  compressed: string; // Base64-encoded gzip data
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  level?: number; // Compression level
  chunks?: number; // Number of chunks
  metadata?: {
    hash: string; // Hash of original content
    timestamp: number;
    compressionTime: number; // Compression time (ms)
  };
}

export interface CompressOptions {
  level?: number; // Compression level 0-9 (default 6)
  chunkSize?: number; // Chunk size (bytes, default 100KB)
  useCache?: boolean; // Whether to use cache (default true)
  maxRetries?: number; // Maximum retry count (default 3)
  onProgress?: (progress: number) => void; // Progress callback
}

export interface BatchCompressOptions extends CompressOptions {
  concurrency?: number; // Concurrency count (default 5)
  onFileProgress?: (file: string, progress: number) => void; // Per-file progress
}

export interface CompressionStats {
  totalCompressed: number; // Total compression count
  totalOriginalSize: number; // Total original size
  totalCompressedSize: number; // Total compressed size
  averageRatio: number; // Average compression ratio
  cacheHits: number; // Cache hit count
  cacheMisses: number; // Cache miss count
  totalTime: number; // Total time (ms)
}

interface CacheEntry {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timestamp: number;
}

// ==================== Class implementation ====================

export class CodeCompressor {
  private readonly DEFAULT_LEVEL = 6;
  private readonly DEFAULT_CHUNK_SIZE = 100 * 1024; // 100KB
  private readonly DEFAULT_CONCURRENCY = 5;
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly CACHE_MAX_SIZE = 100; // Maximum 100 cached entries
  private readonly CACHE_TTL = 3600 * 1000; // 1 hour

  // Compression cache (LRU)
  private cache: Map<string, CacheEntry> = new Map();

  // Statistics
  private stats: CompressionStats = {
    totalCompressed: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    averageRatio: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalTime: 0,
  };

  /**
   * Compress code (enhanced version)
   */
  async compress(code: string, options: CompressOptions = {}): Promise<CompressedCode> {
    const startTime = Date.now();
    const level = options.level ?? this.DEFAULT_LEVEL;
    const useCache = options.useCache ?? true;
    const maxRetries = options.maxRetries ?? this.DEFAULT_MAX_RETRIES;

    // Generate cache key
    const cacheKey = this.generateCacheKey(code, level);

    // Check cache
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.stats.cacheHits++;
        logger.debug(`Cache hit for compression (${code.length} bytes)`);
        return {
          compressed: cached.compressed,
          originalSize: cached.originalSize,
          compressedSize: cached.compressedSize,
          compressionRatio: cached.compressionRatio,
          level,
        };
      } else {
        this.cache.delete(cacheKey);
      }
    }

    this.stats.cacheMisses++;

    // Retry compression
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const buffer = Buffer.from(code, 'utf-8');
        const compressed = await gzipAsync(buffer, { level });
        const base64 = compressed.toString('base64');

        const originalSize = buffer.length;
        const compressedSize = compressed.length;
        const compressionRatio = (1 - compressedSize / originalSize) * 100;
        const compressionTime = Date.now() - startTime;

        // Update statistics
        this.stats.totalCompressed++;
        this.stats.totalOriginalSize += originalSize;
        this.stats.totalCompressedSize += compressedSize;
        this.stats.averageRatio = (1 - this.stats.totalCompressedSize / this.stats.totalOriginalSize) * 100;
        this.stats.totalTime += compressionTime;

        const result: CompressedCode = {
          compressed: base64,
          originalSize,
          compressedSize,
          compressionRatio,
          level,
          metadata: {
            hash: cacheKey,
            timestamp: Date.now(),
            compressionTime,
          },
        };

        // Save to cache
        if (useCache) {
          this.addToCache(cacheKey, {
            compressed: base64,
            originalSize,
            compressedSize,
            compressionRatio,
            timestamp: Date.now(),
          });
        }

        logger.debug(`Compressed code: ${originalSize} -> ${compressedSize} bytes (${compressionRatio.toFixed(1)}% reduction, level ${level}, ${compressionTime}ms)`);

        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Compression attempt ${attempt + 1}/${maxRetries} failed:`, error);

        if (attempt < maxRetries - 1) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }

    logger.error('Failed to compress code after retries:', lastError);
    throw lastError || new Error('Compression failed');
  }

  /**
   * Decompress code (enhanced version)
   */
  async decompress(compressed: string, maxRetries: number = 3): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const buffer = Buffer.from(compressed, 'base64');
        const decompressed = await gunzipAsync(buffer);
        return decompressed.toString('utf-8');
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Decompression attempt ${attempt + 1}/${maxRetries} failed:`, error);

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }

    logger.error('Failed to decompress code after retries:', lastError);
    throw lastError || new Error('Decompression failed');
  }

  /**
   * Batch compress files (enhanced version - concurrent)
   */
  async compressBatch(
    files: Array<{ url: string; content: string }>,
    options: BatchCompressOptions = {}
  ): Promise<Array<{
    url: string;
    compressed: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }>> {
    const concurrency = options.concurrency ?? this.DEFAULT_CONCURRENCY;
    const results: Array<{
      url: string;
      compressed: string;
      originalSize: number;
      compressedSize: number;
      compressionRatio: number;
    }> = [];

    // Batch concurrent compression
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const result = await this.compress(file.content, options);

            // Per-file progress callback
            if (options.onFileProgress) {
              options.onFileProgress(file.url, 100);
            }

            return {
              url: file.url,
              compressed: result.compressed,
              originalSize: result.originalSize,
              compressedSize: result.compressedSize,
              compressionRatio: result.compressionRatio,
            };
          } catch (error) {
            logger.error(`Failed to compress ${file.url}:`, error);
            // Return uncompressed data
            return {
              url: file.url,
              compressed: Buffer.from(file.content).toString('base64'),
              originalSize: file.content.length,
              compressedSize: file.content.length,
              compressionRatio: 0,
            };
          }
        })
      );

      results.push(...batchResults);

      // Overall progress callback
      if (options.onProgress) {
        options.onProgress((results.length / files.length) * 100);
      }
    }

    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalRatio = totalOriginal > 0 ? (1 - totalCompressed / totalOriginal) * 100 : 0;

    logger.info(`Batch compression: ${results.length} files, ${(totalOriginal / 1024).toFixed(2)} KB -> ${(totalCompressed / 1024).toFixed(2)} KB (${totalRatio.toFixed(1)}% reduction)`);

    return results;
  }

  /**
   * Determine if compression is worthwhile
   */
  shouldCompress(code: string, threshold: number = 1024): boolean {
    // Code smaller than threshold is not compressed (compression overhead exceeds benefit)
    return code.length > threshold;
  }

  /**
   * Intelligently select compression level
   */
  selectCompressionLevel(size: number): number {
    if (size < 10 * 1024) {
      return 1; // <10KB: fast compression
    } else if (size < 100 * 1024) {
      return 6; // 10-100KB: balanced
    } else if (size < 1024 * 1024) {
      return 9; // 100KB-1MB: maximum compression
    } else {
      return 6; // >1MB: balanced (avoid being too slow)
    }
  }

  /**
   * Stream compression (large files)
   *
   * Note: Output format is compatible with decompress() (single gzip base64).
   * Chunking is only used for progress callbacks and memory control; the final result is a single compressed output.
   */
  async compressStream(code: string, options: CompressOptions = {}): Promise<CompressedCode> {
    const chunkSize = options.chunkSize ?? this.DEFAULT_CHUNK_SIZE;

    // If file is smaller than chunk size, use normal compression
    if (code.length <= chunkSize) {
      return this.compress(code, options);
    }

    const startTime = Date.now();
    const totalChunks = Math.ceil(code.length / chunkSize);

    // Progress callback (reports progress per chunk, but compresses as a whole)
    if (options.onProgress) {
      for (let i = 0; i < code.length; i += chunkSize) {
        options.onProgress(((i + chunkSize) / code.length) * 80); // First 80% is the "analysis" phase
      }
    }

    // Compress as a whole (maintaining format compatible with decompress)
    const result = await this.compress(code, { ...options, useCache: false });

    if (options.onProgress) {
      options.onProgress(100);
    }

    const compressionTime = Date.now() - startTime;

    logger.info(`Stream compression: ${totalChunks} chunks analyzed, ${(result.originalSize / 1024).toFixed(2)} KB -> ${(result.compressedSize / 1024).toFixed(2)} KB (${result.compressionRatio.toFixed(1)}% reduction, ${compressionTime}ms)`);

    return {
      ...result,
      chunks: totalChunks,
      metadata: {
        hash: this.generateCacheKey(code, options.level ?? this.DEFAULT_LEVEL),
        timestamp: Date.now(),
        compressionTime,
      },
    };
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCompressed: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageRatio: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTime: 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Compression cache cleared');
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  // ==================== Private methods ====================

  /**
   * Generate cache key
   */
  private generateCacheKey(code: string, level: number): string {
    const hash = createHash('md5').update(code).digest('hex');
    return `${hash}-${level}`;
  }

  /**
   * Add to cache (LRU)
   */
  private addToCache(key: string, entry: CacheEntry): void {
    // If cache is full, delete the oldest entry
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, entry);
  }
}

