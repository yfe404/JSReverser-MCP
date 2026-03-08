/**
 * Code collection module - full implementation
 *
 * Features:
 * - Collect page inline scripts
 * - Collect external script files
 * - Collect dynamically loaded scripts
 * - Collect Service Workers and Web Workers
 * - CDP session control and network monitoring
 * - Anti-detection and resource interception
 */

import type { Browser, Page, CDPSession } from 'puppeteer';
import type {
  CollectCodeOptions,
  CollectCodeResult,
  CodeFile,
  PuppeteerConfig,
  DependencyGraph,
} from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { CodeCache } from './CodeCache.js';
import { SmartCodeCollector, type SmartCollectOptions } from './SmartCodeCollector.js';
import { CodeCompressor } from './CodeCompressor.js';
// import { StreamingCollector } from './StreamingCollector.js'; // Not used yet
import { BrowserModeManager } from '../browser/BrowserModeManager.js';

export class CodeCollector {
  private config: PuppeteerConfig;
  private readonly browserManager: BrowserModeManager;
  private browser: Browser | null = null;
  private browserListenerAttached = false;
  private collectedUrls: Set<string> = new Set(); // Prevent duplicate collection

  // 🔧 Redesigned: support full collection for large websites
  // Strategy: collect all files to cache, apply limits only when returning
  private readonly MAX_COLLECTED_URLS: number;
  private readonly MAX_FILES_PER_COLLECT: number;  // Retained, but only used when returning
  private readonly MAX_RESPONSE_SIZE: number;      // 🆕 Max size per response (not collection size)
  private readonly MAX_SINGLE_FILE_SIZE: number;
  private readonly MAX_FILES_CACHE_SIZE: number;   // 🆕 Max file cache count (prevent memory leaks)
  private RESPONSE_BODY_TIMEOUT_MS: number;
  private readonly userAgent: string;

  // 🆕 Complete collected data storage (supports large websites)
  private collectedFilesCache: Map<string, CodeFile> = new Map();

  // ✅ Cache
  private cache: CodeCache;
  private cacheEnabled: boolean = true;

  // 🆕 Smart collection, compression
  private smartCollector: SmartCodeCollector;
  private compressor: CodeCompressor;

  // 🆕 CDP session management (prevent memory leaks)
  private cdpSession: CDPSession | null = null;
  private cdpListeners: {
    responseReceived?: (params: any) => void;
  } = {};
  private pageResolver?: () => Page | null | undefined;

  constructor(config: PuppeteerConfig, browserManager: BrowserModeManager) {
    this.config = config;
    this.browserManager = browserManager;

    // 🔧 Redesigned limiting strategy
    // Collection phase: can collect a large number of files (supports large websites)
    // Return phase: limit single response size (prevent MCP token overflow)
    this.MAX_COLLECTED_URLS = config.maxCollectedUrls ?? 10000;
    this.MAX_FILES_PER_COLLECT = config.maxFilesPerCollect ?? 200;     // Increased to 200 (was 50)
    this.MAX_RESPONSE_SIZE = config.maxTotalContentSize ?? 512 * 1024; // Single response 512KB
    this.MAX_SINGLE_FILE_SIZE = config.maxSingleFileSize ?? 200 * 1024; // Increased to 200KB
    this.MAX_FILES_CACHE_SIZE = 1000;  // 🆕 Max file cache 1000 entries (prevent memory leaks)
    this.RESPONSE_BODY_TIMEOUT_MS = 3000;

    this.userAgent = config.userAgent ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    // Initialize all modules
    this.cache = new CodeCache();
    this.smartCollector = new SmartCodeCollector();
    this.compressor = new CodeCompressor();

    logger.info(`📊 CodeCollector limits: maxCollect=${this.MAX_FILES_PER_COLLECT} files, maxResponse=${(this.MAX_RESPONSE_SIZE / 1024).toFixed(0)}KB, maxSingle=${(this.MAX_SINGLE_FILE_SIZE / 1024).toFixed(0)}KB`);
    logger.info(`💡 Strategy: Collect ALL files → Cache → Return summary/partial data to fit MCP limits`);
  }

  /**
   * Enable/disable cache
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    logger.info(`Code cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clear file cache
   */
  async clearFileCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get file cache statistics
   */
  async getFileCacheStats() {
    return await this.cache.getStats();
  }

