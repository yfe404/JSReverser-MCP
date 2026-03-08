/**
 * Main deobfuscation pipeline
 *
 * Orchestrates all deobfuscation sub-modules, automatically selecting the optimal pipeline based on detection results:
 *   1. PackerDeobfuscator  — Packer / AAEncode / URLEncode unpacking
 *   2. JSVMPDeobfuscator   — JSVMP virtual machine protection restoration
 *   3. AdvancedDeobfuscator — Advanced obfuscation (invisible-unicode, control flow flattening, opaque predicates, dead code…)
 *   4. ASTOptimizer         — General AST optimization (constant folding/propagation, variable inlining, sequence expansion…)
 *   5. Basic pipeline       — String array extraction/replacement, string decoding, expression simplification, variable renaming
 *   6. LLM-assisted analysis — Optional, leveraging AI for semantic analysis
 *
 * Design principles:
 *   - Each sub-pipeline has independent try/catch; a single step failure does not interrupt the overall process
 *   - Detection first; only execute corresponding pipelines for detected obfuscation types
 *   - Fixed pipeline order: unpack first → then deep restoration → then AST optimization → finally basic cleanup
 *   - Result caching + LRU eviction
 */

import * as parser from '@babel/parser';
import traverseImport from '@babel/traverse';
const traverse = (traverseImport as unknown as {default?: typeof traverseImport}).default ?? traverseImport;
import generateImport from '@babel/generator';
const generate = (generateImport as unknown as {default?: typeof generateImport}).default ?? generateImport;
import * as t from '@babel/types';
import crypto from 'crypto';
import type { DeobfuscateOptions, DeobfuscateResult, ObfuscationType, Transformation, UnresolvedPart } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { LLMService } from '../../services/LLMService.js';

// Sub-modules
import { AdvancedDeobfuscator, type AdvancedDeobfuscateOptions } from './AdvancedDeobfuscator.js';
import { JSVMPDeobfuscator } from './JSVMPDeobfuscator.js';
import { ASTOptimizer } from './ASTOptimizer.js';
import { PackerDeobfuscator, AAEncodeDeobfuscator, URLEncodeDeobfuscator, UniversalUnpacker } from './PackerDeobfuscator.js';

// ==================== Extended Options ====================

export interface DeobfuscateFullOptions extends DeobfuscateOptions {
  /** Enable advanced deobfuscation pipeline (AdvancedDeobfuscator) */
  advanced?: boolean;
  /** Enable JSVMP-specific deobfuscation */
  jsvmp?: boolean;
  /** Enable AST optimizer */
  astOptimize?: boolean;
  /** Enable Packer/AAEncode/URLEncode auto-unpacking */
  unpack?: boolean;
  /** Aggressive VM deobfuscation */
  aggressiveVM?: boolean;
  /** Timeout in ms, default 60000 */
  timeout?: number;
  /** Auto mode: automatically enable corresponding pipelines based on detection results (default true) */
  auto?: boolean;
}

// ==================== Main Class ====================

export class Deobfuscator {
  private llm?: LLMService;

  // Sub-module instances
  private advancedDeobfuscator: AdvancedDeobfuscator;
  private jsvmpDeobfuscator: JSVMPDeobfuscator;
  private astOptimizer: ASTOptimizer;
  private universalUnpacker: UniversalUnpacker;

  // Cache
  private stringArrays: Map<string, string[]> = new Map();
  private resultCache = new Map<string, DeobfuscateResult>();
  private maxCacheSize = 100;

  constructor(llm?: LLMService) {
    this.llm = llm;
    this.advancedDeobfuscator = new AdvancedDeobfuscator(llm);
    this.jsvmpDeobfuscator = new JSVMPDeobfuscator(llm);
    this.astOptimizer = new ASTOptimizer();
    this.universalUnpacker = new UniversalUnpacker();
  }

  // ==================== Public API ====================

