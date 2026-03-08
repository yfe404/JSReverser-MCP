/**
 * RuntimeInspector - Runtime inspection
 *
 * Features:
 * 1. Get call stack
 * 2. Get scope variables
 * 3. Get object properties
 * 4. Expression evaluation
 *
 * Design principles:
 * - Thin wrapper around CDP Runtime domain, directly calling CDP APIs
 * - Relies on DebuggerManager for paused state
 * - Provides friendly data formatting
 */

import type { CDPSession } from 'puppeteer';
import type { CodeCollector } from '../collector/CodeCollector.js';
import type { DebuggerManager, CallFrame, Scope } from './DebuggerManager.js';
import { logger } from '../../utils/logger.js';

/**
 * Variable information
 */
export interface VariableInfo {
  name: string;
  value: any;
  type: string;
  objectId?: string;
  className?: string;
  description?: string;
}

/**
 * Scope variables
 */
export interface ScopeVariables {
  scopeType: string;
  scopeName?: string;
  variables: VariableInfo[];
}

/**
 * Call stack information
 */
export interface CallStackInfo {
  callFrames: Array<{
    callFrameId: string;
    functionName: string;
    location: {
      scriptId: string;
      url: string;
      lineNumber: number;
      columnNumber: number;
    };
    scopeChain: Array<{
      type: string;
      name?: string;
    }>;
  }>;
  reason: string;
  timestamp: number;
}

/**
 * Runtime inspector
 */
export class RuntimeInspector {
  private cdpSession: CDPSession | null = null;
  private enabled = false;

  constructor(
    private collector: CodeCollector,
    private debuggerManager: DebuggerManager
  ) {}

  /**
   * Initialize the runtime inspector (enable CDP Runtime domain)
   */
  async init(): Promise<void> {
    if (this.enabled) {
      logger.warn('Runtime inspector already enabled');
      return;
    }

    try {
      const page = await this.collector.getActivePage();
      // Fix: use new API to avoid deprecation warnings
      this.cdpSession = await page.createCDPSession();

      // Enable Runtime domain
      await this.cdpSession.send('Runtime.enable');
      this.enabled = true;

      logger.info('Runtime inspector enabled');
    } catch (error) {
      logger.error('Failed to enable runtime inspector:', error);
      throw error;
    }
  }

  /**
   * Enable the runtime inspector (alias method, consistent with other modules)
   */
  async enable(): Promise<void> {
    return this.init();
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.enabled;
  }

  /**
   * Enable async stack traces (delegates to DebuggerManager, as it requires the Debugger domain)
   *
   * @param maxDepth Maximum async stack depth (default 32)
   */
  async enableAsyncStackTraces(maxDepth: number = 32): Promise<void> {
    if (!this.debuggerManager.isEnabled()) {
      throw new Error('Debugger is not enabled. Call debuggerManager.enable() first.');
    }

    try {
      await this.debuggerManager.setAsyncCallStackDepth(maxDepth);
      logger.info(`Async stack traces enabled with max depth: ${maxDepth}`);
    } catch (error) {
      logger.error('Failed to enable async stack traces:', error);
      throw error;
    }
  }

  /**
   * Disable async stack traces
   */
  async disableAsyncStackTraces(): Promise<void> {
    if (!this.debuggerManager.isEnabled()) {
      throw new Error('Debugger is not enabled');
    }

    try {
      await this.debuggerManager.setAsyncCallStackDepth(0);
      logger.info('Async stack traces disabled');
    } catch (error) {
      logger.error('Failed to disable async stack traces:', error);
      throw error;
    }
  }

  /**
   * Disable the runtime inspector
   */
  async disable(): Promise<void> {
    if (!this.enabled || !this.cdpSession) {
      logger.warn('Runtime inspector not enabled');
      return;
    }

    try {
      await this.cdpSession.send('Runtime.disable');
      this.enabled = false;

      // ✅ Detach CDP session
      await this.cdpSession.detach();
      this.cdpSession = null;

      logger.info('Runtime inspector disabled and cleaned up');
    } catch (error) {
      logger.error('Failed to disable runtime inspector:', error);
      throw error;
    }
  }

  // ==================== Call Stack ====================

  /**
   * Get the current call stack
   */
  async getCallStack(): Promise<CallStackInfo | null> {
    const pausedState = this.debuggerManager.getPausedState();
    
    if (!pausedState) {
      logger.warn('Not in paused state, cannot get call stack');
      return null;
    }

    try {
      const callStackInfo: CallStackInfo = {
        callFrames: pausedState.callFrames.map((frame: CallFrame) => ({
          callFrameId: frame.callFrameId,
          functionName: frame.functionName || '(anonymous)',
          location: {
            scriptId: frame.location.scriptId,
            url: frame.url,
            lineNumber: frame.location.lineNumber,
            columnNumber: frame.location.columnNumber,
          },
          scopeChain: frame.scopeChain.map((scope: Scope) => ({
            type: scope.type,
            name: scope.name,
          })),
        })),
        reason: pausedState.reason,
        timestamp: pausedState.timestamp,
      };

      logger.info('Call stack retrieved', {
        frameCount: callStackInfo.callFrames.length,
        topFrame: callStackInfo.callFrames[0]?.functionName,
      });

      return callStackInfo;
    } catch (error) {
      logger.error('Failed to get call stack:', error);
      throw error;
    }
  }

  // ==================== Scope Variables ====================

