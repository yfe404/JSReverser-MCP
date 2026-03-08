/**
 * HookManager — Unified Hook Manager
 *
 * Acts as a Facade for the hook module, providing:
 * - Create/generate hook scripts (based on HookCodeBuilder + HookTypeRegistry)
 * - Manage hook metadata (enable/disable, statistics)
 * - Data callback and export
 * - Anti-debug script generation
 *
 * Design principles:
 * - No hard-coded hook type logic (all delegated to plugins in the Registry)
 * - Users can build directly via the Builder or through declarative configuration
 * - Extensible: register new hook types at runtime
 */

import { HookCodeBuilder, type BuilderConfig } from './HookCodeBuilder.js';
import { HookTypeRegistry, type HookTypePlugin } from './HookTypeRegistry.js';

// ==================== Public Types ====================

export interface HookCreateOptions {
  /** Hook type name (corresponds to the plugin name in the registry) */
  type: string;
  /** Type-specific parameters (passed to the plugin as params) */
  params?: Record<string, unknown>;
  /** Hook ID (optional, auto-generated) */
  hookId?: string;
  /** Description */
  description?: string;
  /** Action: log (default) / block / modify / passthrough */
  action?: 'log' | 'block' | 'modify' | 'passthrough';
  /** Capture configuration */
  capture?: {
    args?: boolean;
    returnValue?: boolean;
    stack?: boolean | number;
    timing?: boolean;
    thisContext?: boolean;
  };
  /** Conditions */
  condition?: {
    expression?: string;
    maxCalls?: number;
    minInterval?: number;
    urlPattern?: string;
  };
  /** Lifecycle code */
  lifecycle?: {
    before?: string;
    after?: string;
    onError?: string;
    onFinally?: string;
    replace?: string;
  };
  /** Storage configuration */
  store?: {
    globalKey?: string;
    maxRecords?: number;
    console?: boolean;
    consoleFormat?: 'full' | 'compact' | 'json';
    serializer?: string;
  };
  /** Whether to enable async awareness */
  asyncAware?: boolean;
}

export interface HookMeta {
  hookId: string;
  type: string;
  description: string;
  enabled: boolean;
  createdAt: number;
  callCount: number;
  script: string;
  config: HookCreateOptions;
}

export interface HookDataRecord {
  hookId: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface HookManagerStats {
  totalHooks: number;
  enabledHooks: number;
  disabledHooks: number;
  registeredTypes: string[];
  hooks: Array<{
    hookId: string;
    type: string;
    description: string;
    enabled: boolean;
    callCount: number;
  }>;
}

// ==================== HookManager Class ====================

export class HookManager {
  private registry: HookTypeRegistry;
  private hooks: Map<string, HookMeta> = new Map();
  private hookData: Map<string, HookDataRecord[]> = new Map();
  private maxRecordsPerHook: number;

  constructor(maxRecordsPerHook = 1000) {
    this.registry = new HookTypeRegistry();
    this.maxRecordsPerHook = maxRecordsPerHook;
  }

  // ==================== Registry Proxy ====================

  /** Register a custom hook type */
  registerType(plugin: HookTypePlugin): void {
    this.registry.register(plugin);
  }

  /** Get all registered types */
  getRegisteredTypes(): HookTypePlugin[] {
    return this.registry.list();
  }

  /** Check if a type is registered */
  hasType(name: string): boolean {
    return this.registry.has(name);
  }

  // ==================== Create Hook ====================

