
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */


/**
 * Core type definitions
 */

import type { Browser, Page } from 'puppeteer';

// ==================== Configuration Types ====================

export interface Config {
  llm: LLMConfig;
  puppeteer: PuppeteerConfig;
  mcp: MCPConfig;
  cache: CacheConfig;
  performance: PerformanceConfig;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  openai?: {
    apiKey: string;
    model: string;
    baseURL?: string;
  };
  anthropic?: {
    apiKey: string;
    model: string;
  };
}

export interface PuppeteerConfig {
  headless: boolean;
  timeout: number;
  args?: string[];
  // New configurable options
  viewport?: { width: number; height: number };
  userAgent?: string;
  maxCollectedUrls?: number;
  // Limits to prevent MCP token overflow
  maxFilesPerCollect?: number;      // Max files per collection (default 50)
  maxTotalContentSize?: number;     // Max total size per response (default 512KB)
  maxSingleFileSize?: number;       // Max single file size (default 100KB)
  useExternalBrowser?: boolean;
  remoteDebuggingUrl?: string;
  userDataDir?: string;
  useStealthScripts?: boolean;
  reuseEnvironmentPerSession?: boolean;
  autoLaunchExternalBrowser?: boolean;
  externalBrowserPath?: string;
  externalBrowserArgs?: string[];
}

export interface MCPConfig {
  name: string;
  version: string;
}

export interface CacheConfig {
  enabled: boolean;
  dir: string;
  ttl: number;
}

export interface PerformanceConfig {
  maxConcurrentAnalysis: number;
  maxCodeSizeMB: number;
}

// ==================== Code Collection Types ====================

export interface CollectCodeOptions {
  url: string;
  depth?: number;
  timeout?: number;
  includeInline?: boolean;
  includeExternal?: boolean;
  includeDynamic?: boolean;
  includeServiceWorker?: boolean;
  includeWebWorker?: boolean;
  filterRules?: string[]; // URL filter rules

  // Smart collection options
  smartMode?: 'summary' | 'priority' | 'incremental' | 'full'; // Smart collection mode
  compress?: boolean; // Whether to compress code
  streaming?: boolean; // Whether to use streaming transfer
  maxTotalSize?: number; // Max total size (bytes)
  maxFileSize?: number; // Max single file size
  priorities?: string[]; // Priority URL patterns
  dynamicWaitMs?: number; // Extra wait time for dynamic scripts (ms)
}

export interface CodeFile {
  url: string;
  content: string;
  size: number;
  type: 'inline' | 'external' | 'dynamic' | 'service-worker' | 'web-worker';
  loadTime?: number;
  metadata?: Record<string, unknown>; // Additional metadata
}

export interface CollectCodeResult {
  files: CodeFile[];
  dependencies: DependencyGraph;
  totalSize: number;
  collectTime: number;
  summaries?: Array<{
    url: string;
    size: number;
    type: string;
    hasEncryption: boolean;
    hasAPI: boolean;
    hasObfuscation: boolean;
    functions: string[];
    imports: string[];
    preview: string;
  }>; // Smart collection summary mode return
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  url: string;
  type: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'require' | 'script';
}

// ==================== Deobfuscation Types ====================

export interface DeobfuscateOptions {
  code: string;
  llm?: 'gpt-4' | 'claude';
  aggressive?: boolean; // Enable aggressive deobfuscation (control flow flattening recovery, etc.)
  preserveLogic?: boolean; // Preserve original logic
  renameVariables?: boolean; // Rename variables to meaningful names
  inlineFunctions?: boolean; // Inline simple functions
}

export interface DeobfuscateResult {
  code: string;
  readabilityScore: number;
  confidence: number;
  obfuscationType: ObfuscationType[];
  transformations: Transformation[];
  analysis: string;

  /**
   * Warnings/analysis info from all sub-pipelines; external AI can use these for further reasoning.
   * Includes: encoding mechanism analysis, VM structure identification, instruction mapping, LLM intermediate analysis, etc.
   */
  warnings?: string[];

