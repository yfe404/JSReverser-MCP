/**
 * Smart code collector - solves the token overflow problem
 *
 * Core strategies:
 * 1. Batch collection - returns code in batches by priority
 * 2. Smart filtering - only collects key code (encryption, API calls, etc.)
 * 3. Summary mode - returns code summaries instead of full content
 * 4. Incremental collection - supports fetching specific files on demand
 */

import type { Page } from 'puppeteer';
import { logger } from '../../utils/logger.js';
import type { CodeFile } from '../../types/index.js';

export interface SmartCollectOptions {
  mode: 'summary' | 'priority' | 'incremental' | 'full';
  maxTotalSize?: number; // Maximum total size (bytes)
  maxFileSize?: number; // Maximum size per file
  priorities?: string[]; // Priority URL patterns (regex)
  includePatterns?: string[]; // Include patterns
  excludePatterns?: string[]; // Exclude patterns
}

export interface CodeSummary {
  url: string;
  size: number;
  type: string;
  hasEncryption: boolean; // Whether it contains encryption-related code
  hasAPI: boolean; // Whether it contains API calls
  hasObfuscation: boolean; // Whether it is obfuscated
  functions: string[]; // Main function list
  imports: string[]; // Imported modules
  preview: string; // First 100 lines preview
}

export class SmartCodeCollector {
  // Fix: lowered default limits to prevent MCP token overflow
  // MCP typically limits to 200K tokens ~ 800KB-1MB text
  private readonly DEFAULT_MAX_TOTAL_SIZE = 512 * 1024;  // 512KB (was 2MB)
  private readonly DEFAULT_MAX_FILE_SIZE = 100 * 1024;   // 100KB (was 500KB)
  private readonly PREVIEW_LINES = 50;  // 50 lines (was 100 lines)

  /**
   * Smart code collection
   */
  async smartCollect(
    _page: Page, // Reserved for future dynamic analysis
    files: CodeFile[],
    options: SmartCollectOptions
  ): Promise<CodeFile[] | CodeSummary[]> {
    logger.info(`Smart code collection mode: ${options.mode}`);

    switch (options.mode) {
      case 'summary':
        return this.collectSummaries(files);
      
      case 'priority':
        return this.collectByPriority(files, options);
      
      case 'incremental':
        return this.collectIncremental(files, options);
      
      case 'full':
      default:
        return this.collectWithLimit(files, options);
    }
  }

  /**
   * Mode 1: Summary mode - returns only code summaries, not full content
   */
  private async collectSummaries(files: CodeFile[]): Promise<CodeSummary[]> {
    logger.info('Generating code summaries...');

    return files.map(file => {
      const lines = file.content.split('\n');
      const preview = lines.slice(0, this.PREVIEW_LINES).join('\n');

      return {
        url: file.url,
        size: file.size,
        type: file.type,
        hasEncryption: this.detectEncryption(file.content),
        hasAPI: this.detectAPI(file.content),
        hasObfuscation: this.detectObfuscation(file.content),
        functions: this.extractFunctions(file.content),
        imports: this.extractImports(file.content),
        preview,
      };
    });
  }

  /**
   * Mode 2: Priority mode - collects by priority, returns key code first
   */
  private collectByPriority(
    files: CodeFile[],
    options: SmartCollectOptions
  ): CodeFile[] {
    const maxTotalSize = options.maxTotalSize || this.DEFAULT_MAX_TOTAL_SIZE;
    const maxFileSize = options.maxFileSize || this.DEFAULT_MAX_FILE_SIZE;

    // Calculate priority score for each file
    const scoredFiles = files.map(file => ({
      file,
      score: this.calculatePriority(file, options.priorities || []),
    }));

    // Sort by score
    scoredFiles.sort((a, b) => b.score - a.score);

    // Collect files until size limit is reached
    const result: CodeFile[] = [];
    let currentSize = 0;

    for (const { file } of scoredFiles) {
      let content = file.content;
      let truncated = false;

      // Truncate oversized files
      if (file.size > maxFileSize) {
        content = content.substring(0, maxFileSize);
        truncated = true;
      }

      // Check if total size limit is exceeded
      if (currentSize + content.length > maxTotalSize) {
        logger.warn(`Reached max total size limit (${maxTotalSize} bytes), stopping collection`);
        break;
      }

      result.push({
        ...file,
        content,
        size: content.length,
        metadata: {
          ...file.metadata,
          truncated,
          originalSize: file.size,
          priorityScore: this.calculatePriority(file, options.priorities || []),
        },
      });

      currentSize += content.length;
    }

    logger.info(`Collected ${result.length}/${files.length} files by priority (${(currentSize / 1024).toFixed(2)} KB)`);
    return result;
  }