  /**
   * Create a hook via declarative configuration.
   * This is the most common approach — pass in a config object to generate the script.
   */
  create(options: HookCreateOptions): { hookId: string; script: string } {
    const { type, params = {}, hookId: customId } = options;

    // Find plugin
    const plugin = this.registry.get(type);
    if (!plugin) {
      throw new Error(
        `Unknown hook type: "${type}". Available types: ${this.registry.list().map(p => p.name).join(', ')}`
      );
    }

    // Create builder and apply base configuration
    const hookId = customId || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const builder = new HookCodeBuilder(hookId);

    // Apply common configuration
    this.applyCommonConfig(builder, options);

    // Let the plugin inject type-specific configuration
    plugin.apply(builder, params);

    // Generate code
    let script: string;
    if (plugin.customBuild) {
      const customScript = plugin.customBuild(builder, params);
      script = customScript || builder.build();
    } else {
      script = builder.build();
    }

    // Save metadata
    const meta: HookMeta = {
      hookId,
      type,
      description: options.description || `${type} hook`,
      enabled: true,
      createdAt: Date.now(),
      callCount: 0,
      script,
      config: options,
    };
    this.hooks.set(hookId, meta);
    this.hookData.set(hookId, []);

    return { hookId, script };
  }

  /**
   * Create a hook via the Builder pattern (advanced usage).
   * Gives users maximum flexibility by directly operating on the builder.
   */
  createWithBuilder(
    builderFn: (builder: HookCodeBuilder) => HookCodeBuilder,
    meta?: { type?: string; description?: string }
  ): { hookId: string; script: string } {
    const builder = new HookCodeBuilder();
    const configured = builderFn(builder);
    const config = configured.getConfig();
    const script = configured.build();

    const hookMeta: HookMeta = {
      hookId: config.hookId,
      type: meta?.type || 'custom',
      description: meta?.description || config.description || 'Custom hook',
      enabled: true,
      createdAt: Date.now(),
      callCount: 0,
      script,
      config: { type: meta?.type || 'custom' },
    };

    this.hooks.set(config.hookId, hookMeta);
    this.hookData.set(config.hookId, []);

    return { hookId: config.hookId, script };
  }

  /**
   * Restore a hook from a serialized BuilderConfig.
   */
  createFromConfig(config: BuilderConfig): { hookId: string; script: string } {
    const builder = HookCodeBuilder.fromConfig(config);
    const script = builder.build();

    const hookMeta: HookMeta = {
      hookId: config.hookId,
      type: 'restored',
      description: config.description || 'Restored hook',
      enabled: true,
      createdAt: Date.now(),
      callCount: 0,
      script,
      config: { type: 'restored' },
    };

    this.hooks.set(config.hookId, hookMeta);
    this.hookData.set(config.hookId, []);

    return { hookId: config.hookId, script };
  }

  // ==================== Hook Management ====================

  /** Get hook metadata */
  getHook(hookId: string): HookMeta | undefined {
    return this.hooks.get(hookId);
  }

  /** Get all hooks */
  getAllHooks(): HookMeta[] {
    return Array.from(this.hooks.values());
  }

  /** Get the list of hookIds that have collected records (including hooks without metadata) */
  getRecordedHookIds(): string[] {
    return Array.from(this.hookData.keys());
  }

  /** Get all known hookIds (metadata + records) */
  getAllKnownHookIds(): string[] {
    const ids = new Set<string>([
      ...this.hooks.keys(),
      ...this.hookData.keys(),
    ]);
    return Array.from(ids);
  }

  /** Enable a hook */
  enable(hookId: string): boolean {
    const meta = this.hooks.get(hookId);
    if (!meta) return false;
    meta.enabled = true;
    return true;
  }

  /** Disable a hook */
  disable(hookId: string): boolean {
    const meta = this.hooks.get(hookId);
    if (!meta) return false;
    meta.enabled = false;
    return true;
  }

  /** Remove a hook */
  remove(hookId: string): boolean {
    this.hookData.delete(hookId);
    return this.hooks.delete(hookId);
  }

  /** Clear all hooks */
  clearAll(): void {
    this.hooks.clear();
    this.hookData.clear();
  }

  // ==================== Data Management ====================