  /**
   * Parts that could not be fully recovered, with location, reason, and suggestions.
   * External AI can use these to decide whether to perform targeted secondary analysis.
   */
  unresolvedParts?: UnresolvedPart[];
}

export type ObfuscationType =
  | 'javascript-obfuscator' // obfuscator.io (most common)
  | 'webpack' // Webpack bundle obfuscation
  | 'uglify' // UglifyJS compression
  | 'vm-protection' // VM virtual machine protection
  | 'self-modifying' // Self-modifying code
  | 'invisible-unicode' // Invisible Unicode obfuscation (2025 new technique)
  | 'control-flow-flattening' // Control flow flattening
  | 'string-array-rotation' // String array rotation
  | 'dead-code-injection' // Dead code injection
  | 'opaque-predicates' // Opaque predicates
  | 'jsfuck' // JSFuck encoding ([]()!+)
  | 'aaencode' // AAEncode (emoticon encoding)
  | 'jjencode' // JJEncode
  | 'packer' // Dean Edwards Packer
  | 'eval-obfuscation' // eval obfuscation
  | 'base64-encoding' // Base64 encoding
  | 'hex-encoding' // Hexadecimal encoding
  | 'jscrambler' // JScrambler commercial obfuscation
  | 'urlencoded' // URL encoding obfuscation
  | 'custom' // Custom/modified obfuscation
  | 'unknown';

export interface Transformation {
  type: string;
  description: string;
  success: boolean;
  /** Detailed analysis data from sub-pipelines for external AI reasoning (JSON-serializable) */
  detail?: Record<string, unknown>;
}

// ==================== Code Understanding Types ====================

export interface UnderstandCodeOptions {
  code: string;
  context?: Record<string, unknown>;
  focus?: 'structure' | 'business' | 'security' | 'all';
}

export interface UnderstandCodeResult {
  structure: CodeStructure;
  techStack: TechStack;
  businessLogic: BusinessLogic;
  dataFlow: DataFlow;
  securityRisks: SecurityRisk[];
  qualityScore: number;
  // New fields - code pattern and complexity analysis
  codePatterns?: Array<{
    name: string;
    location: number;
    description: string;
  }>;
  antiPatterns?: Array<{
    name: string;
    location: number;
    severity: string;
    recommendation: string;
  }>;
  complexityMetrics?: {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    maintainabilityIndex: number;
    halsteadMetrics: {
      vocabulary: number;
      length: number;
      difficulty: number;
      effort: number;
    };
  };
}

export interface CodeStructure {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  modules: ModuleInfo[];
  callGraph: CallGraph;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  returnType?: string;
  location: CodeLocation;
  complexity: number;
}

export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  location: CodeLocation;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  value?: unknown;
}

export interface ModuleInfo {
  name: string;
  exports: string[];
  imports: string[];
}

export interface CallGraph {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
}

export interface CallGraphNode {
  id: string;
  name: string;
  type: 'function' | 'method' | 'constructor';
}

export interface CallGraphEdge {
  from: string;
  to: string;
  callCount?: number;
}

export interface TechStack {
  framework?: string;
  bundler?: string;
  uiLibrary?: string;
  stateManagement?: string;
  cryptoLibrary?: string[];
  other: string[];
}

export interface BusinessLogic {
  mainFeatures: string[];
  entities: string[];
  rules: string[];
  dataModel: Record<string, unknown>;
}

export interface DataFlow {
  graph: DataFlowGraph;
  sources: DataSource[];
  sinks: DataSink[];
  taintPaths: TaintPath[];
}

export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
}

export interface DataFlowNode {
  id: string;
  type: 'source' | 'sink' | 'transform';
  name: string;
  location: CodeLocation;
}

export interface DataFlowEdge {
  from: string;
  to: string;
  data: string;
}

export interface DataSource {
  type: 'user_input' | 'storage' | 'network' | 'other';
  location: CodeLocation;
}

export interface DataSink {
  type: 'dom' | 'network' | 'storage' | 'eval' | 'xss' | 'sql-injection' | 'other';
  location: CodeLocation;
}

