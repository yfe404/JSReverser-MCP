/**
 * AIHookGenerator — AI-driven Hook code generator
 *
 * Design philosophy:
 * - Fully based on HookManager capabilities, no duplicate hook logic
 * - Accepts natural language descriptions or structured requests, translates them into HookCreateOptions
 * - Supports all types registered in HookManager
 * - Generated code can be directly injected into the browser for execution
 */

import { HookManager, type HookCreateOptions } from './HookManager.js';

// ==================== AI Hook Request Types ====================

export interface AIHookRequest {
  /** Natural language description (e.g., "Hook all fetch requests, capture request and response") */
  description: string;
  /** Hook target configuration */
  target: AIHookTarget;
  /** Hook behavior configuration */
  behavior: AIHookBehavior;
  /** Condition filtering */
  condition?: AIHookCondition;
  /** Custom code snippets */
  customCode?: AIHookCustomCode;
}

export interface AIHookTarget {
  /** Hook type (corresponds to the type name in the registry) */
  type: string;
  /** Target function or object name (e.g., "btoa", "fetch") */
  name?: string;
  /** Object path (e.g., "window.crypto.subtle"), used for object-method type */
  object?: string;
  /** Property name or method name */
  property?: string;
  /** Regex match pattern (for matching multiple functions) */
  pattern?: string;
}

export interface AIHookBehavior {
  captureArgs?: boolean;
  captureReturn?: boolean;
  captureStack?: boolean | number;
  captureTiming?: boolean;
  logToConsole?: boolean;
  consoleFormat?: 'full' | 'compact' | 'json';
  blockExecution?: boolean;
  modifyArgs?: boolean;
  modifyReturn?: boolean;
}

export interface AIHookCondition {
  /** General JS condition expression */
  expression?: string;
  urlPattern?: string;
  argFilter?: string;
  returnFilter?: string;
  maxCalls?: number;
  minInterval?: number;
}

export interface AIHookCustomCode {
  before?: string;
  after?: string;
  replace?: string;
  onError?: string;
}

export interface AIHookResult {
  hookId: string;
  code: string;
  description: string;
  type: string;
  metadata: {
    target: AIHookTarget;
    behavior: AIHookBehavior;
    generatedAt: number;
  };
}

// ==================== AIHookGenerator ====================

export class AIHookGenerator {
  private manager: HookManager;

  constructor(manager?: HookManager) {
    this.manager = manager || new HookManager();
  }

  /** Get the internal HookManager instance */
  getManager(): HookManager {
    return this.manager;
  }

  /**
   * Generate hook code
   * Core method: translates AIHookRequest into HookCreateOptions, delegates to HookManager
   */
  generate(request: AIHookRequest): AIHookResult {
    // 1. Translate the AI request into HookManager configuration
    const options = this.translateRequest(request);

    // 2. Delegate to HookManager for creation
    const { hookId, script } = this.manager.create(options);

    // 3. Build the result
    return {
      hookId,
      code: script,
      description: request.description,
      type: request.target.type,
      metadata: {
        target: request.target,
        behavior: request.behavior,
        generatedAt: Date.now(),
      },
    };
  }

  /**
   * Batch generate hooks
   */
  generateBatch(requests: AIHookRequest[]): AIHookResult[] {
    return requests.map(req => this.generate(req));
  }

