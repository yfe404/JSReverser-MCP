/**
 * TokenBudgetManager - Global Token Budget Manager
 *
 * Core features:
 * 1. Track token usage for each tool call
 * 2. Maintain session-level token accumulation
 * 3. Provide three-tier warning mechanism (80%, 90%, 95%)
 * 4. Auto-trigger data cleanup
 * 5. Provide smart optimization suggestions
 *
 * Design principles:
 * - Singleton pattern - single global instance
 * - Real-time monitoring - update after each tool call
 * - Proactive warnings - don't wait for overflow errors
 * - Auto cleanup - triggered at 90%
 */

import { logger } from './logger.js';
import { DetailedDataManager } from './detailedDataManager.js';
import { safeStringify } from './safeJson.js';

/**
 * Tool call record
 */
export interface ToolCallRecord {
  toolName: string;
  timestamp: number;
  requestSize: number;
  responseSize: number;
  estimatedTokens: number;
  cumulativeTokens: number;
}

/**
 * Token budget statistics
 */
export interface TokenBudgetStats {
  currentUsage: number;
  maxTokens: number;
  usagePercentage: number;
  toolCallCount: number;
  topTools: Array<{ tool: string; tokens: number; percentage: number }>;
  warnings: number[];
  recentCalls: ToolCallRecord[];
  suggestions: string[];
}

/**
 * Global Token Budget Manager
 */
export class TokenBudgetManager {
  private static instance: TokenBudgetManager;

  // ==================== Configuration ====================

  private readonly MAX_TOKENS = 200000; // Claude context window
  private readonly WARNING_THRESHOLDS = [0.8, 0.9, 0.95]; // Warning thresholds
  private readonly BYTES_PER_TOKEN = 4; // 1 token ~ 4 bytes (empirical value)
  private readonly AUTO_CLEANUP_THRESHOLD = 0.9; // Auto cleanup threshold
  private readonly HISTORY_RETENTION = 5 * 60 * 1000; // Retain last 5 minutes of history

  // ==================== State ====================

  private currentUsage = 0; // Current token usage
  private toolCallHistory: ToolCallRecord[] = []; // Tool call history
  private warnings = new Set<number>(); // Triggered warnings
  private sessionStartTime = Date.now(); // Session start time

  // ==================== Singleton ====================

  private constructor() {
    logger.info('TokenBudgetManager initialized');
  }

  static getInstance(): TokenBudgetManager {
    if (!this.instance) {
      this.instance = new TokenBudgetManager();
    }
    return this.instance;
  }

  // ==================== Core features ====================

  /**
   * Record a tool call
   *
   * @param toolName Tool name
   * @param request Request parameters
   * @param response Response data
   */
  recordToolCall(toolName: string, request: any, response: any): void {
    try {
      // Calculate size
      const requestSize = this.calculateSize(request);
      const responseSize = this.calculateSize(response);
      const totalSize = requestSize + responseSize;
      const estimatedTokens = this.estimateTokens(totalSize);

      // Accumulate usage
      this.currentUsage += estimatedTokens;

      // Record history
      const record: ToolCallRecord = {
        toolName,
        timestamp: Date.now(),
        requestSize,
        responseSize,
        estimatedTokens,
        cumulativeTokens: this.currentUsage,
      };
      this.toolCallHistory.push(record);

      // Log
      logger.debug(
        `Token usage: ${this.currentUsage}/${this.MAX_TOKENS} (${this.getUsagePercentage()}%) | ` +
        `Tool: ${toolName} | Size: ${(totalSize / 1024).toFixed(1)}KB | Tokens: ${estimatedTokens}`
      );

      // Check warnings
      this.checkWarnings();

      // Auto cleanup
      if (this.shouldAutoCleanup()) {
        this.autoCleanup();
      }
    } catch (error) {
      logger.error('Failed to record tool call:', error);
    }
  }

  /**
   * Calculate data size (bytes)
   */
  private calculateSize(data: any): number {
    try {
      return safeStringify(data).length;
    } catch (error) {
      logger.warn('Failed to calculate data size:', error);
      return 0;
    }
  }

  /**
   * Estimate token count
   *
   * Empirical formula: 1 token ~ 4 bytes
   * This is a conservative estimate; actual count may be lower
   */
  private estimateTokens(bytes: number): number {
    return Math.ceil(bytes / this.BYTES_PER_TOKEN);
  }

  /**
   * Get usage percentage
   */
  getUsagePercentage(): number {
    return Math.round((this.currentUsage / this.MAX_TOKENS) * 100);
  }

  /**
   * Check warnings
   */
  private checkWarnings(): void {
    const ratio = this.currentUsage / this.MAX_TOKENS;

    for (const threshold of this.WARNING_THRESHOLDS) {
      if (ratio >= threshold && !this.warnings.has(threshold)) {
        this.emitWarning(threshold);
        this.warnings.add(threshold);
      }
    }
  }

  /**
   * Emit warning
   */
  private emitWarning(threshold: number): void {
    const percentage = Math.round(threshold * 100);
    const remaining = this.MAX_TOKENS - this.currentUsage;

    logger.warn(
      `⚠️  Token Budget Warning: ${percentage}% used! ` +
      `(${this.currentUsage}/${this.MAX_TOKENS}, ${remaining} tokens remaining)`
    );

    // Provide suggestions
    if (threshold >= 0.95) {
      logger.warn('🚨 CRITICAL: Consider clearing caches or starting a new session!');
    } else if (threshold >= 0.9) {
      logger.warn('⚠️  HIGH: Auto-cleanup will trigger soon. Consider using summary modes.');
    } else if (threshold >= 0.8) {
      logger.warn('ℹ️  MODERATE: Monitor usage. Use get_token_budget_stats for details.');
    }
  }

