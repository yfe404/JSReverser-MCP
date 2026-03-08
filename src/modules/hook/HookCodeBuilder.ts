/**
 * HookCodeBuilder — Composable Hook Code Builder
 *
 * Design philosophy:
 * - Use declarative chaining calls instead of hard-coded template strings
 * - Each stage (before/condition/execute/after/store) can have custom code inserted
 * - Supports async function awareness
 * - Supports flexible data capture and storage strategies
 * - Generated code is a self-contained IIFE that can be directly injected into the browser
 */

// ==================== Builder Configuration Types ====================

export interface HookTarget {
  /** Target expression, e.g. 'window.fetch', 'document.cookie', 'navigator.sendBeacon' */
  expression: string;
  /** Friendly name for log display */
  label?: string;
}

export interface CaptureOptions {
  args?: boolean;
  returnValue?: boolean;
  stack?: boolean | number; // true = full stack, number = limit frame count
  timing?: boolean;
  thisContext?: boolean;
}

export interface ConditionConfig {
  /** JS expression string, evaluated inside the hook; has access to args, callCount, timestamp */
  expression?: string;
  maxCalls?: number;
  minInterval?: number;
  /** URL match pattern (for fetch/xhr types), regex string */
  urlPattern?: string;
}

export interface StoreConfig {
  /** Global storage key name, default '__hookStore' */
  globalKey?: string;
  /** Maximum number of records per hook, default 500 */
  maxRecords?: number;
  /** Whether to output to console, default true */
  console?: boolean;
  /** Console output format: 'full' | 'compact' | 'json' */
  consoleFormat?: 'full' | 'compact' | 'json';
  /** Custom serializer function body (has access to hookData), returns the object to store */
  serializer?: string;
}

export interface LifecycleCode {
  /** Code executed before the original function call, has access to args, hookData, originalFn */
  before?: string;
  /** Code executed after the original function call, has access to args, result, hookData, originalFn */
  after?: string;
  /** Error handling code, has access to error, args, hookData */
  onError?: string;
  /** Code that executes regardless of success or failure */
  onFinally?: string;
  /** Code that completely replaces the original function (before/after will not take effect when used) */
  replace?: string;
}

export type HookAction = 'log' | 'block' | 'modify' | 'passthrough';

export interface BuilderConfig {
  target: HookTarget;
  capture: CaptureOptions;
  condition: ConditionConfig;
  store: StoreConfig;
  lifecycle: LifecycleCode;
  action: HookAction;
  hookId: string;
  asyncAware: boolean;
  /** Description comment for this hook */
  description?: string;
}

// ==================== HookCodeBuilder ====================

export class HookCodeBuilder {
  private config: BuilderConfig;

