/**
 * DebuggerManager - Core debugger management
 *
 * Features:
 * 1. Breakpoint management (set, remove, list, conditional breakpoints)
 * 2. Execution control (pause, resume, step execution)
 * 3. Debug state management (paused state, call frames)
 *
 * Design principles:
 * - Thin wrapper around CDP Debugger domain, directly calling CDP API
 * - Relies on CodeCollector to obtain CDP session
 * - Maintains breakpoint and paused state mappings
 */

import type { CDPSession } from 'puppeteer';
import type { CodeCollector } from '../collector/CodeCollector.js';
import { logger } from '../../utils/logger.js';
import type {
  ScopeVariable,
  BreakpointHitCallback,
  BreakpointHitEvent,
  DebuggerSession,
  GetScopeVariablesOptions,
  GetScopeVariablesResult,
} from '../../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WatchExpressionManager } from './WatchExpressionManager.js';
import { XHRBreakpointManager } from './XHRBreakpointManager.js';
import { EventBreakpointManager } from './EventBreakpointManager.js';
import { BlackboxManager } from './BlackboxManager.js';
import { resolveDefaultDebuggerSessionsDir } from '../../utils/projectPaths.js';

/**
 * Breakpoint information
 */
export interface BreakpointInfo {
  breakpointId: string;
  location: {
    scriptId?: string;
    url?: string;
    lineNumber: number;
    columnNumber?: number;
  };
  condition?: string;
  enabled: boolean;
  hitCount: number;
  createdAt: number;
}

/**
 * Paused state
 */
export interface PausedState {
  callFrames: CallFrame[];
  reason: string;
  data?: any;
  hitBreakpoints?: string[];
  timestamp: number;
}

/**
 * Call frame
 */
export interface CallFrame {
  callFrameId: string;
  functionName: string;
  location: {
    scriptId: string;
    lineNumber: number;
    columnNumber: number;
  };
  url: string;
  scopeChain: Scope[];
  this: any;
}

/**
 * Scope
 */
export interface Scope {
  type: 'global' | 'local' | 'with' | 'closure' | 'catch' | 'block' | 'script' | 'eval' | 'module';
  object: {
    type: string;
    objectId?: string;
    className?: string;
    description?: string;
  };
  name?: string;
  startLocation?: { scriptId: string; lineNumber: number; columnNumber: number };
  endLocation?: { scriptId: string; lineNumber: number; columnNumber: number };
}

/**
 * Debugger manager
 */
export class DebuggerManager {
  private cdpSession: CDPSession | null = null;
  private enabled = false;

  // Breakpoint management
  private breakpoints: Map<string, BreakpointInfo> = new Map();

  // Paused state
  private pausedState: PausedState | null = null;
  private pausedResolvers: Array<(state: PausedState) => void> = [];

  // Breakpoint hit callbacks
  private breakpointHitCallbacks: Set<BreakpointHitCallback> = new Set();

  // Exception breakpoint state
  private pauseOnExceptionsState: 'none' | 'uncaught' | 'all' = 'none';

  // Sub-managers (lazy initialization)
  private _watchManager: WatchExpressionManager | null = null;
  private _xhrManager: XHRBreakpointManager | null = null;
  private _eventManager: EventBreakpointManager | null = null;
  private _blackboxManager: BlackboxManager | null = null;

  // Event listener references (for cleanup)
  private pausedListener: ((params: any) => void) | null = null;
  private resumedListener: (() => void) | null = null;
  private breakpointResolvedListener: ((params: any) => void) | null = null;

  constructor(private collector: CodeCollector) {}

  private getDefaultSessionsDir(): string {
    return resolveDefaultDebuggerSessionsDir(import.meta.url);
  }

  /**
   * Get the shared CDP Session (for use by sub-managers)
   *
   * Design principle: All sub-managers should share the same CDP session to avoid resource waste
   */
  getCDPSession(): CDPSession {
    if (!this.cdpSession || !this.enabled) {
      throw new Error('Debugger not enabled. Call init() or enable() first to get CDP session.');
    }
    return this.cdpSession;
  }