  /** Record hook data (received from the browser) */
  addRecord(hookId: string, record: HookDataRecord): void {
    const meta = this.hooks.get(hookId);
    if (meta) meta.callCount++;

    let records = this.hookData.get(hookId);
    if (!records) {
      records = [];
      this.hookData.set(hookId, records);
    }

    if (records.length >= this.maxRecordsPerHook) {
      records.shift();
    }
    records.push(record);
  }

  /** Get all records for a hook */
  getRecords(hookId: string): HookDataRecord[] {
    return this.hookData.get(hookId) || [];
  }

  /** Clear records for a hook */
  clearRecords(hookId: string): void {
    this.hookData.set(hookId, []);
    const meta = this.hooks.get(hookId);
    if (meta) meta.callCount = 0;
  }

  /** Export all hook data */
  exportData(format: 'json' | 'csv' = 'json'): string {
    const allData: Record<string, unknown> = {};

    for (const [hookId, records] of this.hookData.entries()) {
      const meta = this.hooks.get(hookId);
      allData[hookId] = {
        meta: meta
          ? {
              type: meta.type,
              description: meta.description,
              enabled: meta.enabled,
              callCount: meta.callCount,
              createdAt: meta.createdAt,
            }
          : null,
        records,
      };
    }

    if (format === 'csv') {
      return this.toCsv(allData);
    }

    return JSON.stringify(allData, null, 2);
  }

  /** Get statistics */
  getStats(): HookManagerStats {
    const hooks = this.getAllHooks();
    return {
      totalHooks: hooks.length,
      enabledHooks: hooks.filter(h => h.enabled).length,
      disabledHooks: hooks.filter(h => !h.enabled).length,
      registeredTypes: this.registry.list().map(p => p.name),
      hooks: hooks.map(h => ({
        hookId: h.hookId,
        type: h.type,
        description: h.description,
        enabled: h.enabled,
        callCount: h.callCount,
      })),
    };
  }

  // ==================== Utility Scripts ====================

  /**
   * Generate an anti-debug bypass script.
   */
  generateAntiDebugBypass(): string {
    return [
      `// Anti-debug bypass`,
      `(function() {`,
      `  'use strict';`,
      ``,
      `  // 1. Disable debugger statements`,
      `  const __origEval = window.eval;`,
      `  // Rewrite Function constructor to strip debugger`,
      `  const __origFunction = window.Function;`,
      `  window.Function = function(...args) {`,
      `    if (args.length > 0) {`,
      `      args[args.length - 1] = String(args[args.length - 1]).replace(/debugger\\s*;?/g, '');`,
      `    }`,
      `    return new __origFunction(...args);`,
      `  };`,
      `  window.Function.prototype = __origFunction.prototype;`,
      ``,
      `  // 2. Override console detection`,
      `  const __noop = function() {};`,
      `  ['log', 'warn', 'error', 'info', 'debug', 'table', 'dir', 'trace'].forEach(function(m) {`,
      `    const orig = console[m];`,
      `    Object.defineProperty(console[m], 'toString', { value: function() { return 'function ' + m + '() { [native code] }'; } });`,
      `  });`,
      ``,
      `  // 3. Block setInterval debugger`,
      `  const __origSetInterval = window.setInterval;`,
      `  window.setInterval = function(fn, delay, ...rest) {`,
      `    const fnStr = typeof fn === 'function' ? fn.toString() : String(fn);`,
      `    if (fnStr.includes('debugger')) {`,
      `      return __origSetInterval.call(window, __noop, delay, ...rest);`,
      `    }`,
      `    return __origSetInterval.call(window, fn, delay, ...rest);`,
      `  };`,
      ``,
      `  // 4. Block setTimeout debugger`,
      `  const __origSetTimeout = window.setTimeout;`,
      `  window.setTimeout = function(fn, delay, ...rest) {`,
      `    const fnStr = typeof fn === 'function' ? fn.toString() : String(fn);`,
      `    if (fnStr.includes('debugger')) {`,
      `      return __origSetTimeout.call(window, __noop, delay, ...rest);`,
      `    }`,
      `    return __origSetTimeout.call(window, fn, delay, ...rest);`,
      `  };`,
      ``,
      `  // 5. Override DevTools detection methods`,
      `  Object.defineProperty(window, 'outerHeight', { get() { return window.innerHeight; } });`,
      `  Object.defineProperty(window, 'outerWidth', { get() { return window.innerWidth; } });`,
      ``,
      `  console.log('[anti-debug] ✅ Anti-debug bypass injected');`,
      `})();`,
    ].join('\n');
  }