  /**
   * Mode 3: Incremental mode - only collects files matching patterns
   */
  private collectIncremental(
    files: CodeFile[],
    options: SmartCollectOptions
  ): CodeFile[] {
    const includePatterns = options.includePatterns || [];
    const excludePatterns = options.excludePatterns || [];

    const filtered = files.filter(file => {
      // Check exclude patterns
      if (excludePatterns.some(pattern => new RegExp(pattern).test(file.url))) {
        return false;
      }

      // Check include patterns
      if (includePatterns.length === 0) {
        return true;
      }

      return includePatterns.some(pattern => new RegExp(pattern).test(file.url));
    });

    logger.info(`Incremental collection: ${filtered.length}/${files.length} files matched`);
    return this.collectWithLimit(filtered, options);
  }

  /**
   * Mode 4: Limited mode - applies size limits
   */
  private collectWithLimit(
    files: CodeFile[],
    options: SmartCollectOptions
  ): CodeFile[] {
    const maxTotalSize = options.maxTotalSize || this.DEFAULT_MAX_TOTAL_SIZE;
    const maxFileSize = options.maxFileSize || this.DEFAULT_MAX_FILE_SIZE;

    const result: CodeFile[] = [];
    let currentSize = 0;

    for (const file of files) {
      let content = file.content;
      let truncated = false;

      // Truncate oversized files
      if (file.size > maxFileSize) {
        content = content.substring(0, maxFileSize);
        truncated = true;
      }

      // Check total size limit
      if (currentSize + content.length > maxTotalSize) {
        logger.warn(`Reached max total size limit, collected ${result.length}/${files.length} files`);
        break;
      }

      result.push({
        ...file,
        content,
        size: content.length,
        metadata: {
          ...file.metadata,
          truncated,
          originalSize: file.size,
        },
      });

      currentSize += content.length;
    }

    return result;
  }

  /**
   * Calculate file priority score
   */
  private calculatePriority(file: CodeFile, priorities: string[]): number {
    let score = 0;

    // Base score: file type
    if (file.type === 'inline') score += 10;
    if (file.type === 'external') score += 5;

    // URL matching priority patterns
    for (let i = 0; i < priorities.length; i++) {
      const pattern = priorities[i];
      if (pattern && new RegExp(pattern).test(file.url)) {
        score += (priorities.length - i) * 20; // Earlier patterns have higher priority
      }
    }

    // Content feature bonus
    if (this.detectEncryption(file.content)) score += 50;
    if (this.detectAPI(file.content)) score += 30;
    if (this.detectObfuscation(file.content)) score += 20;

    // File size penalty (smaller files preferred)
    if (file.size < 10 * 1024) score += 10; // < 10KB
    else if (file.size > 500 * 1024) score -= 20; // > 500KB

    return score;
  }

  /**
   * Detect if content contains encryption-related code
   */
  private detectEncryption(content: string): boolean {
    const patterns = [
      /crypto|encrypt|decrypt|cipher|aes|rsa|md5|sha/i,
      /CryptoJS|forge|sjcl/i,
      /btoa|atob/i,
    ];

    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect if content contains API calls
   */
  private detectAPI(content: string): boolean {
    const patterns = [
      /fetch\s*\(/,
      /XMLHttpRequest/,
      /axios|request|ajax/i,
      /\.get\(|\.post\(/,
    ];

    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect if content is obfuscated
   */
  private detectObfuscation(content: string): boolean {
    // Simple obfuscation detection
    const lines = content.split('\n');
    const avgLineLength = content.length / lines.length;

    // Excessively long average line length may indicate obfuscation
    if (avgLineLength > 200) return true;

    // Check common obfuscation characteristics
    if (/\\x[0-9a-f]{2}/i.test(content)) return true; // Hex encoding
    if (/\\u[0-9a-f]{4}/i.test(content)) return true; // Unicode encoding
    if (/eval\s*\(/i.test(content)) return true; // eval calls

    return false;
  }

  /**
   * Extract function name list
   */
  private extractFunctions(content: string): string[] {
    const functions: string[] = [];
    const patterns = [
      /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function/g,
      /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*function/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && !functions.includes(match[1])) {
          functions.push(match[1]);
        }
      }
    }

    return functions.slice(0, 20); // Return at most 20
  }

  /**
   * Extract imported module list
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const patterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && !imports.includes(match[1])) {
          imports.push(match[1]);
        }
      }
    }

    return imports;
  }
}

