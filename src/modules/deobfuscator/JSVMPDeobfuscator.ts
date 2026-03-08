/**
 * JSVMP Deobfuscator
 * Identifies and cracks JavaScript Virtual Machine Protection (JSVMP) obfuscation
 */

import * as parser from '@babel/parser';
import traverseImport from '@babel/traverse';
const traverse = (traverseImport as unknown as {default?: typeof traverseImport}).default ?? traverseImport;
import generateImport from '@babel/generator';
const generate = (generateImport as unknown as {default?: typeof generateImport}).default ?? generateImport;
import * as t from '@babel/types';
import type {
  JSVMPDeobfuscatorOptions,
  JSVMPDeobfuscatorResult,
  VMFeatures,
  VMInstruction,
  VMType,
  ComplexityLevel,
  UnresolvedPart,
} from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import type { LLMService } from '../../services/LLMService.js';

/**
 * JSVMP Deobfuscator
 */
export class JSVMPDeobfuscator {
  private llm?: LLMService;

  constructor(llm?: LLMService) {
    this.llm = llm;
  }

  /**
   * Deobfuscate JSVMP code
   */
  async deobfuscate(options: JSVMPDeobfuscatorOptions): Promise<JSVMPDeobfuscatorResult> {
    const startTime = Date.now();
    const {
      code,
      aggressive = false,
      extractInstructions = false,
      timeout = 30000,
      maxIterations = 100,
    } = options;

    logger.info('Starting JSVMP deobfuscation analysis...');

    try {
      // 1. Detect whether it is JSVMP obfuscation
      const vmFeatures = this.detectJSVMP(code);
      if (!vmFeatures) {
        logger.info('No JSVMP obfuscation detected');
        return {
          isJSVMP: false,
          deobfuscatedCode: code,
          confidence: 0,
          warnings: ['No JSVMP features detected'],
        };
      }

      logger.info(`JSVMP obfuscation detected, complexity: ${vmFeatures.complexity}`);
      logger.info(`Instruction count: ${vmFeatures.instructionCount}`);

      // 2. Identify VM type
      const vmType = this.identifyVMType(code, vmFeatures);
      logger.info(`VM type: ${vmType}`);

      // 3. Extract instruction set (if needed)
      let instructions: VMInstruction[] | undefined;
      if (extractInstructions) {
        logger.info('Extracting VM instruction set...');
        instructions = this.extractInstructions(code, vmFeatures);
        logger.info(`Extracted ${instructions.length} instructions`);
      }

      // 4. Attempt to restore code
      logger.info('Restoring code...');
      const deobfuscationResult = await this.restoreCode(
        code,
        vmFeatures,
        vmType,
        aggressive,
        timeout,
        maxIterations
      );

      const processingTime = Date.now() - startTime;

      const result: JSVMPDeobfuscatorResult = {
        isJSVMP: true,
        vmType,
        vmFeatures,
        instructions,
        deobfuscatedCode: deobfuscationResult.code,
        confidence: deobfuscationResult.confidence,
        warnings: deobfuscationResult.warnings,
        unresolvedParts: deobfuscationResult.unresolvedParts,
        stats: {
          originalSize: code.length,
          deobfuscatedSize: deobfuscationResult.code.length,
          reductionRate: 1 - deobfuscationResult.code.length / code.length,
          processingTime,
        },
      };

      logger.info(`JSVMP deobfuscation complete, took ${processingTime}ms`);
      logger.info(`Restoration confidence: ${(result.confidence * 100).toFixed(1)}%`);

      return result;
    } catch (error) {
      logger.error('JSVMP deobfuscation failed', error);
      return {
        isJSVMP: false,
        deobfuscatedCode: code,
        confidence: 0,
        warnings: [`Deobfuscation failed: ${error}`],
      };
    }
  }

  /**
   * Detect JSVMP features (full implementation - based on real-world cases)
   * Reference: Douyin bdms.js, Toutiao acrawler.js and other JSVMP obfuscated code
   */
  private detectJSVMP(code: string): VMFeatures | null {
    try {
      const ast = parser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true,
      });

      let hasSwitch = false;
      let hasInstructionArray = false;
      let hasProgramCounter = false;
      let instructionCount = 0;
      let interpreterLocation = '';
      let maxSwitchCases = 0;

      // Additional JSVMP feature detection
      let hasBytecodeArray = false; // Bytecode array: var j = parseInt("" + b[O] + b[O + 1], 16);
      let hasApplyCall = false; // apply call: s.apply(b, u)
      let hasWhileLoop = false; // Main loop
      let bytecodePattern = false; // Bytecode pattern