  constructor(hookId?: string) {
    this.config = {
      target: { expression: '' },
      capture: {},
      condition: {},
      store: {
        globalKey: '__hookStore',
        maxRecords: 500,
        console: true,
        consoleFormat: 'compact',
      },
      lifecycle: {},
      action: 'log',
      hookId: hookId || `hook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      asyncAware: false,
    };
  }

  // ==================== Chaining Configuration Methods ====================

  /** Set hook target */
  intercept(expression: string, label?: string): this {
    this.config.target = { expression, label: label || expression };
    return this;
  }

  /** Set hook ID */
  id(hookId: string): this {
    this.config.hookId = hookId;
    return this;
  }

  /** Set description */
  describe(description: string): this {
    this.config.description = description;
    return this;
  }

  /** Set action */
  action(action: HookAction): this {
    this.config.action = action;
    return this;
  }

  /** Capture arguments */
  captureArgs(): this {
    this.config.capture.args = true;
    return this;
  }

  /** Capture return value */
  captureReturn(): this {
    this.config.capture.returnValue = true;
    return this;
  }

  /** Capture call stack */
  captureStack(maxFrames?: number): this {
    this.config.capture.stack = maxFrames || true;
    return this;
  }

  /** Capture execution timing */
  captureTiming(): this {
    this.config.capture.timing = true;
    return this;
  }

  /** Capture this context */
  captureThis(): this {
    this.config.capture.thisContext = true;
    return this;
  }

  /** Capture all */
  captureAll(stackFrames?: number): this {
    this.config.capture = {
      args: true,
      returnValue: true,
      stack: stackFrames || 5,
      timing: true,
      thisContext: true,
    };
    return this;
  }

  /** Set condition expression */
  when(expression: string): this {
    this.config.condition.expression = expression;
    return this;
  }

  /** Set maximum call count */
  maxCalls(n: number): this {
    this.config.condition.maxCalls = n;
    return this;
  }

  /** Set minimum call interval */
  minInterval(ms: number): this {
    this.config.condition.minInterval = ms;
    return this;
  }

  /** Set URL match pattern */
  urlPattern(pattern: string): this {
    this.config.condition.urlPattern = pattern;
    return this;
  }

  /** Insert before lifecycle code */
  before(code: string): this {
    this.config.lifecycle.before = code;
    return this;
  }

  /** Insert after lifecycle code */
  after(code: string): this {
    this.config.lifecycle.after = code;
    return this;
  }

  /** Insert error handling code */
  onError(code: string): this {
    this.config.lifecycle.onError = code;
    return this;
  }

  /** Insert finally code */
  onFinally(code: string): this {
    this.config.lifecycle.onFinally = code;
    return this;
  }

  /** Completely replace the original function */
  replace(code: string): this {
    this.config.lifecycle.replace = code;
    return this;
  }

  /** Set storage configuration */
  storeTo(globalKey: string, maxRecords?: number): this {
    this.config.store.globalKey = globalKey;
    if (maxRecords !== undefined) this.config.store.maxRecords = maxRecords;
    return this;
  }

  /** Set console output */
  console(enabled: boolean, format?: StoreConfig['consoleFormat']): this {
    this.config.store.console = enabled;
    if (format) this.config.store.consoleFormat = format;
    return this;
  }

  /** Custom serialization */
  serializer(code: string): this {
    this.config.store.serializer = code;
    return this;
  }

  /** Enable async awareness (automatically await Promise return values) */
  async(enabled = true): this {
    this.config.asyncAware = enabled;
    return this;
  }

  /** Get current configuration (for debugging or serialization) */
  getConfig(): Readonly<BuilderConfig> {
    return { ...this.config };
  }

  /** Build from configuration object (for deserialization) */
  static fromConfig(config: BuilderConfig): HookCodeBuilder {
    const builder = new HookCodeBuilder();
    builder.config = { ...config };
    return builder;
  }

  // ==================== Code Generation ====================

  /**
   * Build the final hook code string
   * Generates a self-contained IIFE that can be directly injected into the browser
   */
  build(): string {
    if (!this.config.target.expression) {
      throw new Error('Hook target is required. Call .intercept() first.');
    }

    const { target, hookId, description, action, capture, condition, store, lifecycle, asyncAware } = this.config;
    const label = target.label || target.expression;

    // If in full replacement mode
    if (lifecycle.replace) {
      return this.buildReplaceHook();
    }

    const lines: string[] = [];

    // -- Header comments --
    lines.push(`// Hook: ${description || label}`);
    lines.push(`// ID: ${hookId}`);
    lines.push(`// Generated: ${new Date().toISOString()}`);
    lines.push(`(function() {`);
    lines.push(`  'use strict';`);
    lines.push(``);

    // -- Initialize global storage --
    lines.push(...this.buildStorageInit());

    // -- Save original reference --
    lines.push(`  const __original = ${target.expression};`);
    lines.push(`  if (typeof __original !== 'function') {`);
    lines.push(`    console.warn('[${hookId}] Target is not a function: ${label}');`);
    lines.push(`    return;`);
    lines.push(`  }`);
    lines.push(``);

    // -- Condition state variables --
    lines.push(...this.buildConditionState());

    // -- Hook function body --
    const isAsync = asyncAware;
    const fnKeyword = isAsync ? 'async function' : 'function';

    lines.push(`  ${target.expression} = ${fnKeyword}(...args) {`);

    // Condition check
    lines.push(...this.buildConditionCheck());

    // Build hookData
    lines.push(`    const hookData = {`);
    lines.push(`      hookId: '${hookId}',`);
    lines.push(`      target: '${label}',`);
    lines.push(`      timestamp: Date.now(),`);
    lines.push(`      callCount: __callCount,`);
    if (capture.args) lines.push(`      args: args,`);
    if (capture.thisContext) lines.push(`      thisArg: this,`);
    if (capture.stack) {
      const maxFrames = typeof capture.stack === 'number' ? capture.stack : 10;
      lines.push(`      stack: new Error().stack.split('\\n').slice(2, ${2 + maxFrames}).join('\\n'),`);
    }
    lines.push(`    };`);
    lines.push(``);

    // Console output (before call)
    if (store.console) {
      lines.push(...this.buildConsoleLog('called', store.consoleFormat || 'compact'));
    }

    // Before lifecycle
    if (lifecycle.before) {
      lines.push(`    // [before]`);
      lines.push(`    ${lifecycle.before}`);
      lines.push(``);
    }

    // action: block
    if (action === 'block') {
      lines.push(`    // [blocked]`);
      lines.push(`    hookData.blocked = true;`);
      lines.push(...this.buildStore());
      lines.push(`    return undefined;`);
    } else {
      // Execute original function (try-catch-finally)
      if (capture.timing) {
        lines.push(`    const __startTime = performance.now();`);
      }

      lines.push(`    try {`);
      const callExpr = isAsync
        ? `await __original.apply(this, args)`
        : `__original.apply(this, args)`;
      lines.push(`      const result = ${callExpr};`);

      if (capture.timing) {
        lines.push(`      hookData.duration = +(performance.now() - __startTime).toFixed(2);`);
      }
      if (capture.returnValue) {
        lines.push(`      hookData.returnValue = result;`);
      }

      // After lifecycle
      if (lifecycle.after) {
        lines.push(`      // [after]`);
        lines.push(`      ${lifecycle.after}`);
      }

      // Store
      lines.push(...this.buildStore().map(l => `  ${l}`));

      lines.push(`      return result;`);
      lines.push(`    } catch (error) {`);
      lines.push(`      hookData.error = error.message || String(error);`);

      if (lifecycle.onError) {
        lines.push(`      // [onError]`);
        lines.push(`      ${lifecycle.onError}`);
      }

      lines.push(...this.buildStore().map(l => `  ${l}`));
      lines.push(`      throw error;`);

      if (lifecycle.onFinally) {
        lines.push(`    } finally {`);
        lines.push(`      // [onFinally]`);
        lines.push(`      ${lifecycle.onFinally}`);
      }

      lines.push(`    }`);
    }

    lines.push(`  };`);
    lines.push(``);

    // Preserve original function properties
    lines.push(`  try { Object.defineProperty(${target.expression}, 'length', { value: __original.length }); } catch(e) {}`);
    lines.push(`  try { Object.defineProperty(${target.expression}, 'name', { value: __original.name }); } catch(e) {}`);
    lines.push(``);

    lines.push(`  console.log('[${hookId}] ✅ Hooked: ${label}');`);
    lines.push(`})();`);

    return lines.join('\n');
  }

  // ==================== Internal Build Methods ====================

  private buildReplaceHook(): string {
    const { target, hookId, lifecycle, description } = this.config;
    const label = target.label || target.expression;

    return [
      `// Hook (replace): ${description || label}`,
      `// ID: ${hookId}`,
      `(function() {`,
      `  'use strict';`,
      `  const __original = ${target.expression};`,
      `  ${target.expression} = function(...args) {`,
      `    const originalFn = __original.bind(this);`,
      `    ${lifecycle.replace}`,
      `  };`,
      `  console.log('[${hookId}] ✅ Replaced: ${label}');`,
      `})();`,
    ].join('\n');
  }

  private buildStorageInit(): string[] {
    const { store, hookId } = this.config;
    const key = store.globalKey || '__hookStore';
    return [
      `  if (!window.${key}) window.${key} = {};`,
      `  if (!window.${key}['${hookId}']) window.${key}['${hookId}'] = [];`,
      ``,
    ];
  }

  private buildConditionState(): string[] {
    const lines: string[] = [];
    lines.push(`  let __callCount = 0;`);

    if (this.config.condition.minInterval) {
      lines.push(`  let __lastCallTime = 0;`);
    }

    lines.push(``);
    return lines;
  }

  private buildConditionCheck(): string[] {
    const { condition, hookId } = this.config;
    const lines: string[] = [];

    lines.push(`    __callCount++;`);

    if (condition.maxCalls) {
      lines.push(`    if (__callCount > ${condition.maxCalls}) {`);
      lines.push(`      return __original.apply(this, args);`);
      lines.push(`    }`);
    }

    if (condition.minInterval) {
      lines.push(`    const __now = Date.now();`);
      lines.push(`    if (__now - __lastCallTime < ${condition.minInterval}) {`);
      lines.push(`      return __original.apply(this, args);`);
      lines.push(`    }`);
      lines.push(`    __lastCallTime = __now;`);
    }

    if (condition.expression) {
      lines.push(`    try {`);
      lines.push(`      const __conditionPassed = (function() { return ${condition.expression}; })();`);
      lines.push(`      if (!__conditionPassed) return __original.apply(this, args);`);
      lines.push(`    } catch (__condErr) {`);
      lines.push(`      console.warn('[${hookId}] Condition error:', __condErr.message);`);
      lines.push(`    }`);
    }

    lines.push(``);
    return lines;
  }

  private buildConsoleLog(phase: string, format: string): string[] {
    const { hookId } = this.config;
    const label = this.config.target.label || this.config.target.expression;

    if (format === 'json') {
      return [`    console.log(JSON.stringify(hookData));`];
    }
    if (format === 'compact') {
      return [`    console.log('[${hookId}] ${label} ${phase}', hookData);`];
    }
    // full
    return [
      `    console.group('[${hookId}] ${label} ${phase}');`,
      `    console.log('Data:', hookData);`,
      `    console.groupEnd();`,
    ];
  }

  private buildStore(): string[] {
    const { store, hookId } = this.config;
    const key = store.globalKey || '__hookStore';
    const max = store.maxRecords || 500;
    const lines: string[] = [];

    if (store.serializer) {
      lines.push(`    const __storeData = (function() { ${store.serializer} })(hookData);`);
    } else {
      lines.push(`    const __storeData = hookData;`);
    }

    lines.push(`    const __records = window.${key}['${hookId}'];`);
    lines.push(`    if (__records.length >= ${max}) __records.shift();`);
    lines.push(`    __records.push(__storeData);`);

    return lines;
  }
}