export interface TaintPath {
  source: DataSource;
  sink: DataSink;
  path: CodeLocation[]; // Taint propagation path
  risk?: 'high' | 'medium' | 'low';
}

export interface SecurityRisk {
  type: 'xss' | 'sql-injection' | 'csrf' | 'sensitive-data' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: CodeLocation;
  description: string;
  recommendation: string;
}

export interface CodeLocation {
  file: string;
  line: number;
  column?: number;
}

// ==================== Crypto Detection Types ====================

export interface DetectCryptoOptions {
  code: string;
  testData?: unknown;
}

export interface DetectCryptoResult {
  algorithms: CryptoAlgorithm[];
  libraries: CryptoLibrary[];
  confidence: number;
}

export interface CryptoAlgorithm {
  name: string;
  type: 'symmetric' | 'asymmetric' | 'hash' | 'encoding';
  confidence: number;
  location: CodeLocation;
  parameters?: CryptoParameters;
  usage: string;
}

export interface CryptoParameters {
  key?: string;
  iv?: string;
  mode?: string;
  padding?: string;
}

export interface CryptoLibrary {
  name: string;
  version?: string;
  confidence: number;
}

// ==================== Hook Management Types ====================
// Core types are exported from modules/hook; this retains the compatibility layer and common interfaces

/**
 * Hook creation options (declarative configuration)
 * See modules/hook/HookManager.ts for detailed type definitions
 */
export interface HookOptions {
  /** Hook type (corresponds to plugin name in the registry) */
  type: string;
  /** Hook target (function name, API name, etc.) */
  target?: string;
  /** Action: log / block / modify / passthrough */
  action?: 'log' | 'block' | 'modify' | 'passthrough';
  /** Custom code */
  customCode?: string;
  /** Condition configuration */
  condition?: HookCondition;
  /** Whether to enable performance monitoring */
  performance?: boolean;
  /** Type-specific parameters */
  params?: Record<string, unknown>;
  /** Capture options */
  capture?: {
    args?: boolean;
    returnValue?: boolean;
    stack?: boolean | number;
    timing?: boolean;
    thisContext?: boolean;
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
  };
  /** Description */
  description?: string;
}

export interface HookCondition {
  /** JS condition expression */
  expression?: string;
  /** Maximum call count */
  maxCalls?: number;
  /** Minimum call interval (ms) */
  minInterval?: number;
  /** URL match pattern */
  urlPattern?: string;
}

export type HookHandler = (context: HookContext) => void | Promise<void>;

export interface HookContext {
  hookId: string;
  target: string;
  args?: unknown[];
  returnValue?: unknown;
  stack?: string;
  timestamp: number;
  callCount?: number;
  duration?: number;
  [key: string]: unknown;
}

export interface HookResult {
  hookId: string;
  script: string;
  description?: string;
  type?: string;
}

export interface HookRecord {
  hookId: string;
  timestamp: number;
  [key: string]: unknown;
}

// ==================== Browser Context Types ====================

export interface BrowserContext {
  browser: Browser;
  page: Page;
  url: string;
}

// ==================== Generic Result Types ====================

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==================== Session Types ====================

export interface Session {
  id: string;
  url: string;
  createdAt: number;
  updatedAt: number;
  data: SessionData;
}

export interface SessionData {
  code?: CollectCodeResult;
  deobfuscated?: DeobfuscateResult;
  analysis?: UnderstandCodeResult;
  crypto?: DetectCryptoResult;
  hooks?: HookRecord[];
}

// ==================== Environment Patching Types ====================

/**
 * Detected environment variables result
 */
export interface DetectedEnvironmentVariables {
  window: string[];      // window object properties
  document: string[];    // document object properties
  navigator: string[];   // navigator object properties
  location: string[];    // location object properties
  screen: string[];      // screen object properties
  other: string[];       // Other global objects
}

/**
 * Missing API information
 */