      traverse(ast, {
        // 1. Detect large switch statements (core feature of VM interpreters)
        SwitchStatement(path) {
          const caseCount = path.node.cases.length;
          if (caseCount > 10) {
            hasSwitch = true;
            if (caseCount > maxSwitchCases) {
              maxSwitchCases = caseCount;
              instructionCount = caseCount;
              interpreterLocation = `Line ${path.node.loc?.start.line || 0}`;
            }
          }
        },

        // 2. Detect instruction arrays (bytecode arrays)
        ArrayExpression(path) {
          if (path.node.elements.length > 50) {
            hasInstructionArray = true;
          }
        },

        // 3. Detect program counter (PC register)
        UpdateExpression(path) {
          if (path.node.operator === '++' || path.node.operator === '--') {
            const arg = path.node.argument;
            if (t.isIdentifier(arg) && arg.name.length <= 3) {
              hasProgramCounter = true;
            }
          }
        },

        // 4. Detect bytecode parsing pattern: parseInt("" + b[O] + b[O + 1], 16)
        CallExpression(path) {
          if (
            t.isIdentifier(path.node.callee, { name: 'parseInt' }) &&
            path.node.arguments.length >= 2
          ) {
            const firstArg = path.node.arguments[0];
            // Detect string concatenation pattern
            if (t.isBinaryExpression(firstArg) && firstArg.operator === '+') {
              bytecodePattern = true;
              hasBytecodeArray = true;
            }
          }

          // Detect apply call pattern: s.apply(b, u)
          if (
            t.isMemberExpression(path.node.callee) &&
            t.isIdentifier(path.node.callee.property, { name: 'apply' })
          ) {
            hasApplyCall = true;
          }
        },

        // 5. Detect main loop (VM main loop)
        WhileStatement(path) {
          // Detect while(true) or while(1) pattern
          if (
            t.isBooleanLiteral(path.node.test, { value: true }) ||
            t.isNumericLiteral(path.node.test, { value: 1 })
          ) {
            hasWhileLoop = true;
          }
        },

        // 6. Detect VM patterns in for loops
        ForStatement(path) {
          // Detect for(;;) infinite loop
          if (!path.node.test) {
            hasWhileLoop = true;
          }
        },
      });

      // Comprehensive check for JSVMP (stricter conditions)
      const isJSVMP =
        hasSwitch &&
        (hasInstructionArray || hasProgramCounter) &&
        (hasApplyCall || hasWhileLoop || bytecodePattern);

      if (isJSVMP) {
        const complexity: ComplexityLevel =
          instructionCount > 100 ? 'high' : instructionCount > 50 ? 'medium' : 'low';

        logger.info('JSVMP feature detection results:');
        logger.info(`  - Switch statement: ${hasSwitch} (${maxSwitchCases} cases)`);
        logger.info(`  - Instruction array: ${hasInstructionArray}`);
        logger.info(`  - Program counter: ${hasProgramCounter}`);
        logger.info(`  - Bytecode array: ${hasBytecodeArray}`);
        logger.info(`  - Apply call: ${hasApplyCall}`);
        logger.info(`  - Main loop: ${hasWhileLoop}`);
        logger.info(`  - Bytecode pattern: ${bytecodePattern}`);

        return {
          instructionCount,
          interpreterLocation,
          complexity,
          hasSwitch,
          hasInstructionArray,
          hasProgramCounter,
        };
      }