  /**
   * Shortcut method: generate function hook
   */
  hookFunction(
    target: string,
    options?: {
      description?: string;
      captureAll?: boolean;
      action?: 'log' | 'block';
      before?: string;
      after?: string;
    }
  ): AIHookResult {
    return this.generate({
      description: options?.description || `Hook ${target}`,
      target: { type: 'function', name: target },
      behavior: {
        captureArgs: options?.captureAll ?? true,
        captureReturn: options?.captureAll ?? true,
        captureStack: options?.captureAll ? 5 : false,
        captureTiming: options?.captureAll ?? false,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
      customCode: {
        before: options?.before,
        after: options?.after,
      },
    });
  }

  /**
   * Shortcut method: Hook fetch requests
   */
  hookFetch(options?: {
    urlPattern?: string;
    captureBody?: boolean;
    captureResponse?: boolean;
    action?: 'log' | 'block';
    description?: string;
  }): AIHookResult {
    return this.generate({
      description: options?.description || 'Hook fetch API',
      target: { type: 'fetch' },
      behavior: {
        captureArgs: options?.captureBody ?? true,
        captureReturn: options?.captureResponse ?? true,
        captureStack: 3,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
      condition: {
        urlPattern: options?.urlPattern,
      },
    });
  }

  /**
   * Shortcut method: Hook XHR requests
   */
  hookXHR(options?: {
    urlPattern?: string;
    captureBody?: boolean;
    captureResponse?: boolean;
    action?: 'log' | 'block';
    description?: string;
  }): AIHookResult {
    return this.generate({
      description: options?.description || 'Hook XMLHttpRequest',
      target: { type: 'xhr' },
      behavior: {
        captureArgs: options?.captureBody ?? true,
        captureReturn: options?.captureResponse ?? true,
        captureStack: 3,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
      condition: {
        urlPattern: options?.urlPattern,
      },
    });
  }

  /**
   * Shortcut method: Hook WebSocket
   */
  hookWebSocket(options?: {
    urlPattern?: string;
    description?: string;
  }): AIHookResult {
    return this.generate({
      description: options?.description || 'Hook WebSocket',
      target: { type: 'websocket' },
      behavior: {
        captureArgs: true,
        captureReturn: true,
        logToConsole: true,
      },
      condition: {
        urlPattern: options?.urlPattern,
      },
    });
  }

  /**
   * Shortcut method: Hook object property
   */
  hookProperty(
    object: string,
    property: string,
    options?: {
      description?: string;
      action?: 'log' | 'block';
      captureStack?: boolean | number;
    }
  ): AIHookResult {
    return this.generate({
      description: options?.description || `Hook ${object}.${property}`,
      target: { type: 'property', object, property },
      behavior: {
        captureStack: options?.captureStack ?? 3,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
    });
  }

  /**
   * Shortcut method: Hook event listeners
   */
  hookEvent(
    eventName?: string,
    options?: {
      description?: string;
      action?: 'log' | 'block';
    }
  ): AIHookResult {
    return this.generate({
      description: options?.description || `Hook addEventListener${eventName ? ` (${eventName})` : ''}`,
      target: { type: 'event', name: eventName },
      behavior: {
        captureStack: 3,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
    });
  }

  /**
   * Shortcut method: Hook object method
   */
  hookObjectMethod(
    object: string,
    method: string,
    options?: {
      description?: string;
      captureAll?: boolean;
      action?: 'log' | 'block';
      before?: string;
      after?: string;
    }
  ): AIHookResult {
    return this.generate({
      description: options?.description || `Hook ${object}.${method}`,
      target: { type: 'object-method', object, property: method },
      behavior: {
        captureArgs: options?.captureAll ?? true,
        captureReturn: options?.captureAll ?? true,
        captureStack: options?.captureAll ? 5 : 3,
        captureTiming: options?.captureAll ?? false,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
      customCode: {
        before: options?.before,
        after: options?.after,
      },
    });
  }

  /**
   * Shortcut method: Hook eval / Function
   */
  hookEval(options?: {
    action?: 'log' | 'block';
    description?: string;
  }): AIHookResult {
    return this.generate({
      description: options?.description || 'Hook eval & Function',
      target: { type: 'eval' },
      behavior: {
        captureArgs: true,
        captureStack: 5,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
    });
  }

  /**
   * Shortcut method: Hook localStorage
   */
  hookLocalStorage(options?: {
    keyPattern?: string;
    action?: 'log' | 'block';
    description?: string;
  }): AIHookResult {
    return this.generate({
      description: options?.description || 'Hook localStorage',
      target: { type: 'localstorage' },
      behavior: {
        captureArgs: true,
        captureReturn: true,
        captureStack: 3,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
      condition: {
        urlPattern: options?.keyPattern, // Reuse urlPattern to store keyPattern
      },
    });
  }

  /**
   * Shortcut method: Hook cookie
   */
  hookCookie(options?: {
    action?: 'log' | 'block';
    description?: string;
  }): AIHookResult {
    return this.generate({
      description: options?.description || 'Hook document.cookie',
      target: { type: 'cookie' },
      behavior: {
        captureStack: 5,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
    });
  }

  /**
   * Shortcut method: Hook timers
   */
  hookTimers(options?: {
    timerType?: 'setTimeout' | 'setInterval' | 'both';
    action?: 'log' | 'block';
    description?: string;
  }): AIHookResult {
    return this.generate({
      description: options?.description || 'Hook timers',
      target: { type: 'timer', name: options?.timerType || 'both' },
      behavior: {
        captureStack: 3,
        logToConsole: true,
        blockExecution: options?.action === 'block',
      },
    });
  }

  /**
   * Inject custom script
   */
  injectCustom(script: string, description?: string): AIHookResult {
    return this.generate({
      description: description || 'Custom hook script',
      target: { type: 'custom' },
      behavior: { logToConsole: true },
      customCode: { replace: script },
    });
  }

  /**
   * Get hook data (proxied to HookManager)
   */
  getHookData(hookId: string): unknown[] {
    return this.manager.getRecords(hookId);
  }

  /**
   * Get list of all hooks
   */
  listHooks(): Array<{
    hookId: string;
    type: string;
    description: string;
    enabled: boolean;
    callCount: number;
  }> {
    return this.manager.getStats().hooks;
  }

  /**
   * Clear hook data
   */
  clearData(hookId?: string): void {
    if (hookId) {
      this.manager.clearRecords(hookId);
    } else {
      for (const hook of this.manager.getAllHooks()) {
        this.manager.clearRecords(hook.hookId);
      }
    }
  }

  /**
   * Enable/disable hook
   */
  toggleHook(hookId: string, enabled: boolean): boolean {
    return enabled ? this.manager.enable(hookId) : this.manager.disable(hookId);
  }

  /**
   * Export data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    return this.manager.exportData(format);
  }

  // ==================== Internal Methods ====================

  /**
   * Translate AIHookRequest into HookCreateOptions
   */
  private translateRequest(request: AIHookRequest): HookCreateOptions {
    const { target, behavior, condition, customCode, description } = request;

    // Determine hook type
    const type = target.type;

    // Build params (type-specific parameters)
    const params: Record<string, unknown> = {};

    // Assign params based on target type
    if (target.name && (type === 'function' || type === 'timer')) {
      if (type === 'function') {
        params.target = target.name;
      } else {
        params.timerType = target.name;
      }
    }

    if (target.object) {
      params.object = target.object;
    }

    if (target.property) {
      params.property = target.property;
      if (type === 'object-method') params.method = target.property;
    }

    if (target.name && type === 'event') {
      params.eventName = target.name;
    }

    // URL pattern
    if (condition?.urlPattern) {
      params.urlPattern = condition.urlPattern;
    }

    // keyPattern for localstorage
    if (type === 'localstorage' && condition?.urlPattern) {
      params.keyPattern = condition.urlPattern;
    }

    // Full replacement for custom type
    if (type === 'custom' && customCode?.replace) {
      params.script = customCode.replace;
    }

    // Build action
    let action: HookCreateOptions['action'] = 'log';
    if (behavior.blockExecution) {
      action = 'block';
    } else if (behavior.modifyArgs || behavior.modifyReturn) {
      action = 'modify';
    }

    // Build capture
    const capture: HookCreateOptions['capture'] = {};
    if (behavior.captureArgs) capture.args = true;
    if (behavior.captureReturn) capture.returnValue = true;
    if (behavior.captureStack) capture.stack = behavior.captureStack;
    if (behavior.captureTiming) capture.timing = true;

    // Build condition
    const condOpts: HookCreateOptions['condition'] = {};
    if (condition?.expression || condition?.argFilter) {
      condOpts.expression = condition.expression || condition.argFilter;
    }
    if (condition?.maxCalls) condOpts.maxCalls = condition.maxCalls;
    if (condition?.minInterval) condOpts.minInterval = condition.minInterval;
    if (condition?.urlPattern) condOpts.urlPattern = condition.urlPattern;

    // Build lifecycle
    const lifecycle: HookCreateOptions['lifecycle'] = {};
    if (customCode?.before) lifecycle.before = customCode.before;
    if (customCode?.after) lifecycle.after = customCode.after;
    if (customCode?.onError) lifecycle.onError = customCode.onError;
    if (customCode?.replace && type !== 'custom') lifecycle.replace = customCode.replace;

    // Build store
    const store: HookCreateOptions['store'] = {
      console: behavior.logToConsole ?? true,
      consoleFormat: behavior.consoleFormat || 'compact',
    };

    return {
      type,
      params,
      description,
      action,
      capture,
      condition: condOpts,
      lifecycle,
      store,
    };
  }
}
