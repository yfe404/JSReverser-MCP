/**
 * Advanced Deobfuscation Module - Supports latest 2024-2025 obfuscation techniques
 *
 * Supported obfuscation types:
 * 1. Invisible Unicode Obfuscation (2025 new technique)
 * 2. VM Protection
 * 3. Control Flow Flattening
 * 4. String Array Rotation
 * 5. Dead Code Injection
 * 6. Opaque Predicates
 * 7. Custom Obfuscators
 */

import { logger } from '../../utils/logger.js';
import { LLMService } from '../../services/LLMService.js';
import * as parser from '@babel/parser';
import traverseImport from '@babel/traverse';
const traverse = (traverseImport as unknown as {default?: typeof traverseImport}).default ?? traverseImport;
import generateImport from '@babel/generator';
const generate = (generateImport as unknown as {default?: typeof generateImport}).default ?? generateImport;
import * as t from '@babel/types';

export interface AdvancedDeobfuscateOptions {
  code: string;
  detectOnly?: boolean; // Only detect obfuscation types
  aggressiveVM?: boolean; // Aggressive VM deobfuscation
  useASTOptimization?: boolean; // Use AST optimization
  timeout?: number; // Timeout in milliseconds
}

export interface AdvancedDeobfuscateResult {
  code: string;
  detectedTechniques: string[];
  confidence: number;
  warnings: string[];
  astOptimized?: boolean; // Whether AST was optimized
  vmDetected?: {
    type: string;
    instructions: number;
    deobfuscated: boolean;
  };
}

export class AdvancedDeobfuscator {
  private llm?: LLMService;

  constructor(llm?: LLMService) {
    this.llm = llm;
  }

  /**
   * Advanced deobfuscation entry point
   */
  async deobfuscate(options: AdvancedDeobfuscateOptions): Promise<AdvancedDeobfuscateResult> {
    logger.info('Starting advanced deobfuscation...');
    const startTime = Date.now();

    let code = options.code;
    const detectedTechniques: string[] = [];
    const warnings: string[] = [];
    let vmDetected: AdvancedDeobfuscateResult['vmDetected'];
    let astOptimized = false;

    try {
      // 0. Preprocessing: normalize code format
      code = this.normalizeCode(code);

      // 1. Detect Invisible Unicode obfuscation
      if (this.detectInvisibleUnicode(code)) {
        detectedTechniques.push('invisible-unicode');
        logger.info('Detected: Invisible Unicode Obfuscation (2025)');
        code = this.decodeInvisibleUnicode(code);
      }

      // 2. Detect and remove string encoding
      if (this.detectStringEncoding(code)) {
        detectedTechniques.push('string-encoding');
        logger.info('Detected: String Encoding');
        code = this.decodeStrings(code);
      }

      // 3. Detect VM protection
      const vmInfo = this.detectVMProtection(code);
      if (vmInfo.detected) {
        detectedTechniques.push('vm-protection');
        logger.info(`Detected: VM Protection (${vmInfo.type})`);
        vmDetected = {
          type: vmInfo.type,
          instructions: vmInfo.instructionCount,
          deobfuscated: false,
        };

        if (options.aggressiveVM) {
          const vmResult = await this.deobfuscateVM(code, vmInfo);
          if (vmResult.success) {
            code = vmResult.code;
            vmDetected.deobfuscated = true;
          } else {
            warnings.push('VM deobfuscation failed, code may be incomplete');
          }
        }
      }

      // 4. Detect control flow flattening
      if (this.detectControlFlowFlattening(code)) {
        detectedTechniques.push('control-flow-flattening');
        logger.info('Detected: Control Flow Flattening');
        code = await this.unflattenControlFlow(code);
      }

      // 5. Detect string array rotation
      if (this.detectStringArrayRotation(code)) {
        detectedTechniques.push('string-array-rotation');
        logger.info('Detected: String Array Rotation');
        code = this.derotateStringArray(code);
      }

      // 6. Detect dead code injection
      if (this.detectDeadCodeInjection(code)) {
        detectedTechniques.push('dead-code-injection');
        logger.info('Detected: Dead Code Injection');
        code = this.removeDeadCode(code);
      }

      // 7. Detect opaque predicates
      if (this.detectOpaquePredicates(code)) {
        detectedTechniques.push('opaque-predicates');
        logger.info('Detected: Opaque Predicates');
        code = this.removeOpaquePredicates(code);
      }

      // 8. AST optimization (constant folding, expression simplification)
      if (options.useASTOptimization !== false) {
        logger.info('Applying AST optimizations...');
        const optimized = this.applyASTOptimizations(code);
        if (optimized !== code) {
          code = optimized;
          astOptimized = true;
          detectedTechniques.push('ast-optimized');
        }
      }

      // 9. Use LLM for final cleanup
      if (this.llm && detectedTechniques.length > 0) {
        logger.info('Using LLM for final cleanup...');
        const llmResult = await this.llmCleanup(code, detectedTechniques);
        if (llmResult) {
          code = llmResult;
        }
      }

      const duration = Date.now() - startTime;
      const confidence = this.calculateConfidence(detectedTechniques, warnings, code);

      logger.success(`Advanced deobfuscation completed in ${duration}ms`);

      return {
        code,
        detectedTechniques,
        confidence,
        warnings,
        vmDetected,
        astOptimized,
      };
    } catch (error) {
      logger.error('Advanced deobfuscation failed', error);
      throw error;
    }
  }