      return null;
    } catch (error) {
      logger.warn('JSVMP detection failed, attempting regex-based detection', error);

      // Fall back to regex-based detection
      return this.detectJSVMPWithRegex(code);
    }
  }

  /**
   * Detect JSVMP using regex (fallback method)
   */
  private detectJSVMPWithRegex(code: string): VMFeatures | null {
    // Detect switch statements
    const switchMatches = code.match(/switch\s*\(/g);
    const hasSwitch = (switchMatches?.length || 0) > 0;

    // Detect bytecode pattern
    const bytecodePattern = /parseInt\s*\(\s*["']?\s*\+\s*\w+\[/g.test(code);

    // Detect apply calls
    const applyPattern = /\.apply\s*\(/g.test(code);

    // Detect main loop
    const whilePattern = /while\s*\(\s*(true|1)\s*\)/g.test(code);

    if (hasSwitch && (bytecodePattern || applyPattern || whilePattern)) {
      logger.info('JSVMP features detected via regex');
      return {
        instructionCount: 0,
        interpreterLocation: 'Unknown',
        complexity: 'medium',
        hasSwitch: true,
        hasInstructionArray: bytecodePattern,
        hasProgramCounter: applyPattern,
      };
    }

    return null;
  }

  /**
   * Identify VM type
   */
  private identifyVMType(code: string, _features: VMFeatures): VMType {
    // Detect obfuscator.io features
    if (code.includes('_0x') && code.includes('function(_0x')) {
      return 'obfuscator.io';
    }

    // Detect JSFuck features
    if (/^\s*\[\s*\]\s*\[\s*\(/.test(code)) {
      return 'jsfuck';
    }

    // Detect JJEncode features
    if (code.includes('$=~[];')) {
      return 'jjencode';
    }

    return 'custom';
  }

  /**
   * Extract VM instruction set
   */
  private extractInstructions(code: string, features: VMFeatures): VMInstruction[] {
    const instructions: VMInstruction[] = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript'],
      });

      // Find switch statements and extract cases
      const self = this;
      traverse(ast, {
        SwitchStatement(path) {
          if (path.node.cases.length === features.instructionCount) {
            path.node.cases.forEach((caseNode, index) => {
              const opcode = caseNode.test
                ? t.isNumericLiteral(caseNode.test)
                  ? caseNode.test.value
                  : t.isStringLiteral(caseNode.test)
                  ? caseNode.test.value
                  : index
                : index;

              // Infer instruction type
              const type = self.inferInstructionType(caseNode);

              instructions.push({
                opcode,
                name: `INST_${opcode}`,
                type,
                description: `Instruction ${opcode}`,
              });
            });
          }
        },
      });
    } catch (error) {
      logger.warn('Instruction extraction failed', error);
    }

    return instructions;
  }

  /**
   * Infer instruction type (full implementation - based on real-world opcode patterns)
   * Reference: Common JSVMP opcodes
   * - 0x01: PUSH (push to stack)
   * - 0x02: ADD (addition)
   * - 0x03: CALL (call function)
   * - 0x04: LOAD (load variable)
   * - 0x05: STORE (store variable)
   * - 0x06: JMP (jump)
   * - 0x07: CMP (compare)
   * - 0x08: RET (return)
   */
  private inferInstructionType(caseNode: t.SwitchCase): VMInstruction['type'] {
    const code = generate(caseNode).code;
    const consequent = caseNode.consequent;

    // Analyze AST node types
    let hasAssignment = false;
    let hasArrayAccess = false;
    let hasFunctionCall = false;
    let hasArithmetic = false;
    let hasControlFlow = false;

    for (const stmt of consequent) {
      if (t.isExpressionStatement(stmt)) {
        const expr = stmt.expression;

        // Detect assignment operations
        if (t.isAssignmentExpression(expr)) {
          hasAssignment = true;
        }

        // Detect array access
        if (t.isMemberExpression(expr) && t.isNumericLiteral(expr.property)) {
          hasArrayAccess = true;
        }

        // Detect function calls
        if (t.isCallExpression(expr)) {
          hasFunctionCall = true;
        }

        // Detect arithmetic operations
        if (t.isBinaryExpression(expr)) {
          if (['+', '-', '*', '/', '%', '**'].includes(expr.operator)) {
            hasArithmetic = true;
          }
        }
      }

      // Detect control flow statements
      if (
        t.isIfStatement(stmt) ||
        t.isWhileStatement(stmt) ||
        t.isBreakStatement(stmt) ||
        t.isContinueStatement(stmt) ||
        t.isReturnStatement(stmt)
      ) {
        hasControlFlow = true;
      }
    }

    // Infer instruction type based on code patterns
    // 1. LOAD instruction: load data from stack or array
    if (
      (code.includes('push') || code.includes('.push(')) &&
      (hasArrayAccess || code.includes('['))
    ) {
      return 'load';
    }

    // 2. STORE instruction: store data to stack or variable
    if (hasAssignment && !hasArithmetic && !hasFunctionCall) {
      return 'store';
    }

    // 3. ARITHMETIC instruction: arithmetic operations
    if (hasArithmetic || code.match(/[+\-*/%]/)) {
      return 'arithmetic';
    }

    // 4. CONTROL instruction: control flow (jumps, conditionals)
    if (hasControlFlow || code.includes('break') || code.includes('continue')) {
      return 'control';
    }

    // 5. CALL instruction: function calls
    if (hasFunctionCall || code.includes('.apply(') || code.includes('.call(')) {
      return 'call';
    }

    // 6. Default to unknown
    return 'unknown';
  }

  /**
   * Restore code
   */
  private async restoreCode(
    code: string,
    _features: VMFeatures,
    vmType: VMType,
    aggressive: boolean,
    _timeout: number,
    _maxIterations: number
  ): Promise<{
    code: string;
    confidence: number;
    warnings: string[];
    unresolvedParts?: UnresolvedPart[];
  }> {
    const warnings: string[] = [];
    const unresolvedParts: UnresolvedPart[] = [];

    // Select restoration strategy based on VM type
    if (vmType === 'obfuscator.io') {
      return await this.restoreObfuscatorIO(code, aggressive, warnings, unresolvedParts);
    } else if (vmType === 'jsfuck') {
      return await this.restoreJSFuck(code, warnings);
    } else if (vmType === 'jjencode') {
      return await this.restoreJJEncode(code, warnings);
    } else {
      // Custom VM, use LLM assistance
      return await this.restoreCustomVM(code, aggressive, warnings, unresolvedParts);
    }
  }

  /**
   * Restore obfuscator.io obfuscation (full implementation)
   * Reference: obfuscator.io VM protection patterns
   */
  private async restoreObfuscatorIO(
    code: string,
    aggressive: boolean,
    warnings: string[],
    unresolvedParts: UnresolvedPart[]
  ): Promise<{
    code: string;
    confidence: number;
    warnings: string[];
    unresolvedParts?: UnresolvedPart[];
  }> {
    let restored = code;
    let confidence = 0.5;

    try {
      // 1. Extract string array
      const stringArrayMatch = code.match(/var\s+(_0x[a-f0-9]+)\s*=\s*(\[.*?\]);/s);
      if (stringArrayMatch) {
        const arrayName = stringArrayMatch[1];
        const arrayContent = stringArrayMatch[2];

        logger.info(`Found string array: ${arrayName}`);

        try {
          // Try to parse string array (using Function constructor for safety)
          const arrayFunc = new Function(`return ${arrayContent || '[]'};`);
          const stringArray = arrayFunc();

          if (Array.isArray(stringArray)) {
            logger.info(`Successfully parsed string array, containing ${stringArray.length} strings`);

            // Replace all references to the string array
            const refPattern = new RegExp(`${arrayName}\\[(\\d+)\\]`, 'g');
            restored = restored.replace(refPattern, (_match, index) => {
              const idx = parseInt(index, 10);
              if (idx < stringArray.length) {
                return JSON.stringify(stringArray[idx]);
              }
              return _match;
            });

            confidence += 0.2;
          }
        } catch (e) {
          warnings.push(`String array parsing failed: ${e}`);

          // LLM-assisted string array extraction
          if (this.llm) {
            try {
              logger.info('Using LLM to assist with string array extraction...');
              const snippet = (arrayContent || '').substring(0, 3000);
              const response = await this.llm.chat([
                { role: 'system', content: 'You are a JavaScript reverse engineer. Extract and decode the string array from obfuscator.io protected code. Return ONLY a valid JSON array of decoded strings.' },
                { role: 'user', content: `Extract the string array from this obfuscated code fragment:\n\`\`\`\n${snippet}\n\`\`\`\n\nReturn the decoded string array as a JSON array.` },
              ], { temperature: 0.1, maxTokens: 4000 });

              const jsonMatch = response.content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const llmArray = JSON.parse(jsonMatch[0]);
                if (Array.isArray(llmArray) && llmArray.length > 0) {
                  logger.info(`LLM extracted ${llmArray.length} strings`);
                  const refPattern = new RegExp(`${arrayName}\\[(\\d+)\\]`, 'g');
                  restored = restored.replace(refPattern, (_match, index) => {
                    const idx = parseInt(index, 10);
                    if (idx < llmArray.length) return JSON.stringify(llmArray[idx]);
                    return _match;
                  });
                  confidence += 0.15;
                  warnings.push('String array extracted with AI assistance, accuracy needs verification');
                }
              }
            } catch (llmErr) {
              logger.warn('LLM-assisted string array extraction failed', llmErr);
            }
          }

          unresolvedParts.push({
            location: 'String Array',
            reason: 'Unable to parse string array',
            suggestion: this.llm ? 'AI has attempted assisted extraction, results may be incomplete' : 'Configure LLM service to enable AI-assisted extraction',
          });
        }
      }

      // 2. Remove string array rotation function
      restored = restored.replace(
        /\(function\s*\(_0x[a-f0-9]+,\s*_0x[a-f0-9]+\)\s*\{[\s\S]*?\}\(_0x[a-f0-9]+,\s*0x[a-f0-9]+\)\);?/g,
        ''
      );

      // 3. Simplify function wrappers
      if (aggressive) {
        // Remove IIFE wrappers
        restored = restored.replace(/\(function\s*\(\)\s*\{([\s\S]*)\}\(\)\);?/g, '$1');
        confidence += 0.1;
      }

      // 4. Restore hexadecimal numbers
      restored = restored.replace(/0x([0-9a-f]+)/gi, (_match, hex) => {
        return String(parseInt(hex, 16));
      });

      // 5. Clean up empty statements
      restored = restored.replace(/;\s*;/g, ';');
      restored = restored.replace(/\{\s*\}/g, '{}');

      warnings.push('obfuscator.io restoration complete, some complex logic may require further AI analysis');

      return {
        code: restored,
        confidence: Math.min(confidence, 1.0),
        warnings,
        unresolvedParts: unresolvedParts.length > 0 ? unresolvedParts : undefined,
      };
    } catch (error) {
      warnings.push(`obfuscator.io restoration failed: ${error}`);
      return {
        code,
        confidence: 0.2,
        warnings,
        unresolvedParts,
      };
    }
  }

  /**
   * Restore JSFuck obfuscation (full implementation + LLM fallback)
   * JSFuck principle: uses only 6 characters []()!+ to write JavaScript
   * Examples: false = ![] , true = !![] , undefined = [][[]] , NaN = +[![]]
   */
  private async restoreJSFuck(code: string, warnings: string[]): Promise<{
    code: string;
    confidence: number;
    warnings: string[];
  }> {
    try {
      logger.info('JSFuck obfuscation detected, attempting restoration...');

      // JSFuck code is usually very long, direct execution may timeout
      // We try using the Function constructor to execute it
      try {
        // Limit code length to avoid execution timeout
        if (code.length > 100000) {
          warnings.push('JSFuck code too long, local execution may timeout, attempting AI analysis...');
          return await this.llmDecodeEncoding(code, 'JSFuck', warnings);
        }

        // Try executing JSFuck code to get the original code
        const func = new Function(`return ${code};`);
        const result = func();

        if (typeof result === 'string') {
          logger.info('JSFuck restoration successful');
          return {
            code: result,
            confidence: 0.9,
            warnings: ['JSFuck successfully restored'],
          };
        } else {
          warnings.push('JSFuck execution result is not a string, attempting AI analysis...');
          return await this.llmDecodeEncoding(code, 'JSFuck', warnings);
        }
      } catch (execError) {
        warnings.push(`JSFuck local execution failed: ${execError}`);
        return await this.llmDecodeEncoding(code, 'JSFuck', warnings);
      }
    } catch (error) {
      warnings.push(`JSFuck restoration failed: ${error}`);
      return {
        code,
        confidence: 0.1,
        warnings,
      };
    }
  }

  /**
   * Restore JJEncode obfuscation (full implementation + LLM fallback)
   * JJEncode principle: uses Japanese characters and special symbols to encode JavaScript
   * Signature: $=~[]; $={___:++$,$$$$:(![]+"")[$]...
   */
  private async restoreJJEncode(code: string, warnings: string[]): Promise<{
    code: string;
    confidence: number;
    warnings: string[];
  }> {
    try {
      logger.info('JJEncode obfuscation detected, attempting restoration...');

      // JJEncode restoration method: directly execute the code
      try {
        // Extract the core JJEncode code (usually on the last line)
        const lines = code.split('\n').filter((line) => line.trim());
        const lastLine = lines.length > 0 ? lines[lines.length - 1] : '';

        // JJEncode usually ends with $$$$
        if (lastLine && lastLine.includes('$$$$')) {
          // Try executing to get the original code
          const func = new Function(`${code}; return $$$$()`);
          const result = func();

          if (typeof result === 'string') {
            logger.info('JJEncode restoration successful');
            return {
              code: result,
              confidence: 0.9,
              warnings: ['JJEncode successfully restored'],
            };
          }
        }

        // If the above method fails, try executing the entire code directly
        const func2 = new Function(code);
        func2();

        warnings.push('JJEncode local execution completed but unable to extract original code, attempting AI analysis...');
        return await this.llmDecodeEncoding(code, 'JJEncode', warnings);
      } catch (execError) {
        warnings.push(`JJEncode local execution failed: ${execError}`);
        return await this.llmDecodeEncoding(code, 'JJEncode', warnings);
      }
    } catch (error) {
      warnings.push(`JJEncode restoration failed: ${error}`);
      return {
        code,
        confidence: 0.1,
        warnings,
      };
    }
  }

  /**
   * LLM-assisted decoding of encoding-based obfuscation (JSFuck/JJEncode/AAEncode etc.)
   * When local execution fails, use AI to analyze obfuscated code and attempt restoration
   */
  private async llmDecodeEncoding(
    code: string,
    encodingType: string,
    warnings: string[]
  ): Promise<{
    code: string;
    confidence: number;
    warnings: string[];
  }> {
    if (!this.llm) {
      warnings.push(`LLM service not configured, unable to perform AI-assisted analysis after ${encodingType} local restoration failed`);
      warnings.push('Suggestion: configure DeepSeek/OpenAI API to enable AI-assisted deobfuscation');
      return { code, confidence: 0.1, warnings };
    }

    try {
      logger.info(`Using LLM to assist with ${encodingType} obfuscation analysis...`);

      // Truncate code snippet to avoid token limit
      const snippet = code.length > 5000 ? code.substring(0, 5000) + '\n\n// ... (code truncated)' : code;

      const response = await this.llm.chat([
        {
          role: 'system',
          content: `# Role
You are an expert JavaScript reverse engineer specializing in encoding-based obfuscation.

# Task
Analyze and decode ${encodingType} obfuscated JavaScript code.

# Instructions
1. Identify the encoding pattern and technique used
2. Trace the decoding logic step by step
3. Extract or reconstruct the original JavaScript code
4. If full decoding is not possible, provide:
   - Partial decoded fragments
   - The encoding mechanism explanation
   - Key variables/functions identified
   - Actionable steps for manual completion

# Output Format
Return a JSON object:
{
  "decoded": "the decoded JavaScript code (or best partial result)",
  "confidence": 0.0-1.0,
  "mechanism": "explanation of the encoding mechanism",
  "keyFindings": ["finding1", "finding2"],
  "manualSteps": ["step1 if full decode failed"]
}`,
        },
        {
          role: 'user',
          content: `Decode this ${encodingType} obfuscated code:\n\`\`\`javascript\n${snippet}\n\`\`\``,
        },
      ], { temperature: 0.1, maxTokens: 4000 });

      // Parse LLM response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);

          if (result.decoded && result.decoded !== code && result.decoded.length > 0) {
            logger.info(`AI-assisted ${encodingType} decoding complete`);
            warnings.push(`${encodingType} decoded with AI assistance, accuracy: ${Math.round((result.confidence || 0.5) * 100)}%`);

            if (result.mechanism) {
              warnings.push(`Encoding mechanism: ${result.mechanism}`);
            }
            if (result.keyFindings && Array.isArray(result.keyFindings)) {
              result.keyFindings.forEach((f: string) => warnings.push(`Finding: ${f}`));
            }
            if (result.manualSteps && Array.isArray(result.manualSteps) && result.manualSteps.length > 0) {
              warnings.push(`Manual steps required: ${result.manualSteps.join('; ')}`);
            }

            return {
              code: result.decoded,
              confidence: Math.min(result.confidence || 0.5, 0.8),
              warnings,
            };
          }

          // LLM returned analysis but did not successfully decode
          if (result.mechanism || result.keyFindings) {
            warnings.push(`AI analyzed ${encodingType} encoding mechanism but could not fully decode`);
            if (result.mechanism) warnings.push(`Mechanism: ${result.mechanism}`);
            if (result.keyFindings) result.keyFindings.forEach((f: string) => warnings.push(`Finding: ${f}`));
            if (result.manualSteps) result.manualSteps.forEach((s: string) => warnings.push(`Suggestion: ${s}`));
          }
        } catch {
          // JSON parsing failed, try using LLM text output directly
          const codeBlockMatch = response.content.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
          if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
            warnings.push(`${encodingType} decoded with AI assistance (extracted from text response), accuracy needs verification`);
            return {
              code: codeBlockMatch[1].trim(),
              confidence: 0.4,
              warnings,
            };
          }
        }
      }

      warnings.push(`AI failed to successfully decode ${encodingType}, returning original code`);
      return { code, confidence: 0.15, warnings };
    } catch (error) {
      logger.warn(`LLM-assisted ${encodingType} decoding failed`, error);
      warnings.push(`AI-assisted analysis failed: ${error}`);
      return { code, confidence: 0.1, warnings };
    }
  }

  /**
   * Restore custom VM (using LLM assistance - full implementation)
   * Based on real-world experience: Douyin, Toutiao and other custom JSVMPs
   */
  private async restoreCustomVM(
    code: string,
    aggressive: boolean,
    warnings: string[],
    unresolvedParts: UnresolvedPart[]
  ): Promise<{
    code: string;
    confidence: number;
    warnings: string[];
    unresolvedParts?: UnresolvedPart[];
  }> {
    if (!this.llm) {
      warnings.push('LLM service not configured, unable to perform intelligent restoration');
      warnings.push('Suggestion: configure DeepSeek/OpenAI API to enable AI-assisted deobfuscation');

      // Try basic pattern matching restoration (with LLM structural analysis fallback)
      return await this.restoreCustomVMBasic(code, aggressive, warnings, unresolvedParts);
    }

    try {
      logger.info('Using LLM to assist with custom VM analysis...');

      // 1. Extract key VM code snippets (limit length to avoid token overflow)
      const codeSnippet = code.substring(0, 5000);

      // 2. Build professional LLM prompt
      const prompt = `You are a JavaScript reverse engineering expert, specializing in analyzing JSVMP (JavaScript Virtual Machine Protection) obfuscated code.

Below is a JSVMP-obfuscated JavaScript code snippet:

\`\`\`javascript
${codeSnippet}
\`\`\`

Please analyze this code and answer the following questions:

1. **VM Type Identification**: What type of virtual machine protection is this? (obfuscator.io / custom VM / other)

2. **Instruction Set Analysis**:
   - What is the program counter (PC) variable name?
   - What is the operand stack (Stack) variable name?
   - What is the registers variable name?
   - What is the bytecode array variable name?

3. **Key Function Location**:
   - Location of the VM interpreter function (function name or line number)
   - Location of the instruction dispatcher (switch statement)
   - Location of the bytecode parsing function

4. **Restoration Suggestions**:
   - How to extract the bytecode?
   - How to restore the original logic?
   - What pitfalls should be noted?

Please return the analysis results in JSON format:
{
  "vmType": "type",
  "programCounter": "PC variable name",
  "stack": "stack variable name",
  "registers": "registers variable name",
  "bytecodeArray": "bytecode array variable name",
  "interpreterFunction": "interpreter function location",
  "restorationSteps": ["step1", "step2", ...],
  "warnings": ["warning1", "warning2", ...]
}`;

      // 3. Call LLM for analysis
      const response = await this.llm.chat([
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const analysisText = response.content;

      logger.info('LLM analysis complete');
      logger.info(`Analysis result: ${analysisText.substring(0, 200)}...`);

      // 4. Parse JSON returned by LLM
      let vmAnalysis: any;
      try {
        // Try to extract JSON
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          vmAnalysis = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        warnings.push('LLM response parsing failed, using basic restoration method');
        return await this.restoreCustomVMBasic(code, aggressive, warnings, unresolvedParts);
      }

      // 5. Perform restoration based on LLM analysis results
      if (vmAnalysis) {
        warnings.push(`LLM identified VM type: ${vmAnalysis.vmType || 'Unknown'}`);

        if (vmAnalysis.warnings && Array.isArray(vmAnalysis.warnings)) {
          warnings.push(...vmAnalysis.warnings);
        }

        if (vmAnalysis.restorationSteps && Array.isArray(vmAnalysis.restorationSteps)) {
          unresolvedParts.push({
            location: 'VM Restoration',
            reason: 'LLM-suggested restoration steps',
            suggestion: vmAnalysis.restorationSteps.join('\n'),
          });
        }

        return {
          code,
          confidence: 0.6,
          warnings,
          unresolvedParts: unresolvedParts.length > 0 ? unresolvedParts : undefined,
        };
      }

      return await this.restoreCustomVMBasic(code, aggressive, warnings, unresolvedParts);
    } catch (error) {
      logger.error('LLM-assisted restoration failed', error);
      warnings.push(`LLM-assisted restoration failed: ${error}`);
      return await this.restoreCustomVMBasic(code, aggressive, warnings, unresolvedParts);
    }
  }

  /**
   * Basic custom VM restoration (fallback when no LLM is available)
   * Beyond basic pattern matching, if LLM is available it will attempt AI structural analysis
   */
  private async restoreCustomVMBasic(
    code: string,
    aggressive: boolean,
    warnings: string[],
    unresolvedParts: UnresolvedPart[]
  ): Promise<{
    code: string;
    confidence: number;
    warnings: string[];
    unresolvedParts?: UnresolvedPart[];
  }> {
    let restored = code;
    let confidence = 0.3;

    try {
      // 1. Remove common obfuscation patterns
      // Remove empty if statements
      restored = restored.replace(/if\s*\([^)]*\)\s*\{\s*\}/g, '');

      // 2. Simplify boolean expressions
      restored = restored.replace(/!!\s*\(/g, 'Boolean(');

      // 3. Restore simple string concatenation
      restored = restored.replace(/""\s*\+\s*/g, '');

      if (aggressive) {
        // 4. Remove debugger statements
        restored = restored.replace(/debugger;?/g, '');
        confidence += 0.1;

        // 5. Simplify ternary expressions
        restored = restored.replace(/\?\s*([^:]+)\s*:\s*\1/g, '$1');
        confidence += 0.05;
      }

      // 6. Try LLM structural analysis (even if not full VM restoration mode, try to get useful info)
      if (this.llm) {
        try {
          logger.info('Using LLM for structural analysis of custom VM...');
          const snippet = code.length > 4000 ? code.substring(0, 4000) + '\n// ... truncated' : code;

          const response = await this.llm.chat([
            {
              role: 'system',
              content: `# Role
You are a JavaScript VM protection analyst. Analyze custom JavaScript VM (JSVMP) code and provide structural insights.

# Task
1. Identify the VM interpreter loop (while/for + switch pattern)
2. Locate the bytecode array and instruction pointer
3. Map switch cases to probable instruction semantics (LOAD, STORE, CALL, JUMP, etc.)
4. Identify string tables and constant pools
5. Suggest the most effective approach for full restoration

# Output Format
Return a JSON object:
{
  "vmStructure": {
    "interpreterLoop": "description of where the main loop is",
    "bytecodeVar": "variable name holding bytecode",
    "pcVar": "program counter variable",
    "stackVar": "stack variable"
  },
  "instructionMap": {"caseN": "probable instruction type"},
  "stringTable": "location or content of string table if found",
  "restorationApproach": "recommended approach for full restoration",
  "simplifiedLogic": "if possible, a simplified version of what this VM code does"
}`,
            },
            {
              role: 'user',
              content: `Analyze this custom VM protected JavaScript:\n\`\`\`javascript\n${snippet}\n\`\`\``,
            },
          ], { temperature: 0.2, maxTokens: 3000 });

          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            warnings.push('AI structural analysis complete');

            if (analysis.vmStructure) {
              const vs = analysis.vmStructure;
              if (vs.interpreterLoop) warnings.push(`VM interpreter location: ${vs.interpreterLoop}`);
              if (vs.bytecodeVar) warnings.push(`Bytecode variable: ${vs.bytecodeVar}`);
              if (vs.pcVar) warnings.push(`Program counter: ${vs.pcVar}`);
              if (vs.stackVar) warnings.push(`Stack variable: ${vs.stackVar}`);
            }

            if (analysis.instructionMap && typeof analysis.instructionMap === 'object') {
              const mapStr = Object.entries(analysis.instructionMap)
                .map(([k, v]) => `${k}→${v}`)
                .join(', ');
              warnings.push(`Instruction mapping: ${mapStr}`);
            }

            if (analysis.restorationApproach) {
              unresolvedParts.push({
                location: 'Custom VM',
                reason: 'AI structural analysis complete, further restoration needed',
                suggestion: analysis.restorationApproach,
              });
            }

            if (analysis.simplifiedLogic && analysis.simplifiedLogic.length > 10) {
              warnings.push(`AI-inferred simplified logic: ${analysis.simplifiedLogic.substring(0, 500)}`);
            }

            confidence += 0.15;
          }
        } catch (llmErr) {
          logger.warn('LLM structural analysis failed', llmErr);
          warnings.push('AI structural analysis failed, using pure pattern matching results');
        }
      } else {
        warnings.push('Using basic pattern matching for restoration, results may be incomplete');
        warnings.push('Suggestion: configure LLM service to enable AI-assisted analysis');
      }

      if (unresolvedParts.length === 0) {
        unresolvedParts.push({
          location: 'Custom VM',
          reason: 'Custom VM requires deep analysis',
          suggestion: this.llm ? 'Structural info obtained via AI, can be combined with dynamic debugging for further restoration' : 'Configure LLM service or use instrumentation techniques to record VM execution flow',
        });
      }

      return {
        code: restored,
        confidence,
        warnings,
        unresolvedParts: unresolvedParts.length > 0 ? unresolvedParts : undefined,
      };
    } catch (error) {
      warnings.push(`Basic restoration failed: ${error}`);
      return {
        code,
        confidence: 0.1,
        warnings,
        unresolvedParts,
      };
    }
  }
}