  /**
   * 🆕 Clear all collected data (called when switching websites)
   */
  async clearAllData(): Promise<void> {
    logger.info('🧹 Clearing all collected data...');

    // Clear file cache
    await this.cache.clear();

    // Clear compression cache
    this.compressor.clearCache();

    // Reset compression statistics
    this.compressor.resetStats();

    // Clear collected URLs
    this.collectedUrls.clear();

    // Clear file cache (in-memory)
    this.collectedFilesCache.clear();

    logger.success('✅ All data cleared');
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(message));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * 🆕 Get all statistics
   */
  async getAllStats() {
    const cacheStats = await this.cache.getStats();
    const compressionStats = this.compressor.getStats();

    return {
      cache: cacheStats,
      compression: {
        ...compressionStats,
        cacheSize: this.compressor.getCacheSize(),
      },
      collector: {
        collectedUrls: this.collectedUrls.size,
        maxCollectedUrls: this.MAX_COLLECTED_URLS,
      },
    };
  }

  /**
   * 🆕 Get cache instance (for UnifiedCacheManager)
   */
  public getCache(): CodeCache {
    return this.cache;
  }

  /**
   * 🆕 Get compressor instance (for UnifiedCacheManager)
   */
  public getCompressor(): CodeCompressor {
    return this.compressor;
  }

  /**
   * Use an external context to provide the current page, taking priority over internal browser management state.
   */
  setPageResolver(resolver?: () => Page | null | undefined): void {
    this.pageResolver = resolver;
  }

  /**
   * Clean up collected URLs (prevent memory leaks)
   */
  private cleanupCollectedUrls(): void {
    if (this.collectedUrls.size > this.MAX_COLLECTED_URLS) {
      logger.warn(`Collected URLs exceeded ${this.MAX_COLLECTED_URLS}, clearing...`);
      // Keep the most recent half
      const urls = Array.from(this.collectedUrls);
      this.collectedUrls.clear();
      urls.slice(-Math.floor(this.MAX_COLLECTED_URLS / 2)).forEach(url =>
        this.collectedUrls.add(url)
      );
    }
  }