  /**
   * Get Watch Expression Manager (lazy initialization)
   */
  getWatchManager(): WatchExpressionManager {
    if (!this._watchManager) {
      throw new Error('WatchExpressionManager not initialized. Call initAdvancedFeatures() first.');
    }
    return this._watchManager;
  }

  /**
   * Get XHR Breakpoint Manager (lazy initialization)
   */
  getXHRManager(): XHRBreakpointManager {
    if (!this._xhrManager) {
      throw new Error('XHRBreakpointManager not initialized. Call initAdvancedFeatures() first.');
    }
    return this._xhrManager;
  }

  /**
   * Get Event Breakpoint Manager (lazy initialization)
   */
  getEventManager(): EventBreakpointManager {
    if (!this._eventManager) {
      throw new Error('EventBreakpointManager not initialized. Call initAdvancedFeatures() first.');
    }
    return this._eventManager;
  }

  /**
   * Get Blackbox Manager (lazy initialization)
   */
  getBlackboxManager(): BlackboxManager {
    if (!this._blackboxManager) {
      throw new Error('BlackboxManager not initialized. Call initAdvancedFeatures() first.');
    }
    return this._blackboxManager;
  }

  /**
   * Initialize the debugger (enable CDP Debugger domain)
   */
  async init(): Promise<void> {
    if (this.enabled) {
      logger.warn('Debugger already enabled');
      return;
    }

    try {
      const page = await this.collector.getActivePage();
      // Fix: Use new API to avoid deprecation warnings
      this.cdpSession = await page.createCDPSession();

      // Enable Debugger domain
      await this.cdpSession.send('Debugger.enable');
      this.enabled = true;

      // Create event listener references
      this.pausedListener = (params: any) => this.handlePaused(params);
      this.resumedListener = () => this.handleResumed();
      this.breakpointResolvedListener = (params: any) => this.handleBreakpointResolved(params);

      // Listen for paused events
      this.cdpSession.on('Debugger.paused', this.pausedListener);

      // Listen for resumed events
      this.cdpSession.on('Debugger.resumed', this.resumedListener);

      // Listen for breakpoint resolved events
      this.cdpSession.on('Debugger.breakpointResolved', this.breakpointResolvedListener);

      logger.info('Debugger enabled successfully');
    } catch (error) {
      logger.error('Failed to enable debugger:', error);
      throw error;
    }
  }

  /**
   * Enable debugger (alias method, consistent with other modules)
   */
  async enable(): Promise<void> {
    return this.init();
  }