  /**
   * Whether auto cleanup should be triggered
   */
  private shouldAutoCleanup(): boolean {
    const ratio = this.currentUsage / this.MAX_TOKENS;
    return ratio >= this.AUTO_CLEANUP_THRESHOLD;
  }

  /**
   * Auto cleanup
   */
  private autoCleanup(): void {
    logger.info('🧹 Auto-cleanup triggered at 90% usage...');

    const beforeUsage = this.currentUsage;

    // 1. Clear DetailedDataManager
    const detailedDataManager = DetailedDataManager.getInstance();
    detailedDataManager.clear();
    logger.info('✅ Cleared DetailedDataManager cache');

    // 2. Clean old tool call records (retain last 5 minutes)
    const cutoff = Date.now() - this.HISTORY_RETENTION;
    const beforeCount = this.toolCallHistory.length;
    this.toolCallHistory = this.toolCallHistory.filter(
      call => call.timestamp > cutoff
    );
    const removedCount = beforeCount - this.toolCallHistory.length;
    logger.info(`✅ Removed ${removedCount} old tool call records`);

    // 3. Recalculate usage
    this.recalculateUsage();

    const afterUsage = this.currentUsage;
    const freed = beforeUsage - afterUsage;
    const freedPercentage = Math.round((freed / this.MAX_TOKENS) * 100);

    logger.info(
      `✅ Cleanup complete! Freed ${freed} tokens (${freedPercentage}%). ` +
      `Usage: ${afterUsage}/${this.MAX_TOKENS} (${this.getUsagePercentage()}%)`
    );

    // Reset warnings (if usage decreased)
    const newRatio = afterUsage / this.MAX_TOKENS;
    this.warnings = new Set(
      Array.from(this.warnings).filter(threshold => newRatio >= threshold)
    );
  }

  /**
   * Recalculate usage
   */
  private recalculateUsage(): void {
    this.currentUsage = this.toolCallHistory.reduce(
      (sum, call) => sum + call.estimatedTokens,
      0
    );
  }

  /**
   * Get statistics
   */
  getStats(): TokenBudgetStats & { sessionStartTime: number } {
    // Calculate usage per tool
    const toolUsage = new Map<string, number>();
    for (const call of this.toolCallHistory) {
      const current = toolUsage.get(call.toolName) || 0;
      toolUsage.set(call.toolName, current + call.estimatedTokens);
    }

    // Sort and take top 10
    const topTools = Array.from(toolUsage.entries())
      .map(([tool, tokens]) => ({
        tool,
        tokens,
        percentage: Math.round((tokens / this.currentUsage) * 100),
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);

    // Generate suggestions
    const suggestions = this.generateSuggestions(topTools);

    // Recent calls (up to 20)
    const recentCalls = this.toolCallHistory.slice(-20);

    return {
      currentUsage: this.currentUsage,
      maxTokens: this.MAX_TOKENS,
      usagePercentage: this.getUsagePercentage(),
      toolCallCount: this.toolCallHistory.length,
      topTools,
      warnings: Array.from(this.warnings).map(t => Math.round(t * 100)),
      recentCalls,
      suggestions,
      sessionStartTime: this.sessionStartTime,
    };
  }

  /**
   * Generate optimization suggestions
   */
  private generateSuggestions(topTools: Array<{ tool: string; tokens: number; percentage: number }>): string[] {
    const suggestions: string[] = [];
    const ratio = this.currentUsage / this.MAX_TOKENS;

    // Usage-based suggestions
    if (ratio >= 0.95) {
      suggestions.push('🚨 CRITICAL: Clear all caches immediately or start a new session');
    } else if (ratio >= 0.9) {
      suggestions.push('⚠️  HIGH: Auto-cleanup triggered. Consider manual cleanup for better control');
    } else if (ratio >= 0.8) {
      suggestions.push('ℹ️  MODERATE: Monitor usage closely. Use summary modes for large data');
    }

    // Tool usage-based suggestions
    for (const { tool, percentage } of topTools) {
      if (percentage > 30) {
        if (tool.includes('collect_code')) {
          suggestions.push(`💡 ${tool} uses ${percentage}% tokens. Try smartMode="summary" or "priority"`);
        } else if (tool.includes('get_script_source')) {
          suggestions.push(`💡 ${tool} uses ${percentage}% tokens. Try preview=true first`);
        } else if (tool.includes('network_get_requests')) {
          suggestions.push(`💡 ${tool} uses ${percentage}% tokens. Reduce limit or use filters`);
        } else if (tool.includes('page_evaluate')) {
          suggestions.push(`💡 ${tool} uses ${percentage}% tokens. Query specific properties instead of full objects`);
        }
      }
    }

    // General suggestions
    if (suggestions.length === 0) {
      suggestions.push('✅ Token usage is healthy. Continue monitoring.');
    }

    return suggestions;
  }

  /**
   * Manual cleanup
   */
  manualCleanup(): void {
    logger.info('🧹 Manual cleanup requested...');
    this.autoCleanup();
  }

  /**
   * Reset session
   */
  reset(): void {
    logger.info('🔄 Resetting token budget...');
    this.currentUsage = 0;
    this.toolCallHistory = [];
    this.warnings.clear();
    this.sessionStartTime = Date.now();
    logger.info('✅ Token budget reset complete');
  }
}