  /**
   * Wait for dynamic scripts to stabilize, preferring Puppeteer's network idle capability
   */
  private async waitForDynamicScripts(page: Page, waitMs: number): Promise<void> {
    if (waitMs <= 0) {
      return;
    }

    const pageWithNetworkIdle = page as unknown as {
      waitForNetworkIdle?: (options?: { idleTime?: number; timeout?: number }) => Promise<void>;
    };

    if (typeof pageWithNetworkIdle.waitForNetworkIdle === 'function') {
      try {
        await pageWithNetworkIdle.waitForNetworkIdle({
          idleTime: Math.min(1000, Math.max(300, Math.floor(waitMs / 3))),
          timeout: waitMs,
        });
        return;
      } catch (error) {
        logger.debug('[Dynamic] waitForNetworkIdle timeout/fallback', error);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  /**
   * Initialize browser - managed uniformly by BrowserModeManager
   */
  async init(): Promise<void> {
    if (this.browser && this.browser.isConnected()) {
      return;
    }

    logger.info('Initializing browser via BrowserModeManager...');
    this.browser = await this.browserManager.launch();

    if (!this.browser) {
      throw new Error('Browser failed to initialize');
    }

    if (!this.browserListenerAttached) {
      this.browser.on('disconnected', () => {
        logger.warn('⚠️  Browser disconnected');
        this.browser = null;
        if (this.cdpSession) {
          this.cdpSession = null;
          this.cdpListeners = {};
        }
        this.browserListenerAttached = false;
      });
      this.browserListenerAttached = true;
    }

    // 🆕 Initialize cache directory
    await this.cache.init();

    logger.success('Browser initialized via BrowserModeManager');
  }

  /**
   * Close browser and clean up all data
   */
  async close(): Promise<void> {
    // 🆕 Clean up data first
    await this.clearAllData();

    // Then close the browser
    if (this.browser) {
      await this.browserManager.close();
      this.browser = null;
      this.browserListenerAttached = false;
      logger.info('Browser closed (via BrowserModeManager) and all data cleared');
    }
  }

  /**
   * 🆕 Get the currently active Page instance
   */
  async getActivePage(): Promise<Page> {
    if (!this.browser || !this.browser.isConnected()) {
      await this.init();
    }

    const resolvedPage = this.pageResolver?.();
    if (resolvedPage && !resolvedPage.isClosed()) {
      return resolvedPage;
    }

    const managedPage = this.browserManager.getCurrentPage();
    if (managedPage && !managedPage.isClosed()) {
      return managedPage;
    }

    if (this.browser) {
      const pages = await this.browser.pages();
      const usablePages = pages.filter((page) => !page.isClosed());
      if (usablePages.length > 0) {
        const fallbackPage = usablePages[usablePages.length - 1];
        if (fallbackPage && !fallbackPage.isClosed()) {
          return fallbackPage;
        }
      }
    }

    return await this.browserManager.newPage();
  }

  /**
   * 🆕 Create a new page
   */
  async createPage(url?: string): Promise<Page> {
    if (!this.browser || !this.browser.isConnected()) {
      await this.init();
    }

    const page = await this.browserManager.newPage();

    // 🆕 Set User-Agent (using config)
    await page.setUserAgent(this.userAgent);

    // BrowserModeManager already injects anti-detection scripts automatically in newPage(), no need to inject again

    if (url) {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });
    }

    logger.info(`New page created${url ? `: ${url}` : ''}`);
    return page;
  }

  /**
   * 🆕 Get browser status
   *
   * ✅ Fix: removed usage of isConnected(), using try-catch to detect browser state
   * Reason: isConnected() is deprecated and may give false results during page navigation
   */
  async getStatus(): Promise<{
    running: boolean;
    pagesCount: number;
    version?: string;
  }> {
    if (!this.browser || !this.browser.isConnected()) {
      const managedBrowser = this.browserManager.getBrowser();
      if (managedBrowser && managedBrowser.isConnected()) {
        this.browser = managedBrowser;
      } else {
        return {
          running: false,
          pagesCount: 0,
        };
      }
    }

    // ✅ Fix: use try-catch instead of isConnected()
    if (!this.browser) {
      return {
        running: false,
        pagesCount: 0,
      };
    }

    try {
      // Try to get pages; if the browser is closed, an exception will be thrown
      const pages = await this.browser.pages();
      const version = await this.browser.version();

      return {
        running: true,
        pagesCount: pages.length,
        version,
      };
    } catch (error) {
      // Browser is closed or connection is lost
      logger.debug('Browser not running or disconnected:', error);
      return {
        running: false,
        pagesCount: 0,
      };
    }
  }

  /**
   * Collect code - fully enhanced version
   *
   * Enhanced features:
   * 1. CDP network interception - lower-level script collection
   * 2. Anti-detection techniques - bypass webdriver detection
   * 3. Dynamic script monitoring - MutationObserver listening for DOM changes
   * 4. Memory leak protection - automatic cleanup of collected URLs
   * 5. Error recovery - exception handling and resource cleanup
   */
  async collect(options: CollectCodeOptions): Promise<CollectCodeResult> {
    const startTime = Date.now();
    logger.info(`Collecting code from: ${options.url}`);

    // ✅ Check cache
    if (this.cacheEnabled) {
      const cached = await this.cache.get(options.url, options as any);
      if (cached) {
        logger.info(`✅ Cache hit for: ${options.url}`);
        return cached;
      }
    }

    await this.init();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browserManager.newPage();
    // ✅ Fix: no longer clearing every time, relying on cleanupCollectedUrls() for automatic management
    // this.collectedUrls.clear(); // Removed

    try {
      // Set timeout
      page.setDefaultTimeout(options.timeout || this.config.timeout);

      // ✅ Fix: use configured User-Agent instead of hardcoded one
      await page.setUserAgent(this.userAgent);

      // BrowserModeManager already injects anti-detection scripts automatically in newPage(), no need to inject again

      // Collected code files (full collection, no total size limit)
      const files: CodeFile[] = [];

      // ✅ Fix: use the new API to avoid deprecation warnings
      this.cdpSession = await page.createCDPSession();
      await this.cdpSession.send('Network.enable');
      await this.cdpSession.send('Runtime.enable');

      // ✅ Fix: save listener references for easy removal
      this.cdpListeners.responseReceived = async (params: any) => {
        const { response, requestId, type } = params;
        const url = response.url;

        // 🔧 Fix: only limit file count, not total size (supports full collection for large websites)
        if (files.length >= this.MAX_FILES_PER_COLLECT) {
          if (files.length === this.MAX_FILES_PER_COLLECT) {
            logger.warn(`⚠️  Reached max files limit (${this.MAX_FILES_PER_COLLECT}), will skip remaining files`);
          }
          return;
        }

        // Periodically clean up collected URLs (prevent memory leaks)
        this.cleanupCollectedUrls();

        // Filter JavaScript resources
        if (
          type === 'Script' ||
          response.mimeType?.includes('javascript') ||
          url.endsWith('.js')
        ) {
          try {
            // ✅ Fix: check if cdpSession exists
            if (!this.cdpSession) {
              logger.warn(`[CDP] Session not available for: ${url}`);
              return;
            }

            // Get response body
            const { body, base64Encoded } = await this.withTimeout(
              this.cdpSession.send('Network.getResponseBody', {
                requestId,
              }) as Promise<{body: string; base64Encoded: boolean}>,
              this.RESPONSE_BODY_TIMEOUT_MS,
              `Timed out retrieving response body for ${url}`,
            );

            const content = base64Encoded ? Buffer.from(body, 'base64').toString('utf-8') : body;

            // 🔧 Limit single file size (prevent individual files from being too large)
            const contentSize = content.length;

            let finalContent = content;
            let truncated = false;

            if (contentSize > this.MAX_SINGLE_FILE_SIZE) {
              // Truncate oversized file, keeping the beginning portion
              finalContent = content.substring(0, this.MAX_SINGLE_FILE_SIZE);
              truncated = true;
              logger.warn(`[CDP] Large file truncated: ${url} (${(contentSize / 1024).toFixed(2)} KB -> ${(this.MAX_SINGLE_FILE_SIZE / 1024).toFixed(2)} KB)`);
            }

            // Prevent duplicate collection
            if (!this.collectedUrls.has(url)) {
              this.collectedUrls.add(url);
              const file: CodeFile = {
                url,
                content: finalContent,
                size: finalContent.length,
                type: 'external',
                metadata: truncated ? {
                  truncated: true,
                  originalSize: contentSize,
                  truncatedSize: finalContent.length,
                } : undefined,
              };
              files.push(file);

              // ✅ Fix: check cache size limit to prevent memory leaks
              if (this.collectedFilesCache.size >= this.MAX_FILES_CACHE_SIZE) {
                // Remove the oldest added file (FIFO strategy)
                const firstKey = this.collectedFilesCache.keys().next().value;
                if (firstKey) {
                  this.collectedFilesCache.delete(firstKey);
                  logger.debug(`[Cache] Removed oldest file to maintain cache limit: ${firstKey}`);
                }
              }

              // 🆕 Also store in cache for subsequent on-demand retrieval
              this.collectedFilesCache.set(url, file);

              logger.debug(`[CDP] Collected (${files.length}/${this.MAX_FILES_PER_COLLECT}): ${url} (${(finalContent.length / 1024).toFixed(2)} KB)${truncated ? ' [TRUNCATED]' : ''}`);
            }
          } catch (error) {
            logger.warn(`[CDP] Failed to get response body for: ${url}`, error);
          }
        }
      };

      // ✅ Register listener
      this.cdpSession.on('Network.responseReceived', this.cdpListeners.responseReceived);

      // Navigate to the page
      logger.info(`Navigating to: ${options.url}`);
      await page.goto(options.url, {
        waitUntil: 'networkidle2',
        timeout: options.timeout || this.config.timeout,
      });

      // Collect inline scripts
      if (options.includeInline !== false) {
        logger.info('Collecting inline scripts...');
        const inlineScripts = await this.collectInlineScripts(page);
        files.push(...inlineScripts);
      }

      // Collect Service Workers
      if (options.includeServiceWorker !== false) {
        logger.info('Collecting Service Workers...');
        const serviceWorkers = await this.collectServiceWorkers(page);
        files.push(...serviceWorkers);
      }

      // Collect Web Workers
      if (options.includeWebWorker !== false) {
        logger.info('Collecting Web Workers...');
        const webWorkers = await this.collectWebWorkers(page);
        files.push(...webWorkers);
      }

      // Collect dynamically loaded scripts
      if (options.includeDynamic) {
        const dynamicWaitMs = options.dynamicWaitMs ?? Math.min(3000, options.timeout ?? this.config.timeout);
        logger.info(`Waiting for dynamic scripts (up to ${dynamicWaitMs}ms)...`);
        await this.waitForDynamicScripts(page, dynamicWaitMs);
      }

      // CDP session cleanup moved to the finally block to ensure proper resource release

      const collectTime = Date.now() - startTime;
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      // ✅ Count truncated files
      const truncatedFiles = files.filter(f => f.metadata?.truncated);
      if (truncatedFiles.length > 0) {
        logger.warn(`⚠️  ${truncatedFiles.length} files were truncated due to size limits`);
        truncatedFiles.forEach(f => {
          // ✅ Fix: safely access originalSize
          const originalSize = typeof f.metadata?.originalSize === 'number' ? f.metadata.originalSize : f.size;
          logger.warn(`  - ${f.url}: ${(originalSize / 1024).toFixed(2)} KB -> ${(f.size / 1024).toFixed(2)} KB`);
        });
      }

      // 🆕 Smart collection processing
      let processedFiles = files;

      if (options.smartMode && options.smartMode !== 'full') {
        try {
          logger.info(`🧠 Applying smart collection mode: ${options.smartMode}`);

          const smartOptions: SmartCollectOptions = {
            mode: options.smartMode,
            maxTotalSize: options.maxTotalSize,
            maxFileSize: options.maxFileSize,
            priorities: options.priorities,
          };

          const smartResult = await this.smartCollector.smartCollect(page, files, smartOptions);

          // If in summary mode, return summaries instead of full files
          if (options.smartMode === 'summary') {
            logger.info(`📊 Returning ${smartResult.length} code summaries`);

            // ✅ Type safe: summary mode returns CodeSummary[]
            if (Array.isArray(smartResult) && smartResult.length > 0 && smartResult[0] && 'hasEncryption' in smartResult[0]) {
              return {
                files: [], // Summary mode does not return full files
                summaries: smartResult as Array<{
                  url: string;
                  size: number;
                  type: string;
                  hasEncryption: boolean;
                  hasAPI: boolean;
                  hasObfuscation: boolean;
                  functions: string[];
                  imports: string[];
                  preview: string;
                }>,
                dependencies: { nodes: [], edges: [] },
                totalSize: 0,
                collectTime: Date.now() - startTime,
              };
            }
          }

          // ✅ Type safe: priority/incremental mode returns CodeFile[]
          if (Array.isArray(smartResult) && (smartResult.length === 0 || (smartResult[0] && 'content' in smartResult[0]))) {
            processedFiles = smartResult as CodeFile[];
          } else {
            logger.warn('Smart collection returned unexpected type, using original files');
            processedFiles = files;
          }
        } catch (error) {
          logger.error('Smart collection failed, using original files:', error);
          processedFiles = files;
        }
      }

      // 🆕 Compression processing (enhanced - using batch compression and smart level selection)
      if (options.compress) {
        try {
          logger.info(`🗜️  Compressing ${processedFiles.length} files with enhanced compressor...`);

          // Prepare files that need compression
          const filesToCompress = processedFiles
            .filter(file => this.compressor.shouldCompress(file.content))
            .map(file => ({
              url: file.url,
              content: file.content,
            }));

          if (filesToCompress.length === 0) {
            logger.info('No files need compression (all below threshold)');
          } else {
            // Use batch compression (concurrency optimized)
            const compressedResults = await this.compressor.compressBatch(filesToCompress, {
              level: undefined, // Auto-select level
              useCache: true,
              maxRetries: 3,
              concurrency: 5,
              onProgress: (progress) => {
                if (progress % 25 === 0) {
                  logger.debug(`Compression progress: ${progress.toFixed(0)}%`);
                }
              },
            });

            // Update file metadata
            const compressedMap = new Map(
              compressedResults.map(r => [r.url, r])
            );

            for (const file of processedFiles) {
              const compressed = compressedMap.get(file.url);
              if (compressed) {
                file.metadata = {
                  ...file.metadata,
                  compressed: true,
                  originalSize: compressed.originalSize,
                  compressedSize: compressed.compressedSize,
                  compressionRatio: compressed.compressionRatio,
                };
              }
            }

            // Get compression statistics
            const stats = this.compressor.getStats();
            logger.info(`✅ Compressed ${compressedResults.length}/${processedFiles.length} files`);
            logger.info(`📊 Compression stats: ${(stats.totalOriginalSize / 1024).toFixed(2)} KB -> ${(stats.totalCompressedSize / 1024).toFixed(2)} KB (${stats.averageRatio.toFixed(1)}% reduction)`);
            logger.info(`⚡ Cache: ${stats.cacheHits} hits, ${stats.cacheMisses} misses (${stats.cacheHits > 0 ? ((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(1) : 0}% hit rate)`);
          }
        } catch (error) {
          logger.error('Compression failed:', error);
          // Continue execution without affecting the main flow
        }
      }

      // Analyze dependencies
      const dependencies = this.analyzeDependencies(processedFiles);

      logger.success(
        `Collected ${processedFiles.length} files (${(totalSize / 1024).toFixed(2)} KB) in ${collectTime}ms`
      );

      const result: CollectCodeResult = {
        files: processedFiles,
        dependencies,
        totalSize,
        collectTime,
      };

      // ✅ Save to cache
      if (this.cacheEnabled) {
        await this.cache.set(options.url, result, options as any);
        logger.debug(`💾 Saved to cache: ${options.url}`);
      }

      return result;
    } catch (error) {
      logger.error('Code collection failed', error);
      throw error;
    } finally {
      // ✅ Fix: clean up CDP session in the finally block to ensure proper cleanup regardless of exceptions
      if (this.cdpSession) {
        try {
          // Remove listeners first
          if (this.cdpListeners.responseReceived) {
            this.cdpSession.off('Network.responseReceived', this.cdpListeners.responseReceived);
          }
          // Then detach
          await this.cdpSession.detach();
        } catch (cleanupError) {
          logger.warn('Failed to cleanup CDP session', cleanupError);
        } finally {
          this.cdpSession = null;
          this.cdpListeners = {};
        }
      }

      // Finally close the page
      await page.close();
    }
  }

  /**
   * Collect inline scripts - enhanced version
   *
   * 🔧 Fix: added size and count limits to prevent oversized inline scripts from causing token overflow
   */
  private async collectInlineScripts(page: Page): Promise<CodeFile[]> {
    const scripts = await page.evaluate((maxSingleSize: number) => {
      const scriptElements = Array.from(document.querySelectorAll('script')) as HTMLScriptElement[];
      return scriptElements
        .filter((script) => !script.src && script.textContent)
        .map((script, index) => {
          let content = script.textContent || '';
          const originalSize = content.length;
          let truncated = false;

          // 🔧 Limit single inline script size
          if (content.length > maxSingleSize) {
            content = content.substring(0, maxSingleSize);
            truncated = true;
          }

          return {
            url: `inline-script-${index}`,
            content,
            size: content.length,
            type: 'inline' as const,
            // Additional metadata
            metadata: {
              scriptType: script.type || 'text/javascript',
              async: script.async,
              defer: script.defer,
              integrity: script.integrity || undefined,
              truncated,
              originalSize: truncated ? originalSize : undefined,
            },
          };
        });
    }, this.MAX_SINGLE_FILE_SIZE);

    // 🔧 Limit inline script count
    const limitedScripts = scripts.slice(0, this.MAX_FILES_PER_COLLECT);

    if (scripts.length > limitedScripts.length) {
      logger.warn(`⚠️  Found ${scripts.length} inline scripts, limiting to ${this.MAX_FILES_PER_COLLECT}`);
    }

    const truncatedCount = limitedScripts.filter(s => s.metadata?.truncated).length;
    if (truncatedCount > 0) {
      logger.warn(`⚠️  ${truncatedCount} inline scripts were truncated due to size limits`);
    }

    logger.debug(`Collected ${limitedScripts.length} inline scripts`);
    return limitedScripts;
  }

  /**
   * Collect Service Worker scripts
   */
  private async collectServiceWorkers(page: Page): Promise<CodeFile[]> {
    try {
      const serviceWorkers = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) {
          return [];
        }

        const registrations = await navigator.serviceWorker.getRegistrations();
        const workers: Array<{ url: string; scope: string; state: string }> = [];

        for (const registration of registrations) {
          const worker = registration.active || registration.installing || registration.waiting;
          if (worker && worker.scriptURL) {
            workers.push({
              url: worker.scriptURL,
              scope: registration.scope,
              state: worker.state,
            });
          }
        }

        return workers;
      });