  /**
   * Initialize advanced features (Watch, XHR, Event, Blackbox)
   *
   * Note: Must be called after init()
   *
   * @param runtimeInspector RuntimeInspector instance (for WatchExpressionManager)
   */
  async initAdvancedFeatures(runtimeInspector?: any): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger must be enabled before initializing advanced features. Call init() first.');
    }

    try {
      // Fix: If runtimeInspector is provided, initialize Watch Expression Manager
      if (runtimeInspector) {
        this._watchManager = new WatchExpressionManager(runtimeInspector);
        logger.info('WatchExpressionManager initialized');
      }

      // Fix: Pass shared CDP session instead of collector
      // Sub-managers will directly use DebuggerManager's session to avoid duplicate creation
      this._xhrManager = new XHRBreakpointManager(this.cdpSession);
      logger.info('XHRBreakpointManager initialized');

      this._eventManager = new EventBreakpointManager(this.cdpSession);
      logger.info('EventBreakpointManager initialized');

      this._blackboxManager = new BlackboxManager(this.cdpSession);
      logger.info('BlackboxManager initialized');

      logger.info('All advanced debugging features initialized');
    } catch (error) {
      logger.error('Failed to initialize advanced features:', error);
      throw error;
    }
  }

  /**
   * Disable the debugger
   */
  async disable(): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      logger.warn('Debugger not enabled');
      return;
    }

    try {
      // Fix: Clean up sub-managers first
      if (this._xhrManager) {
        await this._xhrManager.close();
        this._xhrManager = null;
      }

      if (this._eventManager) {
        await this._eventManager.close();
        this._eventManager = null;
      }

      if (this._blackboxManager) {
        await this._blackboxManager.close();
        this._blackboxManager = null;
      }

      if (this._watchManager) {
        this._watchManager.clearAll();
        this._watchManager = null;
      }

      // Remove event listeners (prevent memory leaks)
      if (this.pausedListener) {
        this.cdpSession.off('Debugger.paused', this.pausedListener);
        this.pausedListener = null;
      }
      if (this.resumedListener) {
        this.cdpSession.off('Debugger.resumed', this.resumedListener);
        this.resumedListener = null;
      }
      if (this.breakpointResolvedListener) {
        this.cdpSession.off('Debugger.breakpointResolved', this.breakpointResolvedListener);
        this.breakpointResolvedListener = null;
      }

      await this.cdpSession.send('Debugger.disable');
    } catch (error) {
      logger.error('Failed to disable debugger:', error);
    } finally {
      // Regardless of success or failure, clean up state (ensure state consistency)
      this.enabled = false;
      this.breakpoints.clear();
      this.pausedState = null;
      this.pausedResolvers = [];

      // Detach CDP session
      if (this.cdpSession) {
        try {
          await this.cdpSession.detach();
        } catch (e) {
          logger.warn('Failed to detach CDP session:', e);
        }
        this.cdpSession = null;
      }

      logger.info('Debugger disabled and cleaned up');
    }
  }

  /**
   * Check if the debugger is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set async call stack depth (requires Debugger domain to be enabled)
   */
  async setAsyncCallStackDepth(maxDepth: number): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger is not enabled. Call enable() first.');
    }
    await this.cdpSession.send('Debugger.setAsyncCallStackDepth', { maxDepth });
  }

  // ==================== Breakpoint management ====================

  /**
   * Set breakpoint by URL (most commonly used)
   */
  async setBreakpointByUrl(params: {
    url: string;
    lineNumber: number;
    columnNumber?: number;
    condition?: string;
  }): Promise<BreakpointInfo> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger is not enabled. Call init() or enable() first.');
    }

    // Parameter validation
    if (!params.url) {
      throw new Error('url parameter is required');
    }

    if (params.lineNumber < 0) {
      throw new Error('lineNumber must be a non-negative number');
    }

    if (params.columnNumber !== undefined && params.columnNumber < 0) {
      throw new Error('columnNumber must be a non-negative number');
    }

    try {
      // Call CDP API to set breakpoint
      const result = await this.cdpSession.send('Debugger.setBreakpointByUrl', {
        url: params.url,
        lineNumber: params.lineNumber,
        columnNumber: params.columnNumber,
        condition: params.condition,
      });

      // Create breakpoint info
      const breakpointInfo: BreakpointInfo = {
        breakpointId: result.breakpointId,
        location: {
          url: params.url,
          lineNumber: params.lineNumber,
          columnNumber: params.columnNumber,
        },
        condition: params.condition,
        enabled: true,
        hitCount: 0,
        createdAt: Date.now(),
      };

      // Save breakpoint info
      this.breakpoints.set(result.breakpointId, breakpointInfo);

      logger.info(`Breakpoint set: ${params.url}:${params.lineNumber}`, {
        breakpointId: result.breakpointId,
        condition: params.condition,
      });

      return breakpointInfo;
    } catch (error) {
      logger.error('Failed to set breakpoint:', error);
      throw error;
    }
  }

  /**
   * Set breakpoint by script ID
   */
  async setBreakpoint(params: {
    scriptId: string;
    lineNumber: number;
    columnNumber?: number;
    condition?: string;
  }): Promise<BreakpointInfo> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger is not enabled. Call init() or enable() first.');
    }

    // Parameter validation
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }

    if (params.lineNumber < 0) {
      throw new Error('lineNumber must be a non-negative number');
    }

    if (params.columnNumber !== undefined && params.columnNumber < 0) {
      throw new Error('columnNumber must be a non-negative number');
    }

    try {
      const result = await this.cdpSession.send('Debugger.setBreakpoint', {
        location: {
          scriptId: params.scriptId,
          lineNumber: params.lineNumber,
          columnNumber: params.columnNumber,
        },
        condition: params.condition,
      });

      const breakpointInfo: BreakpointInfo = {
        breakpointId: result.breakpointId,
        location: {
          scriptId: params.scriptId,
          lineNumber: params.lineNumber,
          columnNumber: params.columnNumber,
        },
        condition: params.condition,
        enabled: true,
        hitCount: 0,
        createdAt: Date.now(),
      };

      this.breakpoints.set(result.breakpointId, breakpointInfo);

      logger.info(`Breakpoint set: scriptId=${params.scriptId}:${params.lineNumber}`, {
        breakpointId: result.breakpointId,
      });

      return breakpointInfo;
    } catch (error) {
      logger.error('Failed to set breakpoint:', error);
      throw error;
    }
  }

  /**
   * Remove a breakpoint
   */
  async removeBreakpoint(breakpointId: string): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger is not enabled. Call init() or enable() first.');
    }

    // Parameter validation
    if (!breakpointId) {
      throw new Error('breakpointId parameter is required');
    }

    if (!this.breakpoints.has(breakpointId)) {
      throw new Error(`Breakpoint not found: ${breakpointId}. Use listBreakpoints() to see active breakpoints.`);
    }

    try {
      await this.cdpSession.send('Debugger.removeBreakpoint', { breakpointId });
      this.breakpoints.delete(breakpointId);

      logger.info(`Breakpoint removed: ${breakpointId}`);
    } catch (error) {
      logger.error(`Failed to remove breakpoint ${breakpointId}:`, error);
      throw error;
    }
  }

  /**
   * List all breakpoints
   */
  listBreakpoints(): BreakpointInfo[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Get breakpoint information
   */
  getBreakpoint(breakpointId: string): BreakpointInfo | undefined {
    return this.breakpoints.get(breakpointId);
  }

  /**
   * Clear all breakpoints
   */
  async clearAllBreakpoints(): Promise<void> {
    const breakpointIds = Array.from(this.breakpoints.keys());

    for (const id of breakpointIds) {
      await this.removeBreakpoint(id);
    }

    logger.info(`Cleared ${breakpointIds.length} breakpoints`);
  }

  /**
   * Set exception breakpoint (pause on exceptions)
   */
  async setPauseOnExceptions(state: 'none' | 'uncaught' | 'all'): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger not enabled');
    }

    try {
      await this.cdpSession.send('Debugger.setPauseOnExceptions', { state });
      this.pauseOnExceptionsState = state; // Track state
      logger.info(`Pause on exceptions set to: ${state}`);
    } catch (error) {
      logger.error('Failed to set pause on exceptions:', error);
      throw error;
    }
  }

  /**
   * Get current exception breakpoint state
   */
  getPauseOnExceptionsState(): 'none' | 'uncaught' | 'all' {
    return this.pauseOnExceptionsState;
  }

  // ==================== Execution control ====================

  /**
   * Pause execution (pause at next statement)
   */
  async pause(): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger not enabled');
    }

    try {
      await this.cdpSession.send('Debugger.pause');
      logger.info('Execution paused');
    } catch (error) {
      logger.error('Failed to pause execution:', error);
      throw error;
    }
  }

  /**
   * Resume execution
   */
  async resume(): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger not enabled');
    }

    try {
      await this.cdpSession.send('Debugger.resume');
      logger.info('Execution resumed');
    } catch (error) {
      logger.error('Failed to resume execution:', error);
      throw error;
    }
  }

  /**
   * Step Into
   */
  async stepInto(): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger not enabled');
    }

    try {
      await this.cdpSession.send('Debugger.stepInto');
      logger.info('Step into');
    } catch (error) {
      logger.error('Failed to step into:', error);
      throw error;
    }
  }

  /**
   * Step Over
   */
  async stepOver(): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger not enabled');
    }

    try {
      await this.cdpSession.send('Debugger.stepOver');
      logger.info('Step over');
    } catch (error) {
      logger.error('Failed to step over:', error);
      throw error;
    }
  }

  /**
   * Step Out
   */
  async stepOut(): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger not enabled');
    }

    try {
      await this.cdpSession.send('Debugger.stepOut');
      logger.info('Step out');
    } catch (error) {
      logger.error('Failed to step out:', error);
      throw error;
    }
  }

  // ==================== Paused state management ====================

  /**
   * Get current paused state
   */
  getPausedState(): PausedState | null {
    return this.pausedState;
  }

  /**
   * Check if currently in paused state
   */
  isPaused(): boolean {
    return this.pausedState !== null;
  }

  /**
   * Wait for paused event (for asynchronously waiting for breakpoint to trigger)
   */
  async waitForPaused(timeout = 30000): Promise<PausedState> {
    if (this.pausedState) {
      return this.pausedState;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.pausedResolvers.indexOf(resolve);
        if (index > -1) {
          this.pausedResolvers.splice(index, 1);
        }
        reject(new Error('Timeout waiting for paused event'));
      }, timeout);

      this.pausedResolvers.push((state) => {
        clearTimeout(timer);
        resolve(state);
      });
    });
  }

  /**
   * Evaluate expression on a call frame
   */
  async evaluateOnCallFrame(params: {
    callFrameId: string;
    expression: string;
    returnByValue?: boolean;
  }): Promise<any> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger not enabled');
    }

    if (!this.pausedState) {
      throw new Error('Not in paused state');
    }

    try {
      const result = await this.cdpSession.send('Debugger.evaluateOnCallFrame', {
        callFrameId: params.callFrameId,
        expression: params.expression,
        returnByValue: params.returnByValue !== false,
      });

      logger.info(`Evaluated on call frame: ${params.expression}`, {
        result: result.result.value,
      });

      return result.result;
    } catch (error) {
      logger.error('Failed to evaluate on call frame:', error);
      throw error;
    }
  }

  // ==================== Scope variable retrieval (enhanced) ====================

  /**
   * Get scope variables for a specified call frame
   *
   * @param options Retrieval options
   * @returns Scope variable list and error information
   */
  async getScopeVariables(options: GetScopeVariablesOptions = {}): Promise<GetScopeVariablesResult> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Debugger not enabled');
    }

    if (!this.pausedState) {
      throw new Error('Not in paused state. Use pause() or set a breakpoint first.');
    }

    const {
      callFrameId,
      includeObjectProperties = false,
      maxDepth = 1,
      skipErrors = true,
    } = options;

    try {
      // Get target call frame
      const targetFrame = callFrameId
        ? this.pausedState.callFrames.find(f => f.callFrameId === callFrameId)
        : this.pausedState.callFrames[0]; // Default to top frame

      if (!targetFrame) {
        throw new Error(`Call frame not found: ${callFrameId || 'top frame'}`);
      }

      const variables: ScopeVariable[] = [];
      const errors: Array<{ scope: string; error: string }> = [];
      let successfulScopes = 0;

      // Iterate through scope chain
      for (const scope of targetFrame.scopeChain) {
        try {
          // Get scope object properties
          if (scope.object.objectId) {
            const properties = await this.cdpSession.send('Runtime.getProperties', {
              objectId: scope.object.objectId,
              ownProperties: true,
            });

            // Process each property
            for (const prop of properties.result) {
              if (prop.name === '__proto__') continue; // Skip prototype

              const variable: ScopeVariable = {
                name: prop.name,
                value: prop.value?.value,
                type: prop.value?.type || 'unknown',
                scope: scope.type,
                writable: prop.writable,
                configurable: prop.configurable,
                enumerable: prop.enumerable,
                objectId: prop.value?.objectId,
              };

              variables.push(variable);

              // If object properties need to be expanded
              if (includeObjectProperties && prop.value?.objectId && maxDepth > 0) {
                try {
                  const nestedProps = await this.getObjectProperties(
                    prop.value.objectId,
                    maxDepth - 1
                  );
                  // Add nested properties to variables (using dot notation to indicate hierarchy)
                  for (const nested of nestedProps) {
                    variables.push({
                      ...nested,
                      name: `${prop.name}.${nested.name}`,
                      scope: scope.type,
                    });
                  }
                } catch (nestedError) {
                  // Ignore nested property retrieval failures
                  logger.debug(`Failed to get nested properties for ${prop.name}:`, nestedError);
                }
              }
            }

            successfulScopes++;
          }
        } catch (error: any) {
          const errorMsg = error.message || String(error);

          // Enhanced error handling: log errors but don't interrupt the flow
          logger.warn(`Failed to get properties for scope ${scope.type}:`, errorMsg);

          errors.push({
            scope: scope.type,
            error: errorMsg,
          });

          // If not skipping errors, throw the exception
          if (!skipErrors) {
            throw error;
          }
        }
      }

      const result: GetScopeVariablesResult = {
        success: true,
        variables,
        callFrameId: targetFrame.callFrameId,
        callFrameInfo: {
          functionName: targetFrame.functionName || '(anonymous)',
          location: `${targetFrame.url}:${targetFrame.location.lineNumber}:${targetFrame.location.columnNumber}`,
        },
        totalScopes: targetFrame.scopeChain.length,
        successfulScopes,
      };

      // If there are errors, add them to the result
      if (errors.length > 0) {
        result.errors = errors;
      }

      logger.info(`Got ${variables.length} variables from ${successfulScopes}/${targetFrame.scopeChain.length} scopes`, {
        callFrameId: targetFrame.callFrameId,
        functionName: targetFrame.functionName,
        errors: errors.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to get scope variables:', error);
      throw error;
    }
  }

  /**
   * Recursively get object properties (for expanding nested objects)
   */
  private async getObjectProperties(objectId: string, maxDepth: number): Promise<ScopeVariable[]> {
    if (maxDepth <= 0 || !this.cdpSession) {
      return [];
    }

    try {
      const properties = await this.cdpSession.send('Runtime.getProperties', {
        objectId,
        ownProperties: true,
      });

      const variables: ScopeVariable[] = [];

      for (const prop of properties.result) {
        if (prop.name === '__proto__') continue;

        variables.push({
          name: prop.name,
          value: prop.value?.value,
          type: prop.value?.type || 'unknown',
          scope: 'local', // Nested properties default to 'local' scope
          objectId: prop.value?.objectId,
        });
      }

      return variables;
    } catch (error) {
      logger.debug(`Failed to get object properties for ${objectId}:`, error);
      return [];
    }
  }

  // ==================== Breakpoint hit callback management ====================

  /**
   * Register breakpoint hit callback
   */
  onBreakpointHit(callback: BreakpointHitCallback): void {
    this.breakpointHitCallbacks.add(callback);
    logger.info('Breakpoint hit callback registered', {
      totalCallbacks: this.breakpointHitCallbacks.size,
    });
  }

  /**
   * Remove breakpoint hit callback
   */
  offBreakpointHit(callback: BreakpointHitCallback): void {
    this.breakpointHitCallbacks.delete(callback);
    logger.info('Breakpoint hit callback removed', {
      totalCallbacks: this.breakpointHitCallbacks.size,
    });
  }

  /**
   * Clear all breakpoint hit callbacks
   */
  clearBreakpointHitCallbacks(): void {
    this.breakpointHitCallbacks.clear();
    logger.info('All breakpoint hit callbacks cleared');
  }

  /**
   * Get the number of currently registered callbacks
   */
  getBreakpointHitCallbackCount(): number {
    return this.breakpointHitCallbacks.size;
  }

  // ==================== Event handling ====================

  /**
   * Handle paused event (enhanced - supports breakpoint hit callbacks)
   */
  private async handlePaused(params: any): Promise<void> {
    this.pausedState = {
      callFrames: params.callFrames,
      reason: params.reason,
      data: params.data,
      hitBreakpoints: params.hitBreakpoints,
      timestamp: Date.now(),
    };

    // Update breakpoint hit count
    if (params.hitBreakpoints) {
      for (const breakpointId of params.hitBreakpoints) {
        const bp = this.breakpoints.get(breakpointId);
        if (bp) {
          bp.hitCount++;
        }
      }
    }

    logger.info('Execution paused', {
      reason: params.reason,
      location: params.callFrames[0]?.location,
      hitBreakpoints: params.hitBreakpoints,
    });

    // Notify waitForPaused() waiters first (should not be blocked by callbacks)
    for (const resolver of this.pausedResolvers) {
      resolver(this.pausedState);
    }
    this.pausedResolvers = [];

    // Asynchronously trigger breakpoint hit callbacks (non-blocking for paused event handling)
    if (params.hitBreakpoints && params.hitBreakpoints.length > 0 && this.breakpointHitCallbacks.size > 0) {
      // Use queueMicrotask to ensure callbacks don't block the event loop
      const callbacks = Array.from(this.breakpointHitCallbacks);
      const hitBreakpoints = params.hitBreakpoints;
      const topFrame = params.callFrames[0];

      (async () => {
        // Try to auto-fetch top-level scope variables
        let variables: ScopeVariable[] | undefined;
        try {
          const result = await this.getScopeVariables({ skipErrors: true });
          variables = result.variables;
        } catch (error) {
          logger.debug('Failed to auto-fetch variables for breakpoint hit callback:', error);
        }

        // Build event object
        const event: BreakpointHitEvent = {
          breakpointId: hitBreakpoints[0],
          breakpointInfo: this.breakpoints.get(hitBreakpoints[0]),
          location: {
            scriptId: topFrame.location.scriptId,
            lineNumber: topFrame.location.lineNumber,
            columnNumber: topFrame.location.columnNumber,
            url: topFrame.url,
          },
          callFrames: params.callFrames,
          timestamp: Date.now(),
          variables,
          reason: params.reason,
        };

        for (const callback of callbacks) {
          try {
            await Promise.resolve(callback(event));
          } catch (error) {
            logger.error('Breakpoint hit callback error:', error);
          }
        }
      })().catch(error => {
        logger.error('Breakpoint hit callback pipeline error:', error);
      });
    }
  }

  /**
   * Handle resumed event
   */
  private handleResumed(): void {
    this.pausedState = null;
    logger.info('Execution resumed');
  }

  /**
   * Handle breakpoint resolved event
   */
  private handleBreakpointResolved(params: any): void {
    const bp = this.breakpoints.get(params.breakpointId);
    if (bp) {
      logger.info('Breakpoint resolved', {
        breakpointId: params.breakpointId,
        location: params.location,
      });
    }
  }

  // ==================== Debug session save/restore ====================

  /**
   * Export current debug session as a JSON object
   */
  exportSession(metadata?: DebuggerSession['metadata']): DebuggerSession {
    const session: DebuggerSession = {
      version: '1.0',
      timestamp: Date.now(),
      breakpoints: Array.from(this.breakpoints.values()).map(bp => ({
        location: {
          scriptId: bp.location.scriptId,
          url: bp.location.url,
          lineNumber: bp.location.lineNumber,
          columnNumber: bp.location.columnNumber,
        },
        condition: bp.condition,
        enabled: bp.enabled,
      })),
      pauseOnExceptions: this.pauseOnExceptionsState,
      metadata: metadata || {},
    };

    logger.info('Session exported', {
      breakpointCount: session.breakpoints.length,
      pauseOnExceptions: session.pauseOnExceptions,
    });

    return session;
  }

  /**
   * Save debug session to file
   *
   * @param filePath Save path (optional, defaults to ./debugger-sessions/session-{timestamp}.json)
   * @param metadata Session metadata
   * @returns The saved file path
   */
  async saveSession(filePath?: string, metadata?: DebuggerSession['metadata']): Promise<string> {
    const session = this.exportSession(metadata);

    // If no path specified, use default path
    if (!filePath) {
      const sessionsDir = this.getDefaultSessionsDir();
      await fs.mkdir(sessionsDir, { recursive: true });
      filePath = path.join(sessionsDir, `session-${Date.now()}.json`);
    } else {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Write to file
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');

    logger.info(`Session saved to ${filePath}`, {
      breakpointCount: session.breakpoints.length,
    });

    return filePath;
  }

  /**
   * Load debug session from file
   *
   * @param filePath Session file path
   */
  async loadSessionFromFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const session: DebuggerSession = JSON.parse(content);

    await this.importSession(session);

    logger.info(`Session loaded from ${filePath}`, {
      breakpointCount: session.breakpoints.length,
    });
  }

  /**
   * Import debug session (from JSON object or string)
   *
   * @param sessionData Session data (JSON object or string)
   */
  async importSession(sessionData: DebuggerSession | string): Promise<void> {
    if (!this.enabled) {
      throw new Error('Debugger must be enabled before importing session. Call init() or enable() first.');
    }

    const session: DebuggerSession = typeof sessionData === 'string'
      ? JSON.parse(sessionData)
      : sessionData;

    // Validate session version
    if (session.version !== '1.0') {
      logger.warn(`Session version mismatch: ${session.version} (expected 1.0)`);
    }

    logger.info('Importing session...', {
      breakpointCount: session.breakpoints.length,
      pauseOnExceptions: session.pauseOnExceptions,
      timestamp: new Date(session.timestamp).toISOString(),
    });

    // Clear existing breakpoints
    await this.clearAllBreakpoints();

    // Restore breakpoints
    let successCount = 0;
    let failCount = 0;

    for (const bp of session.breakpoints) {
      try {
        if (bp.location.url) {
          // URL breakpoint
          await this.setBreakpointByUrl({
            url: bp.location.url,
            lineNumber: bp.location.lineNumber,
            columnNumber: bp.location.columnNumber,
            condition: bp.condition,
          });
          successCount++;
        } else if (bp.location.scriptId) {
          // scriptId breakpoint
          await this.setBreakpoint({
            scriptId: bp.location.scriptId,
            lineNumber: bp.location.lineNumber,
            columnNumber: bp.location.columnNumber,
            condition: bp.condition,
          });
          successCount++;
        } else {
          logger.warn('Breakpoint has neither url nor scriptId, skipping', bp);
          failCount++;
        }
      } catch (error) {
        logger.error('Failed to restore breakpoint:', error, bp);
        failCount++;
      }
    }

    // Restore exception breakpoint settings
    if (session.pauseOnExceptions) {
      await this.setPauseOnExceptions(session.pauseOnExceptions);
    }

    logger.info('Session imported', {
      totalBreakpoints: session.breakpoints.length,
      successCount,
      failCount,
      pauseOnExceptions: session.pauseOnExceptions,
    });
  }

  /**
   * List all saved session files
   */
  async listSavedSessions(): Promise<Array<{ path: string; timestamp: number; metadata?: any }>> {
    const sessionsDir = this.getDefaultSessionsDir();

    try {
      await fs.access(sessionsDir);
    } catch {
      // Directory does not exist
      return [];
    }

    const files = await fs.readdir(sessionsDir);
    const sessions: Array<{ path: string; timestamp: number; metadata?: any }> = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(sessionsDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const session: DebuggerSession = JSON.parse(content);
          sessions.push({
            path: filePath,
            timestamp: session.timestamp,
            metadata: session.metadata,
          });
        } catch (error) {
          logger.warn(`Failed to read session file ${file}:`, error);
        }
      }
    }

    // Sort by timestamp in descending order
    sessions.sort((a, b) => b.timestamp - a.timestamp);

    return sessions;
  }

  /**
   * Close the debugger
   */
  async close(): Promise<void> {
    // disable() already handles detach and state cleanup internally, no need to repeat
    if (this.enabled) {
      await this.disable();
    }

    // Fallback only if disable() failed to clean up
    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch (e) {
        logger.warn('Failed to detach CDP session in close():', e);
      }
      this.cdpSession = null;
    }

    this.breakpointHitCallbacks.clear();
    logger.info('Debugger manager closed');
  }
}
