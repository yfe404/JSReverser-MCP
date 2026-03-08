/**
 * Hook module public exports
 */

// Core builder
export { HookCodeBuilder } from './HookCodeBuilder.js';
export type {
  HookTarget,
  CaptureOptions,
  ConditionConfig,
  StoreConfig,
  LifecycleCode,
  HookAction,
  BuilderConfig,
} from './HookCodeBuilder.js';

// Type registry
export { HookTypeRegistry } from './HookTypeRegistry.js';
export type { HookTypePlugin } from './HookTypeRegistry.js';

// Hook manager
export { HookManager } from './HookManager.js';
export type {
  HookCreateOptions,
  HookMeta,
  HookDataRecord,
  HookManagerStats,
} from './HookManager.js';

// AI Hook generator
export { AIHookGenerator } from './AIHookGenerator.js';
export type {
  AIHookRequest,
  AIHookTarget,
  AIHookBehavior,
  AIHookCondition,
  AIHookCustomCode,
  AIHookResult,
} from './AIHookGenerator.js';