  /**
   * Get all scope variables for a specific call frame
   */
  async getScopeVariables(callFrameId: string): Promise<ScopeVariables[]> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Runtime inspector is not enabled. Call init() or enable() first.');
    }

    if (!callFrameId) {
      throw new Error('callFrameId parameter is required');
    }

    const pausedState = this.debuggerManager.getPausedState();
    if (!pausedState) {
      throw new Error('Not in paused state. Debugger must be paused to get scope variables.');
    }

    // Find the specified call frame
    const callFrame = pausedState.callFrames.find(
      (frame: CallFrame) => frame.callFrameId === callFrameId
    );

    if (!callFrame) {
      throw new Error(`Call frame not found: ${callFrameId}. Use getCallStack() to see available frames.`);
    }

    try {
      const scopeVariablesList: ScopeVariables[] = [];

      // Iterate over all scopes
      for (const scope of callFrame.scopeChain) {
        if (!scope.object.objectId) {
          continue;
        }

        // Get properties of the scope object
        const properties = await this.getObjectProperties(scope.object.objectId);

        scopeVariablesList.push({
          scopeType: scope.type,
          scopeName: scope.name,
          variables: properties,
        });
      }

      logger.info(`Scope variables retrieved for call frame ${callFrameId}`, {
        scopeCount: scopeVariablesList.length,
      });

      return scopeVariablesList;
    } catch (error) {
      logger.error('Failed to get scope variables:', error);
      throw error;
    }
  }

  /**
   * Get all scope variables for the current call frame (convenience method)
   */
  async getCurrentScopeVariables(): Promise<ScopeVariables[]> {
    const pausedState = this.debuggerManager.getPausedState();

    if (!pausedState || pausedState.callFrames.length === 0) {
      throw new Error('Not in paused state or no call frames');
    }

    const topFrame = pausedState.callFrames[0];
    if (!topFrame) {
      throw new Error('No top frame available');
    }

    return await this.getScopeVariables(topFrame.callFrameId);
  }

  // ==================== Object Properties ====================

  /**
   * Get all properties of an object
   */
  async getObjectProperties(objectId: string): Promise<VariableInfo[]> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Runtime inspector is not enabled. Call init() or enable() first.');
    }

    if (!objectId) {
      throw new Error('objectId parameter is required');
    }

    try {
      const result = await this.cdpSession.send('Runtime.getProperties', {
        objectId,
        ownProperties: true,
        accessorPropertiesOnly: false,
        generatePreview: true,
      });

      const variables: VariableInfo[] = [];

      for (const prop of result.result) {
        if (!prop.value) {
          continue;
        }

        variables.push({
          name: prop.name,
          value: this.formatValue(prop.value),
          type: prop.value.type,
          objectId: prop.value.objectId,
          className: prop.value.className,
          description: prop.value.description,
        });
      }

      logger.info(`Object properties retrieved: ${objectId}`, {
        propertyCount: variables.length,
      });

      return variables;
    } catch (error) {
      logger.error('Failed to get object properties:', error);
      throw error;
    }
  }

  // ==================== Expression Evaluation ====================

  /**
   * Evaluate an expression on the current call frame
   */
  async evaluate(expression: string, callFrameId?: string): Promise<any> {
    // Parameter validation
    if (!expression || expression.trim() === '') {
      throw new Error('expression parameter is required and cannot be empty');
    }

    const pausedState = this.debuggerManager.getPausedState();

    if (!pausedState) {
      throw new Error('Not in paused state. Use evaluateGlobal() for global context evaluation.');
    }

    // If no callFrameId is specified, use the top call frame
    const targetCallFrameId = callFrameId || pausedState.callFrames[0]?.callFrameId;

    if (!targetCallFrameId) {
      throw new Error('No call frame available for evaluation');
    }

    try {
      const result = await this.debuggerManager.evaluateOnCallFrame({
        callFrameId: targetCallFrameId,
        expression,
        returnByValue: true,
      });

      logger.info(`Expression evaluated: ${expression}`, {
        result: result.value,
      });

      return this.formatValue(result);
    } catch (error) {
      logger.error('Failed to evaluate expression:', error);
      throw error;
    }
  }

  /**
   * Evaluate an expression in the global context (does not require paused state)
   */
  async evaluateGlobal(expression: string): Promise<any> {
    if (!this.enabled || !this.cdpSession) {
      throw new Error('Runtime inspector is not enabled. Call init() or enable() first.');
    }

    // Parameter validation
    if (!expression || expression.trim() === '') {
      throw new Error('expression parameter is required and cannot be empty');
    }

    try {
      const result = await this.cdpSession.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });

      logger.info(`Global expression evaluated: ${expression}`, {
        result: result.result.value,
      });

      return this.formatValue(result.result);
    } catch (error) {
      logger.error('Failed to evaluate global expression:', error);
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Format a value (convert CDP RemoteObject to a friendly format)
   */
  private formatValue(remoteObject: any): any {
    if (remoteObject.type === 'undefined') {
      return undefined;
    }

    if (remoteObject.type === 'object' && remoteObject.subtype === 'null') {
      return null;
    }

    if (remoteObject.value !== undefined) {
      return remoteObject.value;
    }

    if (remoteObject.description) {
      return remoteObject.description;
    }

    return `[${remoteObject.type}]`;
  }

  /**
   * Close the runtime inspector
   */
  async close(): Promise<void> {
    // disable() already handles detach and state cleanup internally
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

    logger.info('Runtime inspector closed');
  }
}