  /**
   * Detect Invisible Unicode obfuscation (2025 new technique)
   * Uses invisible Unicode characters to represent binary data
   */
  private detectInvisibleUnicode(code: string): boolean {
    // Detect zero-width characters
    const invisibleChars = [
      '\u200B', // Zero Width Space
      '\u200C', // Zero Width Non-Joiner
      '\u200D', // Zero Width Joiner
      '\u2060', // Word Joiner
      '\uFEFF', // Zero Width No-Break Space
    ];

    return invisibleChars.some(char => code.includes(char));
  }

  /**
   * Decode Invisible Unicode obfuscation
   */
  private decodeInvisibleUnicode(code: string): string {
    logger.info('Decoding invisible unicode...');

    // Mapping: invisible characters -> binary bits
    const charToBit: Record<string, string> = {
      '\u200B': '0',
      '\u200C': '1',
      '\u200D': '00',
      '\u2060': '01',
      '\uFEFF': '10',
    };

    let decoded = code;

    // Find all invisible character sequences
    const invisiblePattern = /[\u200B\u200C\u200D\u2060\uFEFF]+/g;
    const matches = code.match(invisiblePattern);

    if (matches) {
      matches.forEach(match => {
        // Convert to binary
        let binary = '';
        for (const char of match) {
          binary += charToBit[char] || '';
        }

        // Binary to string
        if (binary.length % 8 === 0) {
          let text = '';
          for (let i = 0; i < binary.length; i += 8) {
            const byte = binary.substring(i, i + 8);
            text += String.fromCharCode(parseInt(byte, 2));
          }
          decoded = decoded.replace(match, text);
        }
      });
    }

    return decoded;
  }