  /**
   * Generate a browser-side data collection helper script.
   * Used to extract hook data in the browser.
   */
  generateDataCollectorScript(storeKey = '__hookStore'): string {
    return [
      `// Hook data collector`,
      `(function() {`,
      `  window.__getHookData = function(hookId) {`,
      `    const store = window.${storeKey} || {};`,
      `    if (hookId) return store[hookId] || [];`,
      `    return store;`,
      `  };`,
      `  window.__clearHookData = function(hookId) {`,
      `    const store = window.${storeKey};`,
      `    if (!store) return;`,
      `    if (hookId) { store[hookId] = []; } else {`,
      `      Object.keys(store).forEach(function(k) { store[k] = []; });`,
      `    }`,
      `  };`,
      `  window.__getHookStats = function() {`,
      `    const store = window.${storeKey} || {};`,
      `    const stats = {};`,
      `    Object.keys(store).forEach(function(k) {`,
      `      stats[k] = { count: store[k].length, latest: store[k][store[k].length - 1] };`,
      `    });`,
      `    return stats;`,
      `  };`,
      `})();`,
    ].join('\n');
  }

  // ==================== Internal Methods ====================

  private applyCommonConfig(builder: HookCodeBuilder, options: HookCreateOptions): void {
    if (options.description) builder.describe(options.description);
    if (options.action) builder.action(options.action);
    if (options.asyncAware) builder.async(options.asyncAware);

    // Capture
    const cap = options.capture;
    if (cap) {
      if (cap.args) builder.captureArgs();
      if (cap.returnValue) builder.captureReturn();
      if (cap.stack) builder.captureStack(typeof cap.stack === 'number' ? cap.stack : undefined);
      if (cap.timing) builder.captureTiming();
      if (cap.thisContext) builder.captureThis();
    }

    // Conditions
    const cond = options.condition;
    if (cond) {
      if (cond.expression) builder.when(cond.expression);
      if (cond.maxCalls) builder.maxCalls(cond.maxCalls);
      if (cond.minInterval) builder.minInterval(cond.minInterval);
      if (cond.urlPattern) builder.urlPattern(cond.urlPattern);
    }

    // Lifecycle
    const lc = options.lifecycle;
    if (lc) {
      if (lc.before) builder.before(lc.before);
      if (lc.after) builder.after(lc.after);
      if (lc.onError) builder.onError(lc.onError);
      if (lc.onFinally) builder.onFinally(lc.onFinally);
      if (lc.replace) builder.replace(lc.replace);
    }

    // Storage
    const st = options.store;
    if (st) {
      if (st.globalKey || st.maxRecords) builder.storeTo(st.globalKey || '__hookStore', st.maxRecords);
      if (st.console !== undefined || st.consoleFormat) builder.console(st.console ?? true, st.consoleFormat);
      if (st.serializer) builder.serializer(st.serializer);
    }
  }

  private toCsv(allData: Record<string, unknown>): string {
    const lines: string[] = ['hookId,type,timestamp,target,data'];

    for (const [hookId, info] of Object.entries(allData)) {
      const records = (info as Record<string, unknown>).records as HookDataRecord[];
      if (!records) continue;
      for (const rec of records) {
        const target = (rec.target as string) || '';
        const dataStr = JSON.stringify(rec).replace(/"/g, '""');
        lines.push(`"${hookId}","${target}",${rec.timestamp},"${target}","${dataStr}"`);
      }
    }

    return lines.join('\n');
  }
}