export interface MissingAPI {
  name: string;          // API name
  type: 'function' | 'object' | 'property';
  path: string;          // Full path, e.g. 'window.navigator.userAgent'
  suggestion: string;    // Patching suggestion
}

/**
 * Environment patching code
 */
export interface EmulationCode {
  nodejs: string;        // Node.js environment patching code
  python: string;        // Python + execjs environment patching code
}

/**
 * Environment patching analysis options
 */
export interface EnvironmentEmulatorOptions {
  code: string;                    // Code to analyze
  targetRuntime?: 'nodejs' | 'python' | 'both';  // Target runtime
  autoFetch?: boolean;             // Whether to auto-fetch real values from browser
  browserUrl?: string;             // Browser URL (for extracting environment variables)
  browserType?: 'chrome' | 'firefox' | 'safari';  // Browser type
  includeComments?: boolean;       // Whether generated code includes comments
  extractDepth?: number;           // Environment variable extraction depth (default 3 levels)
  useAI?: boolean;                 // Whether to use AI analysis (default true)
}

/**
 * Environment patching result
 */
export interface EnvironmentEmulatorResult {
  // Detected environment variables (grouped by category)
  detectedVariables: DetectedEnvironmentVariables;

  // Generated environment patching code
  emulationCode: EmulationCode;

  // Missing API list (requires manual patching)
  missingAPIs: MissingAPI[];

  // Environment variable manifest (JSON format, exportable)
  variableManifest: Record<string, any>;

  // Patching recommendations
  recommendations: string[];

  // Statistics
  stats: {
    totalVariables: number;
    autoFilledVariables: number;
    manualRequiredVariables: number;
  };

  // AI analysis result (optional)
  aiAnalysis?: any;
}

// ==================== JSVMP Deobfuscation Types ====================

/**
 * Virtual machine type
 */
export type VMType = 'custom' | 'obfuscator.io' | 'jsfuck' | 'jjencode' | 'unknown';

/**
 * Instruction type
 */
export type InstructionType = 'load' | 'store' | 'arithmetic' | 'control' | 'call' | 'unknown';

/**
 * Complexity level
 */
export type ComplexityLevel = 'low' | 'medium' | 'high';

/**
 * VM instruction information
 */
export interface VMInstruction {
  opcode: number | string;       // Opcode
  name: string;                  // Instruction name (inferred)
  type: InstructionType;
  description: string;           // Instruction description
  args?: number;                 // Number of arguments
}

/**
 * VM feature information
 */
export interface VMFeatures {
  instructionCount: number;      // Number of instructions
  interpreterLocation: string;   // Interpreter location (line number)
  complexity: ComplexityLevel;   // Complexity
  hasSwitch: boolean;            // Whether it has a large switch
  hasInstructionArray: boolean;  // Whether it has an instruction array
  hasProgramCounter: boolean;    // Whether it has a program counter
}

/**
 * Unresolved part information
 */
export interface UnresolvedPart {
  location: string;              // Location (line number or function name)
  reason: string;                // Reason for not being resolved
  suggestion?: string;           // Suggestion
}

/**
 * JSVMP deobfuscation options
 */
export interface JSVMPDeobfuscatorOptions {
  code: string;                  // Code to deobfuscate
  aggressive?: boolean;          // Whether to use aggressive mode
  extractInstructions?: boolean; // Whether to extract instruction set
  timeout?: number;              // Timeout (milliseconds)
  maxIterations?: number;        // Maximum iterations
}

/**
 * JSVMP deobfuscation result
 */
export interface JSVMPDeobfuscatorResult {
  // Whether it is JSVMP obfuscation
  isJSVMP: boolean;

  // Virtual machine type (if identifiable)
  vmType?: VMType;

  // Virtual machine features
  vmFeatures?: VMFeatures;

  // Extracted instruction set (if extractInstructions=true)
  instructions?: VMInstruction[];

  // Recovered code
  deobfuscatedCode: string;

  // Recovery confidence (0-1)
  confidence: number;

  // Warnings during recovery
  warnings: string[];