  /**
   * Detect VM protection
   */
  private detectVMProtection(code: string): {
    detected: boolean;
    type: string;
    instructionCount: number;
  } {
    // VM characteristics:
    // 1. Large number of switch-case statements
    // 2. Instruction arrays
    // 3. Program counter (PC)
    // 4. Stack operations

    const vmPatterns = [
      /while\s*\(\s*true\s*\)\s*\{[\s\S]*?switch\s*\(/i, // Infinite loop + switch
      /var\s+\w+\s*=\s*\[\s*\d+(?:\s*,\s*\d+){10,}\s*\]/i, // Instruction array
      /\w+\[pc\+\+\]/i, // PC increment
      /stack\.push|stack\.pop/i, // Stack operations
    ];

    const matchCount = vmPatterns.filter(pattern => pattern.test(code)).length;

    if (matchCount >= 2) {
      return {
        detected: true,
        type: matchCount >= 3 ? 'custom-vm' : 'simple-vm',
        instructionCount: this.countVMInstructions(code),
      };
    }

    return { detected: false, type: 'none', instructionCount: 0 };
  }

  /**
   * Count VM instruction count
   */
  private countVMInstructions(code: string): number {
    const match = code.match(/case\s+\d+:/g);
    return match ? match.length : 0;
  }

  /**
   * VM deobfuscation
   *
   * VM protection is an advanced obfuscation technique that converts JavaScript code into custom virtual machine instructions
   * Common VM obfuscators:
   * 1. JScrambler VM Protection
   * 2. Custom bytecode VM (e.g., used by TikTok)
   * 3. Stack-based VM
   *
   * Deobfuscation strategy:
   * 1. Identify VM structure (instruction set, interpreter, stack/registers)
   * 2. Extract instruction sequences
   * 3. Symbolic execution or dynamic tracing
   * 4. Reconstruct original control flow
   * 5. LLM-assisted understanding of complex logic
   */
  private async deobfuscateVM(
    code: string,
    vmInfo: { type: string; instructionCount: number }
  ): Promise<{ success: boolean; code: string }> {
    logger.warn('VM deobfuscation is experimental and may fail');

    try {
      // Step 1: Try to identify VM structure
      const vmStructure = this.analyzeVMStructure(code);

      if (vmStructure.hasInterpreter) {
        logger.info(`Detected VM interpreter with ${vmStructure.instructionTypes.length} instruction types`);
      }

      // Step 2: Extract key VM components
      const vmComponents = this.extractVMComponents(code);

      // Step 3: Use LLM to assist in understanding VM logic (optimized prompt)
      if (this.llm) {
        const prompt = this.buildVMDeobfuscationPrompt(code, vmInfo, vmStructure, vmComponents);

        const response = await this.llm.chat([
          {
            role: 'system',
            content: `# Role
You are a world-class expert in JavaScript VM deobfuscation and reverse engineering with expertise in:
- Virtual machine architecture and instruction set design
- Bytecode interpretation and JIT compilation
- Control flow reconstruction from VM instructions
- Stack-based and register-based VM analysis
- Obfuscation techniques used by TikTok, Shopee, and commercial protectors

# Task
Analyze VM-protected JavaScript code and reconstruct the original, readable JavaScript.

# Methodology
1. **Identify VM Components**: Locate instruction array, interpreter loop, stack/registers
2. **Decode Instructions**: Map VM opcodes to JavaScript operations
3. **Reconstruct Control Flow**: Convert VM jumps/branches to if/while/for
4. **Simplify**: Remove VM overhead and restore natural code structure
5. **Validate**: Ensure output is syntactically valid and functionally equivalent

# Critical Requirements
- Output ONLY valid, executable JavaScript (no markdown, no explanations)
- Preserve exact program logic and side effects
- Use meaningful variable names based on context
- Add brief comments for complex patterns
- Do NOT hallucinate or guess functionality
- If uncertain, preserve original code structure

# Output Format
Return clean JavaScript code without any wrapper or formatting.`
          },
          { role: 'user', content: prompt },
        ], {
          temperature: 0.05, // Very low temperature for the most deterministic output
          maxTokens: 4000,
        });

        // Validate whether LLM output is valid JavaScript
        const deobfuscatedCode = this.extractCodeFromLLMResponse(response.content);

        if (this.isValidJavaScript(deobfuscatedCode)) {
          logger.success('VM deobfuscation succeeded via LLM');
          return {
            success: true,
            code: deobfuscatedCode,
          };
        } else {
          logger.warn('LLM output is not valid JavaScript, falling back to original');
        }
      }

      // Step 4: If LLM fails, try rule-based simplification
      const simplifiedCode = this.simplifyVMCode(code, vmComponents);

      return {
        success: simplifiedCode !== code,
        code: simplifiedCode
      };
    } catch (error) {
      logger.error('VM deobfuscation failed', error);
      return { success: false, code };
    }
  }

  /**
   * Analyze VM structure
   */
  private analyzeVMStructure(code: string): {
    hasInterpreter: boolean;
    instructionTypes: string[];
    hasStack: boolean;
    hasRegisters: boolean;
  } {
    const structure = {
      hasInterpreter: false,
      instructionTypes: [] as string[],
      hasStack: false,
      hasRegisters: false,
    };

    // Detect interpreter loop pattern
    if (/while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/.test(code)) {
      structure.hasInterpreter = true;
    }

    // Detect instruction dispatch pattern (switch-case)
    const switchMatches = code.match(/case\s+0x[0-9a-f]+:/gi);
    if (switchMatches && switchMatches.length > 10) {
      structure.hasInterpreter = true;
      structure.instructionTypes = switchMatches.map(m => m.replace(/case\s+/i, '').replace(/:/, ''));
    }

    // Detect stack operations
    if (/\.push\(|\.pop\(/.test(code)) {
      structure.hasStack = true;
    }

    // Detect register pattern
    if (/r\d+\s*=|reg\[\d+\]/.test(code)) {
      structure.hasRegisters = true;
    }

    return structure;
  }

  /**
   * Extract VM components
   */
  private extractVMComponents(code: string): {
    instructionArray?: string;
    dataArray?: string;
    interpreterFunction?: string;
  } {
    const components: any = {};

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      traverse(ast, {
        // Find large arrays (possibly instructions or data)
        VariableDeclarator(path: any) {
          if (t.isArrayExpression(path.node.init)) {
            const arrayLength = path.node.init.elements.length;

            if (arrayLength > 50) {
              const arrayName = t.isIdentifier(path.node.id) ? path.node.id.name : 'unknown';

              // Check array content type
              const firstElement = path.node.init.elements[0];
              if (t.isNumericLiteral(firstElement)) {
                components.instructionArray = arrayName;
              } else if (t.isStringLiteral(firstElement)) {
                components.dataArray = arrayName;
              }
            }
          }
        },

        // Find interpreter function (contains large switch statement)
        FunctionDeclaration(path: any) {
          let hasBigSwitch = false;

          traverse(path.node, {
            SwitchStatement(switchPath: any) {
              if (switchPath.node.cases.length > 10) {
                hasBigSwitch = true;
              }
            },
          }, path.scope, path);

          if (hasBigSwitch && t.isIdentifier(path.node.id)) {
            components.interpreterFunction = path.node.id.name;
          }
        },
      });
    } catch (error) {
      logger.debug('Failed to extract VM components:', error);
    }

    return components;
  }

  /**
   * Build VM deobfuscation prompt
   */
  private buildVMDeobfuscationPrompt(
    code: string,
    vmInfo: { type: string; instructionCount: number },
    vmStructure: any,
    vmComponents: any
  ): string {
    const codeSnippet = code.length > 6000 ? code.substring(0, 6000) + '\n\n// ... (code truncated)' : code;

    return `# VM Deobfuscation Analysis

## VM Profile
- **Architecture**: ${vmInfo.type}
- **Instruction Count**: ${vmInfo.instructionCount}
- **Interpreter Loop**: ${vmStructure.hasInterpreter ? 'Detected' : 'Not detected'}
- **Stack Operations**: ${vmStructure.hasStack ? 'Present' : 'Absent'}
- **Register Usage**: ${vmStructure.hasRegisters ? 'Present' : 'Absent'}
- **Instruction Variety**: ${vmStructure.instructionTypes.length} distinct types

## Identified Components
${vmComponents.instructionArray ? `✓ Instruction Array: Found at ${vmComponents.instructionArray}` : '✗ Instruction Array: Not found'}
${vmComponents.dataArray ? `✓ Data Array: Found at ${vmComponents.dataArray}` : '✗ Data Array: Not found'}
${vmComponents.interpreterFunction ? `✓ Interpreter Function: Found at ${vmComponents.interpreterFunction}` : '✗ Interpreter Function: Not found'}

## VM-Protected Code
\`\`\`javascript
${codeSnippet}
\`\`\`

## Deobfuscation Instructions (Chain-of-Thought)

### Step 1: VM Structure Analysis
Examine the code to identify:
- Instruction array (usually a large array of numbers/strings)
- Interpreter loop (while/for loop processing instructions)
- Stack/register variables
- Opcode handlers (switch-case or if-else chains)

### Step 2: Instruction Decoding
For each instruction type, determine:
- What JavaScript operation it represents (e.g., opcode 0x01 = addition)
- How it manipulates the stack/registers
- What side effects it has (function calls, property access, etc.)

### Step 3: Control Flow Reconstruction
- Map VM jumps/branches to JavaScript if/while/for statements
- Identify function calls and returns
- Reconstruct try-catch blocks if present

### Step 4: Code Generation
- Replace VM instruction sequences with equivalent JavaScript
- Use meaningful variable names based on usage context
- Remove VM overhead (interpreter loop, stack management)
- Preserve all side effects and program behavior

### Step 5: Validation
- Ensure output is syntactically valid JavaScript
- Verify no functionality is lost
- Add comments for complex patterns

## Example Transformation (Few-shot Learning)

**VM Code (Before)**:
\`\`\`javascript
var vm = [0x01, 0x05, 0x02, 0x03, 0x10];
var stack = [];
for(var i=0; i<vm.length; i++) {
  switch(vm[i]) {
    case 0x01: stack.push(5); break;
    case 0x02: stack.push(3); break;
    case 0x10: var b=stack.pop(), a=stack.pop(); stack.push(a+b); break;
  }
}
console.log(stack[0]);
\`\`\`

**Deobfuscated Code (After)**:
\`\`\`javascript
// VM instructions decoded: PUSH 5, PUSH 3, ADD
var result = 5 + 3;
console.log(result);
\`\`\`

## Critical Requirements
1. Output ONLY the deobfuscated JavaScript code
2. NO markdown code blocks, NO explanations, NO comments outside the code
3. Code must be syntactically valid and executable
4. Preserve exact program logic and side effects
5. If full deobfuscation is impossible, return the best partial result

## Output Format
Return clean JavaScript code starting immediately (no preamble).`;
  }

  /**
   * Extract code from LLM response
   */
  private extractCodeFromLLMResponse(response: string): string {
    // Remove markdown code block markers
    let code = response.trim();

    // Remove ```javascript or ```js markers
    code = code.replace(/^```(?:javascript|js)?\s*\n/i, '');
    code = code.replace(/\n```\s*$/i, '');

    return code.trim();
  }

  /**
   * Validate whether code is valid JavaScript
   */
  private isValidJavaScript(code: string): boolean {
    try {
      parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Simplify VM code (rule-based)
   */
  private simplifyVMCode(code: string, vmComponents: any): string {
    try {
      let simplified = code;

      // Remove VM interpreter function (if identifiable)
      if (vmComponents.interpreterFunction) {
        const regex = new RegExp(`function\\s+${vmComponents.interpreterFunction}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`, 'g');
        simplified = simplified.replace(regex, '// VM interpreter removed');
      }

      // Remove large instruction arrays
      if (vmComponents.instructionArray) {
        const regex = new RegExp(`var\\s+${vmComponents.instructionArray}\\s*=\\s*\\[[^\\]]*\\];`, 'g');
        simplified = simplified.replace(regex, '// VM instruction array removed');
      }

      return simplified;
    } catch (error) {
      logger.debug('Failed to simplify VM code:', error);
      return code;
    }
  }

  /**
   * Detect control flow flattening
   */
  private detectControlFlowFlattening(code: string): boolean {
    // Characteristics: many consecutive switch-cases + state variable
    const pattern = /while\s*\(\s*!!\s*\[\s*\]\s*\)\s*\{[\s\S]*?switch\s*\(/i;
    return pattern.test(code);
  }

  /**
   * Restore control flow - optimized version
   *
   * Control Flow Flattening is a common obfuscation technique
   * Uses optimized prompts for LLM-assisted deobfuscation
   */
  private async unflattenControlFlow(code: string): Promise<string> {
    logger.info('Unflattening control flow...');

    // Use LLM assistance (optimized prompt)
    if (this.llm) {
      try {
        const codeSnippet = code.length > 3000 ? code.substring(0, 3000) + '\n\n// ... (truncated)' : code;

        const response = await this.llm.chat([
          {
            role: 'system',
            content: `# Role
You are an expert in JavaScript control flow deobfuscation specializing in:
- Control flow flattening detection and removal
- Switch-case state machine analysis
- Dispatcher loop identification
- Control flow graph (CFG) reconstruction

# Task
Analyze control flow flattened JavaScript and reconstruct the original, natural control flow.

# Control Flow Flattening Pattern
Obfuscators replace normal if/while/for with a dispatcher loop:
\`\`\`javascript
// Flattened (obfuscated)
var state = '0';
while (true) {
  switch (state) {
    case '0': console.log('a'); state = '1'; break;
    case '1': console.log('b'); state = '2'; break;
    case '2': return;
  }
}

// Original (deobfuscated)
console.log('a');
console.log('b');
return;
\`\`\`

# Requirements
- Output ONLY valid JavaScript code
- Preserve exact program logic
- Remove dispatcher loops and state variables
- Restore natural if/while/for structures
- Use meaningful variable names`
          },
          {
            role: 'user',
            content: `# Control Flow Flattened Code
\`\`\`javascript
${codeSnippet}
\`\`\`

# Instructions
1. Identify the dispatcher loop (while/for with switch-case)
2. Trace state transitions to determine execution order
3. Reconstruct original control flow (if/while/for)
4. Remove state variables and dispatcher overhead
5. Return ONLY the deobfuscated code (no explanations)

Output the deobfuscated JavaScript code:`
          },
        ], {
          temperature: 0.1,
          maxTokens: 3000,
        });

        return this.extractCodeFromLLMResponse(response.content);
      } catch (error) {
        logger.warn('LLM control flow unflattening failed', error);
      }
    }

    return code;
  }

  // Placeholder for other detection and deobfuscation methods
  private detectStringArrayRotation(code: string): boolean {
    return /\w+\s*=\s*\w+\s*\+\s*0x[0-9a-f]+/.test(code);
  }

  /**
   * String array derotation
   * Based on CASCADE paper: String Array Rotate Function restoration
   *
   * Obfuscator.IO generates an IIFE to rotate the string array:
   * (function(getStringArray, target) {
   *   var stringArray = getStringArray();
   *   while (true) {
   *     try {
   *       var value = parseInt(...) / ... + ...;
   *       if (value === target) break;
   *       else stringArray.push(stringArray.shift());
   *     } catch { stringArray.push(stringArray.shift()); }
   *   }
   * })(getStringArray, 0x12345);
   */
  private derotateStringArray(code: string): string {
    logger.info('Derotating string array...');

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let derotated = 0;

      traverse(ast, {
        // Find string array rotation IIFE
        CallExpression(path) {
          // Check if it's an IIFE call
          if (!t.isFunctionExpression(path.node.callee) &&
              !t.isArrowFunctionExpression(path.node.callee)) {
            return;
          }

          const func = path.node.callee;
          if (!t.isFunctionExpression(func) || !t.isBlockStatement(func.body)) {
            return;
          }

          // Check if function body contains while loop and string array operations
          const hasWhileLoop = func.body.body.some(stmt => t.isWhileStatement(stmt));
          const hasArrayRotation = JSON.stringify(func.body).includes('push') &&
                                   JSON.stringify(func.body).includes('shift');

          if (hasWhileLoop && hasArrayRotation) {
            logger.debug('Found string array rotation IIFE');

            // Remove this IIFE since it only serves to rotate the array
            // The actual string array has already been rotated at runtime
            path.remove();
            derotated++;
          }
        },
      });

      if (derotated > 0) {
        logger.info(`Removed ${derotated} string array rotation functions`);
        return generate(ast, { comments: true, compact: false }).code;
      }

      return code;
    } catch (error) {
      logger.error('Failed to derotate string array:', error);
      return code;
    }
  }

  private detectDeadCodeInjection(code: string): boolean {
    return /if\s*\(\s*false\s*\)|if\s*\(\s*!!\s*\[\s*\]\s*\)/.test(code);
  }

  /**
   * Remove dead code
   *
   * Dead code injection is a common obfuscation technique, including:
   * 1. if (false) { ... } - code blocks that never execute
   * 2. if (!![] ) { ... } - conditions that are always true
   * 3. Unreachable code - code after return/throw
   * 4. Unused variables and functions
   */
  private removeDeadCode(code: string): string {
    logger.info('Removing dead code...');

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let removed = 0;

      traverse(ast, {
        // Remove if (false) { ... }
        IfStatement(path: any) {
          const test = path.node.test;

          // Check if (false)
          if (t.isBooleanLiteral(test) && test.value === false) {
            if (path.node.alternate) {
              // Has else branch, keep else
              path.replaceWith(path.node.alternate);
            } else {
              // No else branch, remove entirely
              path.remove();
            }
            removed++;
            return;
          }

          // Check if (true)
          if (t.isBooleanLiteral(test) && test.value === true) {
            // Keep then branch
            path.replaceWith(path.node.consequent);
            removed++;
            return;
          }

          // Check if (!![] ) - always true
          if (t.isUnaryExpression(test) && test.operator === '!' &&
              t.isUnaryExpression(test.argument) && test.argument.operator === '!' &&
              t.isArrayExpression(test.argument.argument)) {
            path.replaceWith(path.node.consequent);
            removed++;
            return;
          }
        },

        // Remove unreachable code after return/throw
        BlockStatement(path: any) {
          const body = path.node.body;
          let foundTerminator = false;
          const newBody: any[] = [];

          for (const stmt of body) {
            if (foundTerminator) {
              // Skip code after return/throw
              removed++;
              continue;
            }

            newBody.push(stmt);

            if (t.isReturnStatement(stmt) || t.isThrowStatement(stmt)) {
              foundTerminator = true;
            }
          }

          if (newBody.length < body.length) {
            path.node.body = newBody;
          }
        },
      });

      if (removed > 0) {
        logger.info(`Removed ${removed} dead code blocks`);
        return generate(ast, { comments: true, compact: false }).code;
      }

      return code;
    } catch (error) {
      logger.error('Failed to remove dead code:', error);
      return code;
    }
  }

  private detectOpaquePredicates(code: string): boolean {
    return /if\s*\(\s*\d+\s*[<>!=]+\s*\d+\s*\)/.test(code);
  }

  /**
   * Remove opaque predicates
   *
   * Opaque predicates are conditional expressions whose results are known at compile time
   * but appear dynamic at runtime.
   * Examples:
   * 1. if (5 > 3) { ... } - always true
   * 2. if (1 === 2) { ... } - always false
   * 3. if (x * 0 === 0) { ... } - always true (for any number x)
   * 4. if ((x | 0) === x) { ... } - always true (for integer x)
   */
  private removeOpaquePredicates(code: string): string {
    logger.info('Removing opaque predicates...');

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let removed = 0;

      traverse(ast, {
        IfStatement(path: any) {
          const test = path.node.test;

          // Check simple numeric comparisons: if (5 > 3)
          if (t.isBinaryExpression(test)) {
            const left = test.left;
            const right = test.right;
            const operator = test.operator;

            // Both sides are numeric literals
            if (t.isNumericLiteral(left) && t.isNumericLiteral(right)) {
              let result: boolean | undefined;

              switch (operator) {
                case '>':
                  result = left.value > right.value;
                  break;
                case '<':
                  result = left.value < right.value;
                  break;
                case '>=':
                  result = left.value >= right.value;
                  break;
                case '<=':
                  result = left.value <= right.value;
                  break;
                case '===':
                case '==':
                  result = left.value === right.value;
                  break;
                case '!==':
                case '!=':
                  result = left.value !== right.value;
                  break;
              }

              if (result !== undefined) {
                if (result) {
                  // Condition is always true, keep then branch
                  path.replaceWith(path.node.consequent);
                } else {
                  // Condition is always false
                  if (path.node.alternate) {
                    path.replaceWith(path.node.alternate);
                  } else {
                    path.remove();
                  }
                }
                removed++;
                return;
              }
            }
          }

          // Check x * 0 === 0 type predicates
          if (t.isBinaryExpression(test) && (test.operator === '===' || test.operator === '==')) {
            const left = test.left;
            const right = test.right;

            // x * 0 === 0
            if (t.isBinaryExpression(left) && left.operator === '*' &&
                t.isNumericLiteral(right) && right.value === 0) {
              if ((t.isNumericLiteral(left.left) && left.left.value === 0) ||
                  (t.isNumericLiteral(left.right) && left.right.value === 0)) {
                // Always true
                path.replaceWith(path.node.consequent);
                removed++;
                return;
              }
            }
          }
        },
      });

      if (removed > 0) {
        logger.info(`Removed ${removed} opaque predicates`);
        return generate(ast, { comments: true, compact: false }).code;
      }

      return code;
    } catch (error) {
      logger.error('Failed to remove opaque predicates:', error);
      return code;
    }
  }

  /**
   * LLM code cleanup
   *
   * After completing rule-based deobfuscation, use LLM for final cleanup and optimization:
   * 1. Improve variable naming
   * 2. Simplify complex expressions
   * 3. Add meaningful comments
   * 4. Refactor redundant code
   */
  private async llmCleanup(code: string, techniques: string[]): Promise<string | null> {
    if (!this.llm) return null;

    try {
      const codeSnippet = code.length > 3000 ? code.substring(0, 3000) + '\n\n// ... (code truncated)' : code;

      const prompt = `# Code Cleanup Task

## Detected Obfuscation Techniques
${techniques.map(t => `- ${t}`).join('\n')}

## Deobfuscated Code (needs cleanup)
\`\`\`javascript
${codeSnippet}
\`\`\`

## Your Task
Clean up and improve this deobfuscated JavaScript code:

1. **Variable Naming**: Rename variables to meaningful names based on their usage
   - Avoid generic names like 'a', 'b', 'temp'
   - Use descriptive names like 'userConfig', 'apiEndpoint', 'responseData'

2. **Code Structure**: Improve readability
   - Remove unnecessary parentheses and brackets
   - Simplify complex expressions
   - Extract magic numbers to named constants

3. **Comments**: Add brief comments for:
   - Complex logic or algorithms
   - Non-obvious functionality
   - Important data structures

4. **Consistency**: Ensure consistent code style
   - Use consistent indentation
   - Follow JavaScript best practices

## Important Rules
- Preserve ALL original functionality
- Do NOT remove any functional code
- Do NOT change the program logic
- Output ONLY valid JavaScript code
- Do NOT add explanations outside the code

## Output Format
Return only the cleaned JavaScript code without markdown formatting.`;

      const response = await this.llm.chat([
        {
          role: 'system',
          content: `# Role
You are an expert JavaScript code reviewer and refactoring specialist with expertise in:
- Code readability and maintainability improvement
- Semantic variable naming based on usage context
- Code smell detection and refactoring
- JavaScript best practices (ES6+, clean code principles)
- Preserving exact program functionality during refactoring

# Task
Clean up and improve deobfuscated JavaScript code while preserving 100% of its functionality.

# Refactoring Principles
1. **Semantic Naming**: Infer variable purpose from usage patterns
   - API calls → apiClient, fetchData, apiResponse
   - DOM elements → userInput, submitButton, errorMessage
   - Crypto operations → encryptedData, decryptionKey, hashValue
   - Loops/counters → index, itemCount, currentPage

2. **Code Simplification**: Remove obfuscation artifacts
   - Unnecessary IIFEs and closures
   - Redundant variable assignments
   - Complex ternary chains → if-else
   - Magic numbers → named constants

3. **Structure Improvement**: Enhance readability
   - Extract repeated code to functions
   - Group related operations
   - Consistent indentation and spacing
   - Logical code organization

# Critical Constraints
- **NEVER** change program logic or behavior
- **NEVER** remove functional code (even if it looks redundant)
- **NEVER** add new functionality
- **ONLY** improve naming, structure, and readability
- Output must be syntactically valid JavaScript
- Preserve all side effects and edge cases

# Output Format
Return ONLY the cleaned JavaScript code (no markdown, no explanations).`
        },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.15, // Low temperature to maintain consistency and determinism
        maxTokens: 3000,
      });

      const cleanedCode = this.extractCodeFromLLMResponse(response.content);

      // Validate whether the cleaned code is valid
      if (this.isValidJavaScript(cleanedCode)) {
        logger.success('LLM cleanup succeeded');
        return cleanedCode;
      } else {
        logger.warn('LLM cleanup produced invalid JavaScript');
        return null;
      }
    } catch (error) {
      logger.warn('LLM cleanup failed', error);
      return null;
    }
  }

  /**
   * Normalize code format
   */
  private normalizeCode(code: string): string {
    // Remove excess whitespace characters
    code = code.replace(/\s+/g, ' ');
    // Remove obfuscation in comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/\/\/.*/g, '');
    return code.trim();
  }

  /**
   * Detect string encoding
   */
  private detectStringEncoding(code: string): boolean {
    // Detect common string encoding patterns
    const patterns = [
      /\\x[0-9a-f]{2}/i, // Hexadecimal encoding
      /\\u[0-9a-f]{4}/i, // Unicode encoding
      /String\.fromCharCode/i, // fromCharCode
      /atob\(/i, // Base64 decoding
    ];
    return patterns.some(p => p.test(code));
  }

  /**
   * Decode strings
   */
  private decodeStrings(code: string): string {
    logger.info('Decoding strings...');

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let decoded = 0;

      traverse(ast, {
        // Decode String.fromCharCode(...)
        CallExpression(path: any) {
          if (
            t.isMemberExpression(path.node.callee) &&
            t.isIdentifier(path.node.callee.object, { name: 'String' }) &&
            t.isIdentifier(path.node.callee.property, { name: 'fromCharCode' })
          ) {
            // Check if all arguments are numbers
            const allNumbers = path.node.arguments.every((arg: any) => t.isNumericLiteral(arg));

            if (allNumbers) {
              const charCodes = path.node.arguments.map((arg: any) => arg.value);
              const decodedString = String.fromCharCode(...charCodes);
              path.replaceWith(t.stringLiteral(decodedString));
              decoded++;
            }
          }
        },
      });

      if (decoded > 0) {
        logger.info(`Decoded ${decoded} string expressions`);
        return generate(ast, { comments: false, compact: false }).code;
      }

      return code;
    } catch (error) {
      logger.error('Failed to decode strings:', error);
      return code;
    }
  }

  /**
   * Apply AST optimizations
   */
  private applyASTOptimizations(code: string): string {
    logger.info('Applying AST optimizations...');

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let optimized = 0;

      traverse(ast, {
        // Constant folding: evaluate constant expressions
        BinaryExpression(path: any) {
          const { left, right, operator } = path.node;

          if (t.isNumericLiteral(left) && t.isNumericLiteral(right)) {
            let result: number | undefined;

            switch (operator) {
              case '+': result = left.value + right.value; break;
              case '-': result = left.value - right.value; break;
              case '*': result = left.value * right.value; break;
              case '/': result = left.value / right.value; break;
              case '%': result = left.value % right.value; break;
              case '**': result = Math.pow(left.value, right.value); break;
            }

            if (result !== undefined) {
              path.replaceWith(t.numericLiteral(result));
              optimized++;
            }
          }
        },

        // Simplify logical expressions
        LogicalExpression(path: any) {
          const { left, right, operator } = path.node;

          // true && x => x
          if (operator === '&&' && t.isBooleanLiteral(left) && left.value === true) {
            path.replaceWith(right);
            optimized++;
          }

          // false || x => x
          if (operator === '||' && t.isBooleanLiteral(left) && left.value === false) {
            path.replaceWith(right);
            optimized++;
          }
        },

        // Remove empty statements
        EmptyStatement(path: any) {
          path.remove();
          optimized++;
        },

        // Simplify ternary expressions
        ConditionalExpression(path: any) {
          const { test, consequent, alternate } = path.node;

          // true ? a : b => a
          if (t.isBooleanLiteral(test) && test.value === true) {
            path.replaceWith(consequent);
            optimized++;
          }

          // false ? a : b => b
          if (t.isBooleanLiteral(test) && test.value === false) {
            path.replaceWith(alternate);
            optimized++;
          }
        },
      });

      if (optimized > 0) {
        logger.info(`Applied ${optimized} AST optimizations`);
        return generate(ast, { comments: true, compact: false }).code;
      }

      return code;
    } catch (error) {
      logger.error('Failed to apply AST optimizations:', error);
      return code;
    }
  }

  /**
   * Calculate deobfuscation confidence
   *
   * Calculates confidence score based on multiple factors:
   * 1. Number of successfully detected and processed obfuscation techniques
   * 2. Number of warnings and errors
   * 3. Code complexity change
   * 4. AST node count change
   */
  private calculateConfidence(techniques: string[], warnings: string[], code: string): number {
    let confidence = 0.3; // Base confidence

    // Increase confidence for each successfully processed obfuscation technique
    const techniqueBonus = Math.min(techniques.length * 0.12, 0.5);
    confidence += techniqueBonus;

    // Each warning reduces confidence
    const warningPenalty = warnings.length * 0.08;
    confidence -= warningPenalty;

    // Extra confidence for specific techniques
    const highConfidenceTechniques = [
      'invisible-unicode',
      'string-array-rotation',
      'dead-code-injection',
      'opaque-predicates',
      'string-encoding',
      'ast-optimized',
    ];

    const highConfidenceCount = techniques.filter(t =>
      highConfidenceTechniques.some(ht => t.includes(ht))
    ).length;

    confidence += highConfidenceCount * 0.05;

    // VM deobfuscation has lower confidence
    if (techniques.some(t => t.includes('vm-protection'))) {
      confidence -= 0.15;
    }

    // Control flow flattening has medium confidence
    if (techniques.some(t => t.includes('control-flow-flattening'))) {
      confidence -= 0.05;
    }

    // Adjust confidence based on code complexity
    const complexity = this.estimateCodeComplexity(code);
    if (complexity < 10) {
      confidence += 0.1; // Simple code is easier to deobfuscate
    } else if (complexity > 100) {
      confidence -= 0.1; // Complex code is harder to deobfuscate
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  /**
   * Estimate code complexity
   */
  private estimateCodeComplexity(code: string): number {
    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let complexity = 0;

      traverse(ast, {
        // Each function increases complexity
        FunctionDeclaration() { complexity += 2; },
        FunctionExpression() { complexity += 2; },
        ArrowFunctionExpression() { complexity += 2; },

        // Each conditional statement increases complexity
        IfStatement() { complexity += 1; },
        SwitchStatement() { complexity += 2; },
        ConditionalExpression() { complexity += 1; },

        // Each loop increases complexity
        WhileStatement() { complexity += 2; },
        ForStatement() { complexity += 2; },
        DoWhileStatement() { complexity += 2; },

        // Each try-catch increases complexity
        TryStatement() { complexity += 3; },
      });

      return complexity;
    } catch {
      // If parsing fails, return high complexity
      return 100;
    }
  }
}

