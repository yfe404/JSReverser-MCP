/**
 * BlackboxManager - Blackbox management
 *
 * Features:
 * 1. Blackbox scripts (by URL pattern)
 * 2. Automatically skip blackboxed code during step debugging
 * 3. Hide blackboxed frames in the call stack
 *
 * Design principles:
 * - Uses CDP Debugger.setBlackboxPatterns
 * - Provides predefined blackbox rules for common libraries
 * - Supports custom patterns
 */

import type { CDPSession } from 'puppeteer';
import { logger } from '../../utils/logger.js';

/**
 * Blackbox manager
 *
 * Refactored: uses shared CDP session instead of creating a separate session
 */
export class BlackboxManager {
  private blackboxedPatterns: Set<string> = new Set();

  // Predefined common library patterns (CDP Debugger.setBlackboxPatterns requires regular expressions)
  static readonly COMMON_LIBRARY_PATTERNS = [
    '.*jquery.*\\.js',
    '.*react.*\\.js',
    '.*react-dom.*\\.js',
    '.*vue.*\\.js',
    '.*angular.*\\.js',
    '.*lodash.*\\.js',
    '.*underscore.*\\.js',
    '.*moment.*\\.js',
    '.*axios.*\\.js',
    '.*node_modules/.*',
    '.*webpack.*',
    '.*bundle.*\\.js',
    '.*vendor.*\\.js',
  ];

  /**
   * @param cdpSession Shared CDP Session (provided by DebuggerManager)
   */
  constructor(private cdpSession: CDPSession) {
    logger.info('BlackboxManager initialized with shared CDP session');
  }

  /**
   * Blackbox a script (by URL pattern)
   *
   * @param urlPattern URL pattern (supports wildcard *)
   */
  async blackboxByPattern(urlPattern: string): Promise<void> {
    this.blackboxedPatterns.add(urlPattern);

    try {
      // Call CDP API to set blackbox patterns
      await this.cdpSession.send('Debugger.setBlackboxPatterns', {
        patterns: Array.from(this.blackboxedPatterns),
      });

      logger.info(`Blackboxed pattern: ${urlPattern}`);
    } catch (error) {
      logger.error('Failed to set blackbox pattern:', error);
      this.blackboxedPatterns.delete(urlPattern);
      throw error;
    }
  }

  /**
   * Remove blackboxing for a pattern
   */
  async unblackboxByPattern(urlPattern: string): Promise<boolean> {
    const deleted = this.blackboxedPatterns.delete(urlPattern);
    if (!deleted) {
      return false;
    }

    try {
      await this.cdpSession.send('Debugger.setBlackboxPatterns', {
        patterns: Array.from(this.blackboxedPatterns),
      });

      logger.info(`Unblackboxed pattern: ${urlPattern}`);
      return true;
    } catch (error) {
      logger.error('Failed to remove blackbox pattern:', error);
      this.blackboxedPatterns.add(urlPattern);
      throw error;
    }
  }

  /**
   * Blackbox all common libraries
   */
  async blackboxCommonLibraries(): Promise<void> {
    for (const pattern of BlackboxManager.COMMON_LIBRARY_PATTERNS) {
      this.blackboxedPatterns.add(pattern);
    }

    try {
      await this.cdpSession.send('Debugger.setBlackboxPatterns', {
        patterns: Array.from(this.blackboxedPatterns),
      });

      logger.info(`Blackboxed ${BlackboxManager.COMMON_LIBRARY_PATTERNS.length} common library patterns`);
    } catch (error) {
      logger.error('Failed to blackbox common libraries:', error);
      throw error;
    }
  }

  /**
   * Get all blackboxed patterns
   */
  getAllBlackboxedPatterns(): string[] {
    return Array.from(this.blackboxedPatterns);
  }

  /**
   * Clear all blackboxed patterns
   */
  async clearAllBlackboxedPatterns(): Promise<void> {
    this.blackboxedPatterns.clear();

    try {
      await this.cdpSession.send('Debugger.setBlackboxPatterns', {
        patterns: [],
      });

      logger.info('All blackbox patterns cleared');
    } catch (error) {
      logger.error('Failed to clear blackbox patterns:', error);
      throw error;
    }
  }

  /**
   * Close and clean up resources
   */
  async close(): Promise<void> {
    try {
      await this.clearAllBlackboxedPatterns();
      logger.info('BlackboxManager closed');
    } catch (error) {
      logger.error('Failed to close BlackboxManager:', error);
      throw error;
    }
  }
}