  // Parts that could not be recovered (if any)
  unresolvedParts?: UnresolvedPart[];

  // Statistics
  stats?: {
    originalSize: number;
    deobfuscatedSize: number;
    reductionRate: number;
    processingTime: number;
  };
}

// ==================== Debugger Enhanced Types ====================

/**
 * Scope variable
 */
export interface ScopeVariable {
  name: string;
  value: any;
  type: string;
  scope: 'global' | 'local' | 'with' | 'closure' | 'catch' | 'block' | 'script' | 'eval' | 'module';
  writable?: boolean;
  configurable?: boolean;
  enumerable?: boolean;
  objectId?: string; // For further object property inspection
}

/**
 * Breakpoint hit event
 */
export interface BreakpointHitEvent {
  breakpointId: string;
  breakpointInfo?: any; // BreakpointInfo from DebuggerManager
  location: {
    scriptId: string;
    lineNumber: number;
    columnNumber: number;
    url?: string;
  };
  callFrames: any[]; // CallFrame[]
  timestamp: number;
  variables?: ScopeVariable[]; // Auto-captured top-level scope variables
  reason: string;
}

/**
 * Breakpoint hit callback function
 */
export type BreakpointHitCallback = (event: BreakpointHitEvent) => void | Promise<void>;

/**
 * Debug session data (for save/restore)
 */
export interface DebuggerSession {
  version: string; // Session format version (currently 1.0)
  timestamp: number; // Creation timestamp
  breakpoints: Array<{
    location: {
      scriptId?: string;
      url?: string;
      lineNumber: number;
      columnNumber?: number;
    };
    condition?: string;
    enabled: boolean;
  }>;
  pauseOnExceptions: 'none' | 'uncaught' | 'all';
  metadata?: {
    url?: string; // Page URL being debugged
    description?: string; // Session description
    tags?: string[]; // Tags
    [key: string]: any; // Other custom metadata
  };
}

/**
 * Scope variable retrieval options
 */
export interface GetScopeVariablesOptions {
  callFrameId?: string; // Specify call frame ID; if not specified, gets top frame
  includeObjectProperties?: boolean; // Whether to expand object properties (default false)
  maxDepth?: number; // Max depth for object property expansion (default 1)
  skipErrors?: boolean; // Whether to skip errored scopes (default true)
}

/**
 * Scope variable retrieval result
 */
export interface GetScopeVariablesResult {
  success: boolean;
  variables: ScopeVariable[];
  callFrameId: string;
  callFrameInfo?: {
    functionName: string;
    location: string;
  };
  errors?: Array<{
    scope: string;
    error: string;
  }>;
  totalScopes: number;
  successfulScopes: number;
}

// ==================== Reverse Task Artifacts ====================

export interface ReverseTaskStoreOptions {
  rootDir?: string;
}

export interface ReverseTaskOpenInput {
  taskId: string;
  slug: string;
  targetUrl: string;
  goal: string;
}

export interface ReverseTaskDescriptor {
  taskId: string;
  slug: string;
  targetUrl: string;
  goal: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReverseTaskEvent {
  stage: string;
  action: string;
  status: string;
  [key: string]: unknown;
}

export interface ReverseTaskHandle {
  taskId: string;
  taskDir: string;
  descriptor: ReverseTaskDescriptor;
  appendTimeline(event: ReverseTaskEvent): Promise<void>;
  appendLog(name: string, value: Record<string, unknown>): Promise<void>;
  writeSnapshot(name: string, value: unknown): Promise<void>;
}

export interface ReverseTaskReadApi {
  getTaskDir(taskId: string): string;
  readSnapshot<T>(taskId: string, name: string): Promise<T | undefined>;
  readLog(name: string, taskId: string): Promise<Record<string, unknown>[]>;
}

// ==================== Global Type Extensions ====================

declare global {
  interface Window {
    __aiHooks?: Record<string, any[]>;
    __aiHookMetadata?: Record<string, {
      id: string;
      createdAt: number;
      enabled: boolean;
    }>;
  }
}