      const files: CodeFile[] = [];

      // ✅ Fix: use fetch instead of page.goto() to avoid disrupting page state
      for (const worker of serviceWorkers) {
        try {
          // Use fetch inside page.evaluate, executing in the page context
          const content = await page.evaluate(async (url) => {
            const response = await fetch(url);
            return await response.text();
          }, worker.url);

          if (content) {
            files.push({
              url: worker.url,
              content,
              size: content.length,
              type: 'service-worker',
            });
            logger.debug(`Collected Service Worker: ${worker.url}`);
          }
        } catch (error) {
          logger.warn(`Failed to collect Service Worker: ${worker.url}`, error);
        }
      }

      return files;
    } catch (error) {
      logger.warn('Service Worker collection failed', error);
      return [];
    }
  }

  /**
   * Collect Web Worker scripts
   */
  private async collectWebWorkers(page: Page): Promise<CodeFile[]> {
    try {
      // Inject interception code into the current page (not evaluateOnNewDocument, which only applies to subsequent navigations)
      await page.evaluate(() => {
        if ((window as any).__workerIntercepted) return;
        (window as any).__workerIntercepted = true;

        const originalWorker = (window as any).Worker;
        const workerUrls: string[] = (window as any).__workerUrls || [];
        (window as any).__workerUrls = workerUrls;

        (window as any).Worker = function (scriptURL: string, options?: WorkerOptions) {
          workerUrls.push(scriptURL);
          return new originalWorker(scriptURL, options);
        };
        // Maintain prototype chain
        (window as any).Worker.prototype = originalWorker.prototype;
      });

      // Get created Worker URLs (newly created after interception injection + cannot capture those created before injection)
      const workerUrls = (await page.evaluate(() => (window as any).__workerUrls || [])) as string[];

      const files: CodeFile[] = [];

      // ✅ Fix: use fetch instead of page.goto() to avoid disrupting page state
      for (const url of workerUrls) {
        try {
          // If relative path, convert to absolute path
          const absoluteUrl = new URL(url, page.url()).href;

          // Use fetch inside page.evaluate, executing in the page context
          const content = await page.evaluate(async (workerUrl) => {
            const response = await fetch(workerUrl);
            return await response.text();
          }, absoluteUrl);

          if (content) {
            files.push({
              url: absoluteUrl,
              content,
              size: content.length,
              type: 'web-worker',
            });
            logger.debug(`Collected Web Worker: ${absoluteUrl}`);
          }
        } catch (error) {
          logger.warn(`Failed to collect Web Worker: ${url}`, error);
        }
      }

      return files;
    } catch (error) {
      logger.warn('Web Worker collection failed', error);
      return [];
    }
  }

  /**
   * Analyze file dependencies
   */
  private analyzeDependencies(files: CodeFile[]): DependencyGraph {
    const nodes: DependencyGraph['nodes'] = [];
    const edges: DependencyGraph['edges'] = [];

    // Create a node for each file
    files.forEach((file) => {
      nodes.push({
        id: file.url,
        url: file.url,
        type: file.type,
      });
    });

    // Analyze import/require dependencies
    files.forEach((file) => {
      const dependencies = this.extractDependencies(file.content);

      dependencies.forEach((dep) => {
        // Try to match to an actual file
        const targetFile = files.find((f) =>
          f.url.includes(dep) || f.url.endsWith(dep) || f.url.endsWith(`${dep}.js`)
        );

        if (targetFile) {
          edges.push({
            from: file.url,
            to: targetFile.url,
            type: 'import',
          });
        }
      });
    });

    logger.debug(`Dependency graph: ${nodes.length} nodes, ${edges.length} edges`);
    return { nodes, edges };
  }

  /**
   * Extract dependencies from code
   */
  private extractDependencies(code: string): string[] {
    const dependencies: string[] = [];

    // ES6 import
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      if (match[1]) dependencies.push(match[1]);
    }

    // CommonJS require
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(code)) !== null) {
      if (match[1]) dependencies.push(match[1]);
    }

    // Dynamic import
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(code)) !== null) {
      if (match[1]) dependencies.push(match[1]);
    }

    return [...new Set(dependencies)]; // Deduplicate
  }

  /**
   * Check if a URL should be collected (filter rules)
   */
  shouldCollectUrl(url: string, filterRules?: string[]): boolean {
    if (!filterRules || filterRules.length === 0) {
      return true;
    }

    // Support simple wildcard matching
    for (const rule of filterRules) {
      const regex = new RegExp(rule.replace(/\*/g, '.*'));
      if (regex.test(url)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Page navigation with retry
   */
  async navigateWithRetry(
    page: Page,
    url: string,
    options: { waitUntil?: any; timeout?: number },
    maxRetries = 3
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await page.goto(url, options);
        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Navigation attempt ${i + 1}/${maxRetries} failed: ${error}`);
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    throw lastError || new Error('Navigation failed after retries');
  }

  /**
   * Get page performance metrics
   */
  async getPerformanceMetrics(page: Page): Promise<Record<string, number>> {
    try {
      const metrics = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
          loadComplete: perf.loadEventEnd - perf.loadEventStart,
          domInteractive: perf.domInteractive - perf.fetchStart,
          totalTime: perf.loadEventEnd - perf.fetchStart,
        };
      });
      return metrics;
    } catch (error) {
      logger.warn('Failed to get performance metrics', error);
      return {};
    }
  }

  /**
   * Collect page metadata
   */
  async collectPageMetadata(page: Page): Promise<Record<string, unknown>> {
    try {
      const metadata = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          cookies: document.cookie,
          localStorage: Object.keys(localStorage).length,
          sessionStorage: Object.keys(sessionStorage).length,
        };
      });
      return metadata;
    } catch (error) {
      logger.warn('Failed to collect page metadata', error);
      return {};
    }
  }

  /**
   * Get browser instance
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Get collection statistics
   */
  getCollectionStats(): {
    totalCollected: number;
    uniqueUrls: number;
  } {
    return {
      totalCollected: this.collectedUrls.size,
      uniqueUrls: this.collectedUrls.size,
    };
  }

  /**
   * Clear collection cache
   */
  clearCache(): void {
    this.collectedUrls.clear();
    logger.info('Collection cache cleared');
  }

  // ==================== 🆕 On-demand retrieval interface (supports large website reverse engineering) ====================

  /**
   * Get summary list of collected files (lightweight, without file content)
   *
   * 🎯 Purpose: return the file list first, letting AI decide which files are needed
   */
  getCollectedFilesSummary(): Array<{
    url: string;
    size: number;
    type: string;
    truncated?: boolean;
    originalSize?: number;
  }> {
    const summaries = Array.from(this.collectedFilesCache.values()).map(file => ({
      url: file.url,
      size: file.size,
      type: file.type,
      truncated: typeof file.metadata?.truncated === 'boolean' ? file.metadata.truncated : undefined,
      originalSize: typeof file.metadata?.originalSize === 'number' ? file.metadata.originalSize : undefined,
    }));

    logger.info(`📋 Returning summary of ${summaries.length} collected files`);
    return summaries;
  }

  /**
   * Get a single file's content by URL
   *
   * @param url File URL
   * @returns File content, or null if not found
   */
  getFileByUrl(url: string): CodeFile | null {
    const file = this.collectedFilesCache.get(url);
    if (file) {
      logger.info(`📄 Returning file: ${url} (${(file.size / 1024).toFixed(2)} KB)`);
      return file;
    }
    logger.warn(`⚠️  File not found: ${url}`);
    return null;
  }

  /**
   * Get files in batch by URL pattern
   *
   * @param pattern Regular expression pattern
   * @param limit Maximum number of results (default 20)
   * @param maxTotalSize Maximum total size (default 512KB, to prevent MCP token overflow)
   */
  getFilesByPattern(
    pattern: string,
    limit: number = 20,
    maxTotalSize: number = this.MAX_RESPONSE_SIZE
  ): {
    files: CodeFile[];
    totalSize: number;
    matched: number;
    returned: number;
    truncated: boolean;
  } {
    // ✅ Fix: add error handling to prevent crashes from invalid regular expressions
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (error) {
      logger.error(`Invalid regex pattern: ${pattern}`, error);
      return {
        files: [],
        totalSize: 0,
        matched: 0,
        returned: 0,
        truncated: false,
      };
    }

    const matched: CodeFile[] = [];

    // Find all matching files
    for (const file of this.collectedFilesCache.values()) {
      if (regex.test(file.url)) {
        matched.push(file);
      }
    }

    // Apply limits
    const returned: CodeFile[] = [];
    let totalSize = 0;
    let truncated = false;

    for (let i = 0; i < matched.length && i < limit; i++) {
      const file = matched[i];
      if (file && totalSize + file.size <= maxTotalSize) {
        returned.push(file);
        totalSize += file.size;
      } else {
        truncated = true;
        break;
      }
    }

    if (truncated || matched.length > limit) {
      logger.warn(`⚠️  Pattern "${pattern}" matched ${matched.length} files, returning ${returned.length} (limited by size/count)`);
    }

    logger.info(`🔍 Pattern "${pattern}": matched ${matched.length}, returning ${returned.length} files (${(totalSize / 1024).toFixed(2)} KB)`);

    return {
      files: returned,
      totalSize,
      matched: matched.length,
      returned: returned.length,
      truncated,
    };
  }

  /**
   * Get top N files by priority
   *
   * @param topN Return top N files (default 10)
   * @param maxTotalSize Maximum total size (default 512KB)
   */
  getTopPriorityFiles(
    topN: number = 10,
    maxTotalSize: number = this.MAX_RESPONSE_SIZE
  ): {
    files: CodeFile[];
    totalSize: number;
    totalFiles: number;
  } {
    const allFiles = Array.from(this.collectedFilesCache.values());

    // Calculate priority (reusing SmartCodeCollector's logic)
    const scoredFiles = allFiles.map(file => ({
      file,
      score: this.calculatePriorityScore(file),
    }));

    // Sort by score
    scoredFiles.sort((a, b) => b.score - a.score);

    // Select top N, but do not exceed total size limit
    const selected: CodeFile[] = [];
    let totalSize = 0;

    for (let i = 0; i < Math.min(topN, scoredFiles.length); i++) {
      const item = scoredFiles[i];
      if (item && item.file && totalSize + item.file.size <= maxTotalSize) {
        selected.push(item.file);
        totalSize += item.file.size;
      } else {
        break;
      }
    }

    logger.info(`⭐ Returning top ${selected.length}/${allFiles.length} priority files (${(totalSize / 1024).toFixed(2)} KB)`);

    return {
      files: selected,
      totalSize,
      totalFiles: allFiles.length,
    };
  }

  /**
   * Calculate file priority score (private method)
   */
  private calculatePriorityScore(file: CodeFile): number {
    let score = 0;

    // File type bonus
    if (file.type === 'inline') score += 10;
    else if (file.type === 'external') score += 5;

    // File size: smaller files first (more likely to be core logic)
    if (file.size < 10 * 1024) score += 15;      // < 10KB
    else if (file.size < 50 * 1024) score += 10; // < 50KB
    else if (file.size > 200 * 1024) score -= 10; // > 200KB

    // URL feature matching (keyword bonus)
    const url = file.url.toLowerCase();
    if (url.includes('main') || url.includes('index') || url.includes('app')) score += 20;
    if (url.includes('crypto') || url.includes('encrypt') || url.includes('sign')) score += 30;
    if (url.includes('api') || url.includes('request') || url.includes('ajax')) score += 25;
    if (url.includes('core') || url.includes('common') || url.includes('util')) score += 15;

    // Third-party library penalty
    if (url.includes('vendor') || url.includes('lib') || url.includes('jquery') || url.includes('react')) score -= 20;
    if (url.includes('node_modules') || url.includes('bundle')) score -= 30;

    return score;
  }

  /**
   * Clear collected files cache
   */
  clearCollectedFilesCache(): void {
    const count = this.collectedFilesCache.size;
    this.collectedFilesCache.clear();
    logger.info(`🧹 Cleared collected files cache (${count} files)`);
  }
}
