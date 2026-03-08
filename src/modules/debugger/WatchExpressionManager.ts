/**
 * WatchExpressionManager - Watch expression management
 *
 * Features:
 * 1. Add/remove/enable/disable watch expressions
 * 2. Automatically evaluate all watch expressions on each pause
 * 3. Track expression value change history
 *
 * Design principles:
 * - Relies on RuntimeInspector for expression evaluation
 * - Automatically evaluates on breakpoint pause
 * - Provides value change detection
 */

import type { RuntimeInspector } from './RuntimeInspector.js';
import { logger } from '../../utils/logger.js';

/**
 * Watch expression
 */
export interface WatchExpression {
  id: string;
  expression: string;
  name: string;
  enabled: boolean;
  lastValue: any;
  lastError: Error | null;
  valueHistory: Array<{ value: any; timestamp: number }>;
  createdAt: number;
}

/**
 * Watch expression evaluation result
 */
export interface WatchResult {
  watchId: string;
  name: string;
  expression: string;
  value: any;
  error: Error | null;
  valueChanged: boolean;
  timestamp: number;
}

/**
 * Watch expression manager
 */
export class WatchExpressionManager {
  private watches: Map<string, WatchExpression> = new Map();
  private watchCounter = 0;

  constructor(private runtimeInspector: RuntimeInspector) {}

  /**
   * Add a watch expression
   */
  addWatch(expression: string, name?: string): string {
    const watchId = `watch_${++this.watchCounter}`;
    
    this.watches.set(watchId, {
      id: watchId,
      expression,
      name: name || expression,
      enabled: true,
      lastValue: undefined,
      lastError: null,
      valueHistory: [],
      createdAt: Date.now(),
    });

    logger.info(`Watch expression added: ${watchId}`, { expression, name });
    return watchId;
  }

  /**
   * Remove a watch expression
   */
  removeWatch(watchId: string): boolean {
    const deleted = this.watches.delete(watchId);
    if (deleted) {
      logger.info(`Watch expression removed: ${watchId}`);
    }
    return deleted;
  }

  /**
   * Enable/disable a watch expression
   */
  setWatchEnabled(watchId: string, enabled: boolean): boolean {
    const watch = this.watches.get(watchId);
    if (!watch) return false;

    watch.enabled = enabled;
    logger.info(`Watch expression ${enabled ? 'enabled' : 'disabled'}: ${watchId}`);
    return true;
  }

  /**
   * Get all watch expressions
   */
  getAllWatches(): WatchExpression[] {
    return Array.from(this.watches.values());
  }

  /**
   * Get a specific watch expression
   */
  getWatch(watchId: string): WatchExpression | undefined {
    return this.watches.get(watchId);
  }

  /**
   * Evaluate all enabled watch expressions
   *
   * @param callFrameId Optional call frame ID (used when paused at a breakpoint)
   * @param timeout Timeout per expression in milliseconds (default 5000ms)
   */
  async evaluateAll(callFrameId?: string, timeout = 5000): Promise<WatchResult[]> {
    const results: WatchResult[] = [];

    for (const watch of this.watches.values()) {
      if (!watch.enabled) continue;

      try {
        // Fix: add timeout control to prevent expression evaluation from hanging, and clean up timers
        let timeoutId: NodeJS.Timeout | null = null;
        const value = await Promise.race([
          this.runtimeInspector.evaluate(watch.expression, callFrameId),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Evaluation timeout after ${timeout}ms`)), timeout);
          }),
        ]).finally(() => {
          // Clean up timer to prevent memory leaks
          if (timeoutId) clearTimeout(timeoutId);
        });

        // Detect if the value has changed
        const valueChanged = !this.deepEqual(value, watch.lastValue);

        // Update history
        if (valueChanged) {
          watch.valueHistory.push({
            value,
            timestamp: Date.now(),
          });

          // Limit history size (keep at most 100 entries)
          if (watch.valueHistory.length > 100) {
            watch.valueHistory.shift();
          }
        }

        // Update last value and error
        watch.lastValue = value;
        watch.lastError = null;

        results.push({
          watchId: watch.id,
          name: watch.name,
          expression: watch.expression,
          value,
          error: null,
          valueChanged,
          timestamp: Date.now(),
        });
      } catch (error) {
        watch.lastError = error as Error;

        results.push({
          watchId: watch.id,
          name: watch.name,
          expression: watch.expression,
          value: null,
          error: error as Error,
          valueChanged: false,
          timestamp: Date.now(),
        });
      }
    }

    return results;
  }

  /**
   * Clear all watch expressions
   */
  clearAll(): void {
    this.watches.clear();
    logger.info('All watch expressions cleared');
  }

  /**
   * Get the value change history of a watch expression
   */
  getValueHistory(watchId: string): Array<{ value: any; timestamp: number }> | null {
    const watch = this.watches.get(watchId);
    return watch ? watch.valueHistory : null;
  }

  /**
   * Deep equality comparison of two values
   *
   * Fix: added circular reference detection, depth limit, array handling
   */
  private deepEqual(a: any, b: any, depth = 0, maxDepth = 10, seen = new WeakSet()): boolean {
    // Primitive types and reference equality
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    // Depth limit (prevent deeply nested structures)
    if (depth > maxDepth) {
      return false;
    }

    // Circular reference detection
    if (seen.has(a) || seen.has(b)) {
      return false;
    }
    seen.add(a);
    seen.add(b);

    // Array handling
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i], depth + 1, maxDepth, seen)) return false;
      }
      return true;
    }

    // Object handling
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(a[key], b[key], depth + 1, maxDepth, seen)) return false;
    }

    return true;
  }

  /**
   * Export watch expression configuration
   */
  exportWatches(): Array<{ expression: string; name: string; enabled: boolean }> {
    return Array.from(this.watches.values()).map(watch => ({
      expression: watch.expression,
      name: watch.name,
      enabled: watch.enabled,
    }));
  }

  /**
   * Import watch expression configuration
   */
  importWatches(watches: Array<{ expression: string; name?: string; enabled?: boolean }>): void {
    for (const watch of watches) {
      const watchId = this.addWatch(watch.expression, watch.name);
      if (watch.enabled === false) {
        this.setWatchEnabled(watchId, false);
      }
    }
    logger.info(`Imported ${watches.length} watch expressions`);
  }
}