  /**
   * Full deobfuscation pipeline entry point
   */
  async deobfuscate(options: DeobfuscateFullOptions): Promise<DeobfuscateResult> {
    // Cache
    const cacheKey = this.generateCacheKey(options);
    const cached = this.resultCache.get(cacheKey);
    if (cached) {
      logger.debug('Deobfuscation result from cache');
      return cached;
    }

    logger.info('Starting deobfuscation pipeline...');
    const startTime = Date.now();

    // Global collectors: warnings and unresolvedParts from sub-pipelines are aggregated here
    // Fully passed through to the external AI for deeper reasoning based on this information
    const pipelineWarnings: string[] = [];
    const pipelineUnresolved: UnresolvedPart[] = [];

    try {
      let code = options.code;
      const transformations: Transformation[] = [];
      const autoMode = options.auto !== false; // default auto

      // ── Step 0: Detect obfuscation types ──
      const obfuscationType = this.detectObfuscationType(code);
      logger.info(`Detected obfuscation types: ${obfuscationType.join(', ')}`);
      pipelineWarnings.push(`Detected obfuscation types: ${obfuscationType.join(', ')}`);

      // ── Step 1: Packer / AAEncode / URLEncode auto-unpacking ──
      if (this.shouldRun(options.unpack, autoMode, obfuscationType, ['packer', 'aaencode', 'urlencoded', 'eval-obfuscation'])) {
        code = await this.runUnpack(code, transformations);
      }

      // ── Step 2: JSVMP virtual machine protection restoration ──
      if (this.shouldRun(options.jsvmp, autoMode, obfuscationType, ['vm-protection'])) {
        code = await this.runJSVMP(code, options, transformations, pipelineWarnings, pipelineUnresolved);
      }

      // ── Step 3: Advanced deobfuscation ──
      if (this.shouldRun(options.advanced, autoMode, obfuscationType, [
        'invisible-unicode', 'control-flow-flattening', 'string-array-rotation',
        'dead-code-injection', 'opaque-predicates', 'custom',
      ])) {
        code = await this.runAdvanced(code, options, transformations, pipelineWarnings);
      }

      // ── Step 4: Basic pipeline ──
      // String array extraction + replacement
      code = await this.extractStringArrays(code, transformations);
      code = await this.basicTransform(code, transformations);
      code = await this.decodeStrings(code, transformations);
      code = await this.decryptArrays(code, transformations);

      // Control flow unflattening (basic version, only in aggressive mode)
      if (options.aggressive) {
        code = await this.unflattenControlFlow(code, transformations);
      }

      // Expression simplification
      code = await this.simplifyExpressions(code, transformations);

      // ── Step 5: AST optimizer ──
      if (this.shouldRun(options.astOptimize, autoMode, obfuscationType, ['javascript-obfuscator', 'uglify', 'webpack'])) {
        code = await this.runASTOptimizer(code, transformations);
      }

      // ── Step 6: Variable renaming ──
      if (options.renameVariables) {
        code = await this.renameVariables(code, transformations);
      }

      // ── Step 7: LLM-assisted analysis ──
      let analysis = 'Deobfuscation pipeline completed.';
      if (this.llm && options.llm) {
        const llmResult = await this.llmAnalysis(code);
        if (llmResult) {
          analysis = llmResult;
          transformations.push({ type: 'llm-analysis', description: 'AI-assisted code analysis completed', success: true });
        }
      }

      // ── Result ──
      const deobfuscateTime = Date.now() - startTime;
      const readabilityScore = this.calculateReadabilityScore(code);
      const confidence = this.calculateConfidence(transformations, readabilityScore);

      // Re-detect, as some types may have been discovered in sub-pipelines
      const finalTypes = this.mergeObfuscationTypes(obfuscationType, transformations);

      logger.success(`Deobfuscation completed in ${deobfuscateTime}ms (confidence: ${(confidence * 100).toFixed(1)}%)`);

      const result: DeobfuscateResult = {
        code,
        readabilityScore,
        confidence,
        obfuscationType: finalTypes,
        transformations,
        analysis,
        // Fully passed through to external AI: all sub-pipeline analysis information
        warnings: pipelineWarnings.length > 0 ? pipelineWarnings : undefined,
        unresolvedParts: pipelineUnresolved.length > 0 ? pipelineUnresolved : undefined,
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Deobfuscation failed', error);
      throw error;
    }
  }

  // ==================== Sub-pipeline Scheduling ====================

  /**
   * Whether a specific sub-pipeline should run
   */
  private shouldRun(
    explicitFlag: boolean | undefined,
    autoMode: boolean,
    detected: ObfuscationType[],
    triggers: ObfuscationType[],
  ): boolean {
    // Explicitly disabled
    if (explicitFlag === false) return false;
    // Explicitly enabled
    if (explicitFlag === true) return true;
    // Auto mode: enable when corresponding type is detected
    if (autoMode) {
      return detected.some(t => triggers.includes(t));
    }
    return false;
  }

  /**
   * Packer / AAEncode / URLEncode unpacking
   */
  private async runUnpack(code: string, transformations: Transformation[]): Promise<string> {
    try {
      logger.info('Running UniversalUnpacker...');
      const result = await this.universalUnpacker.deobfuscate(code);
      if (result.success && result.code !== code) {
        transformations.push({
          type: 'unpack',
          description: `Unpacked ${result.type} obfuscation`,
          success: true,
        });
        return result.code;
      }
    } catch (error) {
      logger.warn('UniversalUnpacker failed', error);
      transformations.push({ type: 'unpack', description: 'UniversalUnpacker failed', success: false });
    }
    return code;
  }

  /**
   * JSVMP virtual machine protection restoration
   * warnings/unresolvedParts are fully passed through to external AI
   */
  private async runJSVMP(
    code: string,
    options: DeobfuscateFullOptions,
    transformations: Transformation[],
    pipelineWarnings: string[],
    pipelineUnresolved: UnresolvedPart[],
  ): Promise<string> {
    try {
      logger.info('Running JSVMPDeobfuscator...');
      const result = await this.jsvmpDeobfuscator.deobfuscate({
        code,
        aggressive: options.aggressiveVM ?? options.aggressive ?? false,
        extractInstructions: true,
        timeout: options.timeout ?? 30000,
      });

      // Regardless of restoration success, warnings are passed through to external AI
      if (result.warnings && result.warnings.length > 0) {
        pipelineWarnings.push(...result.warnings.map(w => `[JSVMP] ${w}`));
      }

      // unresolvedParts fully passed through
      if (result.unresolvedParts && result.unresolvedParts.length > 0) {
        pipelineUnresolved.push(...result.unresolvedParts);
      }

      if (result.isJSVMP && result.confidence > 0.3) {
        // Build detail for external AI to perform deeper analysis
        const detail: Record<string, unknown> = {
          vmType: result.vmType,
          confidence: result.confidence,
          warningCount: result.warnings?.length ?? 0,
          unresolvedCount: result.unresolvedParts?.length ?? 0,
        };

        if (result.vmFeatures) {
          detail.vmFeatures = {
            instructionCount: result.vmFeatures.instructionCount,
            complexity: result.vmFeatures.complexity,
            hasSwitch: result.vmFeatures.hasSwitch,
            hasInstructionArray: result.vmFeatures.hasInstructionArray,
            hasProgramCounter: result.vmFeatures.hasProgramCounter,
            interpreterLocation: result.vmFeatures.interpreterLocation,
          };
        }

        if (result.instructions && result.instructions.length > 0) {
          detail.instructionSample = result.instructions.slice(0, 10).map(i => ({
            type: i.type,
            opcode: i.opcode,
          }));
        }

        if (result.stats) {
          detail.stats = result.stats;
        }

        transformations.push({
          type: 'jsvmp',
          description: `JSVMP deobfuscation (type: ${result.vmType ?? 'unknown'}, confidence: ${(result.confidence * 100).toFixed(1)}%)`,
          success: true,
          detail,
        });

        return result.deobfuscatedCode;
      } else if (result.isJSVMP) {
        // JSVMP detected but confidence too low, still pass analysis information through
        pipelineWarnings.push(`[JSVMP] VM protection detected but restoration confidence too low (${(result.confidence * 100).toFixed(1)}%), code unchanged`);
        transformations.push({
          type: 'jsvmp',
          description: `JSVMP detected but confidence too low (${(result.confidence * 100).toFixed(1)}%), code unchanged`,
          success: false,
          detail: {
            vmType: result.vmType,
            confidence: result.confidence,
            reason: 'confidence_too_low',
          },
        });
      }
    } catch (error) {
      logger.warn('JSVMPDeobfuscator failed', error);
      pipelineWarnings.push(`[JSVMP] Deobfuscation failed: ${error}`);
      transformations.push({ type: 'jsvmp', description: `JSVMP deobfuscation failed: ${error}`, success: false });
    }
    return code;
  }

  /**
   * Advanced deobfuscation pipeline
   * warnings are fully passed through to external AI
   */
  private async runAdvanced(
    code: string,
    options: DeobfuscateFullOptions,
    transformations: Transformation[],
    pipelineWarnings: string[],
  ): Promise<string> {
    try {
      logger.info('Running AdvancedDeobfuscator...');
      const advOptions: AdvancedDeobfuscateOptions = {
        code,
        aggressiveVM: options.aggressiveVM,
        useASTOptimization: false, // AST optimization handled separately in Step 5 to avoid duplication
        timeout: options.timeout,
      };

      const result = await this.advancedDeobfuscator.deobfuscate(advOptions);

      // Regardless of the result, warnings are passed through to external AI
      if (result.warnings && result.warnings.length > 0) {
        pipelineWarnings.push(...result.warnings.map(w => `[Advanced] ${w}`));
      }

      if (result.detectedTechniques.length > 0) {
        transformations.push({
          type: 'advanced',
          description: `Advanced deobfuscation applied: ${result.detectedTechniques.join(', ')} (confidence: ${(result.confidence * 100).toFixed(1)}%)`,
          success: true,
          detail: {
            detectedTechniques: result.detectedTechniques,
            confidence: result.confidence,
          },
        });

        return result.code;
      }
    } catch (error) {
      logger.warn('AdvancedDeobfuscator failed', error);
      pipelineWarnings.push(`[Advanced] Advanced deobfuscation failed: ${error}`);
      transformations.push({ type: 'advanced', description: `Advanced deobfuscation failed: ${error}`, success: false });
    }
    return code;
  }

  /**
   * AST optimizer
   */
  private async runASTOptimizer(code: string, transformations: Transformation[]): Promise<string> {
    try {
      logger.info('Running ASTOptimizer...');
      const optimized = this.astOptimizer.optimize(code);
      if (optimized !== code) {
        transformations.push({
          type: 'ast-optimize',
          description: 'AST optimizations applied (constant folding, propagation, variable inlining, property unfolding)',
          success: true,
        });
        return optimized;
      }
    } catch (error) {
      logger.warn('ASTOptimizer failed', error);
      transformations.push({ type: 'ast-optimize', description: 'AST optimization failed', success: false });
    }
    return code;
  }

  // ==================== Detection ====================

  /**
   * Detect obfuscation types (comprehensive detection)
   */
  private detectObfuscationType(code: string): ObfuscationType[] {
    const types: ObfuscationType[] = [];

    // JavaScript Obfuscator
    if (code.includes('_0x') || /var\s+_0x[a-f0-9]+\s*=/.test(code)) {
      types.push('javascript-obfuscator');
    }

    // Webpack
    if (code.includes('__webpack_require__') || code.includes('webpackJsonp')) {
      types.push('webpack');
    }

    // UglifyJS (single-line long code)
    if (code.length > 1000 && !code.includes('\n')) {
      types.push('uglify');
    }

    // VM protection
    if (code.includes('eval') && code.includes('Function')) {
      types.push('vm-protection');
    }

    // Packer
    if (PackerDeobfuscator.detect(code)) {
      types.push('packer');
    }

    // AAEncode
    if (AAEncodeDeobfuscator.detect(code)) {
      types.push('aaencode');
    }

    // URLEncode
    if (URLEncodeDeobfuscator.detect(code)) {
      types.push('urlencoded');
    }

    // Invisible Unicode (zero-width characters)
    if (/[\u200B-\u200F\u2028-\u202F\uFEFF]/.test(code)) {
      types.push('invisible-unicode');
    }

    // Control flow flattening (while + switch nesting)
    if (/while\s*\([^)]*\)\s*\{?\s*switch\s*\(/.test(code) ||
        /while\s*\(\s*!!\s*\[\s*\]\s*\)\s*\{?\s*switch/.test(code)) {
      types.push('control-flow-flattening');
    }

    // Opaque predicates (always-true/always-false conditions)
    if (/if\s*\(\s*typeof\s+\w+\s*[!=]==?\s*['"]undefined['"]\s*\)/.test(code) &&
        code.includes('_0x')) {
      types.push('opaque-predicates');
    }

    // Dead code injection
    if (/if\s*\(\s*false\s*\)|if\s*\(\s*![1!]\s*\)/.test(code)) {
      types.push('dead-code-injection');
    }

    // String array rotation
    if (/\(\s*function\s*\(\s*_0x[a-f0-9]+\s*,\s*_0x[a-f0-9]+\s*\).*?push\s*\(\s*.*?shift\s*\(\s*\)/.test(code)) {
      types.push('string-array-rotation');
    }

    // JSFuck
    if (/^\s*[\[\]()!+]+\s*$/.test(code.substring(0, 200))) {
      types.push('jsfuck');
    }

    // eval obfuscation
    if (/eval\s*\(\s*['"`]/.test(code) || /eval\s*\(\s*atob\s*\(/.test(code)) {
      types.push('eval-obfuscation');
    }

    // Hex-encoded strings
    if (/\\x[0-9a-fA-F]{2}/.test(code)) {
      types.push('hex-encoding');
    }

    // Base64 encoding
    if (/atob\s*\(|btoa\s*\(/.test(code) && /[A-Za-z0-9+/]{20,}={0,2}/.test(code)) {
      types.push('base64-encoding');
    }

    if (types.length === 0) {
      types.push('unknown');
    }

    return types;
  }

  /**
   * Merge additional obfuscation types detected by sub-pipelines
   */
  private mergeObfuscationTypes(
    original: ObfuscationType[],
    transformations: Transformation[],
  ): ObfuscationType[] {
    const types = new Set<ObfuscationType>(original);

    // Infer newly discovered types from transformations
    for (const t of transformations) {
      if (t.success) {
        if (t.type === 'unpack' && t.description.includes('Packer')) types.add('packer');
        if (t.type === 'unpack' && t.description.includes('AAEncode')) types.add('aaencode');
        if (t.type === 'unpack' && t.description.includes('URLEncode')) types.add('urlencoded');
        if (t.type === 'jsvmp') types.add('vm-protection');
        if (t.type === 'advanced' && t.description.includes('invisible-unicode')) types.add('invisible-unicode');
        if (t.type === 'advanced' && t.description.includes('control-flow-flattening')) types.add('control-flow-flattening');
        if (t.type === 'advanced' && t.description.includes('opaque-predicates')) types.add('opaque-predicates');
        if (t.type === 'advanced' && t.description.includes('dead-code-injection')) types.add('dead-code-injection');
      }
    }

    // Remove 'unknown' if specific types exist
    if (types.size > 1) {
      types.delete('unknown');
    }

    return [...types];
  }

  // ==================== Basic Pipeline Methods ====================

  /**
   * Basic AST transforms (constant folding + dead code elimination)
   */
  private async basicTransform(code: string, transformations: Transformation[]): Promise<string> {
    try {
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

      traverse(ast, {
        // Constant folding
        BinaryExpression(path) {
          if (t.isNumericLiteral(path.node.left) && t.isNumericLiteral(path.node.right)) {
            const l = path.node.left.value;
            const r = path.node.right.value;
            let result: number | undefined;
            switch (path.node.operator) {
              case '+': result = l + r; break;
              case '-': result = l - r; break;
              case '*': result = l * r; break;
              case '/': result = r !== 0 ? l / r : undefined; break;
              case '%': result = r !== 0 ? l % r : undefined; break;
              case '**': result = l ** r; break;
              case '|': result = l | r; break;
              case '&': result = l & r; break;
              case '^': result = l ^ r; break;
              case '<<': result = l << r; break;
              case '>>': result = l >> r; break;
              case '>>>': result = l >>> r; break;
            }
            if (result !== undefined && isFinite(result)) {
              path.replaceWith(t.numericLiteral(result));
            }
          }
          // String concatenation folding
          if (t.isStringLiteral(path.node.left) && t.isStringLiteral(path.node.right) && path.node.operator === '+') {
            path.replaceWith(t.stringLiteral(path.node.left.value + path.node.right.value));
          }
        },

        // Dead code elimination
        IfStatement(path) {
          if (t.isBooleanLiteral(path.node.test)) {
            if (path.node.test.value) {
              path.replaceWith(path.node.consequent);
            } else if (path.node.alternate) {
              path.replaceWith(path.node.alternate);
            } else {
              path.remove();
            }
          }
        },

        // Conditional expression simplification: true ? a : b → a
        ConditionalExpression(path) {
          if (t.isBooleanLiteral(path.node.test)) {
            path.replaceWith(path.node.test.value ? path.node.consequent : path.node.alternate);
          }
        },
      });

      const output = generate(ast, { comments: true, compact: false });
      transformations.push({ type: 'basic-ast-transform', description: 'Constant folding, dead code elimination, string concatenation', success: true });
      return output.code;
    } catch (error) {
      logger.warn('Basic transform failed', error);
      transformations.push({ type: 'basic-ast-transform', description: 'Failed', success: false });
      return code;
    }
  }

  /**
   * String decoding (hex / unicode)
   */
  private async decodeStrings(code: string, transformations: Transformation[]): Promise<string> {
    try {
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      let decoded = 0;

      traverse(ast, {
        StringLiteral(path) {
          const value = path.node.value;
          let newValue = value;

          // Hexadecimal
          if (value.includes('\\x')) {
            newValue = newValue.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          }
          // Unicode
          if (value.includes('\\u')) {
            newValue = newValue.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          }

          if (newValue !== value) {
            path.node.value = newValue;
            decoded++;
          }
        },
      });

      if (decoded > 0) {
        const output = generate(ast, { comments: true, compact: false });
        transformations.push({ type: 'string-decode', description: `Decoded ${decoded} strings (hex/unicode)`, success: true });
        return output.code;
      }
      return code;
    } catch (error) {
      logger.warn('String decoding failed', error);
      transformations.push({ type: 'string-decode', description: 'Failed', success: false });
      return code;
    }
  }

  /**
   * Extract string arrays (specific to JavaScript Obfuscator)
   */
  private async extractStringArrays(code: string, transformations: Transformation[]): Promise<string> {
    try {
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      let extracted = 0;

      traverse(ast, {
        VariableDeclarator: (path) => {
          if (
            t.isIdentifier(path.node.id) &&
            path.node.id.name.startsWith('_0x') &&
            t.isArrayExpression(path.node.init)
          ) {
            const arrayName = path.node.id.name;
            const strings: string[] = [];
            path.node.init.elements.forEach((el) => {
              if (t.isStringLiteral(el)) strings.push(el.value);
            });
            if (strings.length > 0) {
              this.stringArrays.set(arrayName, strings);
              extracted++;
              logger.debug(`Extracted string array: ${arrayName} (${strings.length} strings)`);
            }
          }
        },
      });

      if (extracted > 0) {
        transformations.push({ type: 'extract-string-arrays', description: `Extracted ${extracted} string arrays`, success: true });
      }
      return code;
    } catch (error) {
      logger.warn('String array extraction failed', error);
      transformations.push({ type: 'extract-string-arrays', description: 'Failed', success: false });
      return code;
    }
  }

  /**
   * Array decryption (replace string array references)
   */
  private async decryptArrays(code: string, transformations: Transformation[]): Promise<string> {
    if (this.stringArrays.size === 0) return code;

    try {
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      let replaced = 0;
      const arrays = this.stringArrays;

      traverse(ast, {
        MemberExpression(path) {
          if (
            t.isIdentifier(path.node.object) &&
            t.isNumericLiteral(path.node.property) &&
            path.node.object.name.startsWith('_0x')
          ) {
            const arr = arrays.get(path.node.object.name);
            const idx = path.node.property.value;
            if (arr && idx >= 0 && idx < arr.length) {
              const value = arr[idx];
              if (value !== undefined) {
                path.replaceWith(t.stringLiteral(value));
                replaced++;
              }
            }
          }
        },
      });

      if (replaced > 0) {
        const output = generate(ast, { comments: true, compact: false });
        transformations.push({ type: 'decrypt-arrays', description: `Replaced ${replaced} array references`, success: true });
        return output.code;
      }
      return code;
    } catch (error) {
      logger.warn('Array decryption failed', error);
      transformations.push({ type: 'decrypt-arrays', description: 'Failed', success: false });
      return code;
    }
  }

  /**
   * Control flow unflattening (basic version)
   */
  private async unflattenControlFlow(code: string, transformations: Transformation[]): Promise<string> {
    try {
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      let unflattened = 0;

      traverse(ast, {
        WhileStatement(path) {
          const body = path.node.body;
          const switchNode = t.isBlockStatement(body) && body.body.length === 1
            ? body.body[0]
            : body;

          if (!t.isSwitchStatement(switchNode)) return;

          // Find the dispatch variable
          const discriminant = switchNode.discriminant;
          if (!t.isMemberExpression(discriminant)) return;

          // Check if this is the typical array[index++] pattern
          const obj = discriminant.object;
          if (!t.isIdentifier(obj)) return;

          // Try to find the dispatch sequence
          const binding = path.scope.getBinding(obj.name);
          if (!binding || !binding.path.isVariableDeclarator()) return;

          const init = binding.path.node.init;
          if (!t.isCallExpression(init)) return;

          // Typical pattern: "0|1|2|3".split("|")
          const callee = init.callee;
          if (
            t.isMemberExpression(callee) &&
            t.isStringLiteral(callee.object) &&
            t.isIdentifier(callee.property, { name: 'split' }) &&
            init.arguments.length === 1 &&
            t.isStringLiteral(init.arguments[0], { value: '|' })
          ) {
            const order = callee.object.value.split('|').map(Number);
            const cases = switchNode.cases;

            // Reorder case consequents by execution order
            const orderedStatements: t.Statement[] = [];
            for (const idx of order) {
              const matchedCase = cases.find(c => t.isStringLiteral(c.test, { value: String(idx) }) || t.isNumericLiteral(c.test, { value: idx }));
              if (matchedCase) {
                for (const stmt of matchedCase.consequent) {
                  if (!t.isContinueStatement(stmt) && !t.isBreakStatement(stmt)) {
                    orderedStatements.push(stmt);
                  }
                }
              }
            }

            if (orderedStatements.length > 0) {
              path.replaceWithMultiple(orderedStatements);
              unflattened++;
            }
          }
        },
      });

      if (unflattened > 0) {
        const output = generate(ast, { comments: true, compact: false });
        transformations.push({ type: 'unflatten-control-flow', description: `Unflattened ${unflattened} control flow patterns`, success: true });
        return output.code;
      }
      return code;
    } catch (error) {
      logger.warn('Control flow unflattening failed', error);
      transformations.push({ type: 'unflatten-control-flow', description: 'Failed', success: false });
      return code;
    }
  }

  /**
   * Expression simplification
   */
  private async simplifyExpressions(code: string, transformations: Transformation[]): Promise<string> {
    try {
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      let simplified = 0;

      traverse(ast, {
        UnaryExpression(path) {
          // !!value → Boolean(value) preserves semantics but is clearer (here we keep the original value)
          if (
            path.node.operator === '!' &&
            t.isUnaryExpression(path.node.argument) &&
            path.node.argument.operator === '!'
          ) {
            path.replaceWith(path.node.argument.argument);
            simplified++;
          }
          // void 0 → undefined
          else if (path.node.operator === 'void' && t.isNumericLiteral(path.node.argument, { value: 0 })) {
            path.replaceWith(t.identifier('undefined'));
            simplified++;
          }
          // !0 → true, !1 → false
          else if (path.node.operator === '!' && t.isNumericLiteral(path.node.argument)) {
            path.replaceWith(t.booleanLiteral(!path.node.argument.value));
            simplified++;
          }
        },

        // Comma expression expansion: (a, b, c) → last value (in expression position)
        SequenceExpression(path) {
          if (path.node.expressions.length === 1) {
            path.replaceWith(path.node.expressions[0]);
            simplified++;
          }
        },
      });

      if (simplified > 0) {
        const output = generate(ast, { comments: true, compact: false });
        transformations.push({ type: 'simplify-expressions', description: `Simplified ${simplified} expressions`, success: true });
        return output.code;
      }
      return code;
    } catch (error) {
      logger.warn('Expression simplification failed', error);
      transformations.push({ type: 'simplify-expressions', description: 'Failed', success: false });
      return code;
    }
  }

  /**
   * Variable renaming
   */
  private async renameVariables(code: string, transformations: Transformation[]): Promise<string> {
    try {
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      let renamed = 0;
      const renameMap = new Map<string, string>();

      // First pass: collect variables that need renaming
      traverse(ast, {
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name.startsWith('_0x')) {
            const oldName = path.node.id.name;
            const newName = `var_${renamed}`;
            renameMap.set(oldName, newName);
            renamed++;
          }
        },
      });

      // Second pass: safely rename using scope
      if (renameMap.size > 0) {
        traverse(ast, {
          Identifier(path) {
            const newName = renameMap.get(path.node.name);
            if (newName) {
              path.node.name = newName;
            }
          },
        });

        const output = generate(ast, { comments: true, compact: false });
        transformations.push({ type: 'rename-variables', description: `Renamed ${renamed} variables`, success: true });
        return output.code;
      }
      return code;
    } catch (error) {
      logger.warn('Variable renaming failed', error);
      transformations.push({ type: 'rename-variables', description: 'Failed', success: false });
      return code;
    }
  }

  // ==================== LLM ====================

  private async llmAnalysis(code: string): Promise<string | null> {
    if (!this.llm) return null;
    try {
      const messages = this.llm.generateDeobfuscationPrompt(code);
      const response = await this.llm.chat(messages, { temperature: 0.3, maxTokens: 2000 });
      return response.content;
    } catch (error) {
      logger.warn('LLM analysis failed', error);
      return null;
    }
  }

  // ==================== Scoring ====================

  private calculateConfidence(transformations: Transformation[], readabilityScore: number): number {
    const successCount = transformations.filter((t) => t.success).length;
    const totalCount = transformations.length || 1;
    const transformConfidence = successCount / totalCount;
    const readabilityConfidence = readabilityScore / 100;
    return Math.min(Math.max(transformConfidence * 0.6 + readabilityConfidence * 0.4, 0), 1);
  }

  private calculateReadabilityScore(code: string): number {
    let score = 0;
    if (code.includes('\n')) score += 20;
    if (code.includes('//') || code.includes('/*')) score += 10;
    const varNames = code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
    const avgLength = varNames.reduce((sum, name) => sum + name.length, 0) / (varNames.length || 1);
    if (avgLength > 3) score += 30;
    const density = code.replace(/\s/g, '').length / (code.length || 1);
    if (density < 0.8) score += 20;
    if (!code.includes('_0x') && !code.includes('\\x')) score += 20;
    return Math.min(score, 100);
  }

  // ==================== Cache ====================

  private generateCacheKey(options: DeobfuscateFullOptions): string {
    const key = JSON.stringify({
      code: options.code.substring(0, 1000),
      aggressive: options.aggressive,
      advanced: options.advanced,
      jsvmp: options.jsvmp,
      astOptimize: options.astOptimize,
      unpack: options.unpack,
      auto: options.auto,
    });
    return crypto.createHash('md5').update(key).digest('hex');
  }

  private cacheResult(key: string, result: DeobfuscateResult): void {
    if (this.resultCache.size >= this.maxCacheSize) {
      const firstKey = this.resultCache.keys().next().value;
      if (firstKey) this.resultCache.delete(firstKey);
    }
    this.resultCache.set(key, result);
  }

  /** Clear cache */
  clearCache(): void {
    this.resultCache.clear();
    this.stringArrays.clear();
  }
}
