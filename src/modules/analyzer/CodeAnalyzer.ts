 /**
 * Code understanding module - AI-assisted code semantic analysis
 */

import * as parser from '@babel/parser';
import traverseImport from '@babel/traverse';
const traverse = (traverseImport as unknown as {default?: typeof traverseImport}).default ?? traverseImport;
import * as t from '@babel/types';
import type {
  UnderstandCodeOptions,
  UnderstandCodeResult,
  CodeStructure,
  TechStack,
  BusinessLogic,
  DataFlow,
  SecurityRisk,
  FunctionInfo,
  ClassInfo,
  CallGraph,
} from '../../types/index.js';
import { LLMService } from '../../services/LLMService.js';
import { logger } from '../../utils/logger.js';

export class CodeAnalyzer {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  /**
   * Understand code
   */
  async understand(options: UnderstandCodeOptions): Promise<UnderstandCodeResult> {
    logger.info('Starting code understanding...');
    const startTime = Date.now();

    try {
      const { code, context, focus = 'all' } = options;

      // 1. Static analysis - extract code structure
      const structure = await this.analyzeStructure(code);
      logger.debug('Code structure analyzed');

      // 2. AI analysis - deep understanding
      const aiAnalysis = await this.aiAnalyze(code, focus);
      logger.debug('AI analysis completed');

      // 3. Tech stack detection
      const techStack = this.detectTechStack(code, aiAnalysis);
      logger.debug('Tech stack detected');

      // 4. Business logic understanding
      const businessLogic = this.extractBusinessLogic(aiAnalysis, context);
      logger.debug('Business logic extracted');

      // 5. Data flow analysis
      const dataFlow = await this.analyzeDataFlow(code);
      logger.debug('Data flow analyzed');

      // 6. Security risk identification
      const securityRisks = this.identifySecurityRisks(code, aiAnalysis);
      logger.debug('Security risks identified');

      // 7. Code pattern and anti-pattern detection
      const { patterns, antiPatterns } = this.detectCodePatterns(code);
      logger.debug(`Detected ${patterns.length} patterns and ${antiPatterns.length} anti-patterns`);

      // 8. Complexity metrics analysis
      const complexityMetrics = this.analyzeComplexityMetrics(code);
      logger.debug('Complexity metrics calculated');

      // 9. Code quality scoring (integrating new metrics)
      const qualityScore = this.calculateQualityScore(
        structure,
        securityRisks,
        aiAnalysis,
        complexityMetrics,
        antiPatterns
      );

      const duration = Date.now() - startTime;
      logger.success(`Code understanding completed in ${duration}ms`);

      return {
        structure,
        techStack,
        businessLogic,
        dataFlow,
        securityRisks,
        qualityScore,
        // Add new analysis results
        codePatterns: patterns,
        antiPatterns,
        complexityMetrics,
      };
    } catch (error) {
      logger.error('Code understanding failed', error);
      throw error;
    }
  }

  /**
   * Analyze code structure
   */
  private async analyzeStructure(code: string): Promise<CodeStructure> {
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // Save this reference for use in traverse callbacks
      const self = this;

      traverse(ast, {
        FunctionDeclaration(path) {
          const node = path.node;
          functions.push({
            name: node.id?.name || 'anonymous',
            params: node.params.map((p) => (p.type === 'Identifier' ? p.name : 'unknown')),
            location: {
              file: 'current',
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column,
            },
            complexity: self.calculateComplexity(path),
          });
        },

        FunctionExpression(path) {
          const node = path.node;
          const parent = path.parent;
          let name = 'anonymous';

          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            name = parent.id.name;
          } else if (parent.type === 'AssignmentExpression' && parent.left.type === 'Identifier') {
            name = parent.left.name;
          }

          functions.push({
            name,
            params: node.params.map((p) => (p.type === 'Identifier' ? p.name : 'unknown')),
            location: {
              file: 'current',
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column,
            },
            complexity: self.calculateComplexity(path),
          });
        },

        ArrowFunctionExpression(path) {
          const node = path.node;
          const parent = path.parent;
          let name = 'arrow';

          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            name = parent.id.name;
          }

          functions.push({
            name,
            params: node.params.map((p) => (p.type === 'Identifier' ? p.name : 'unknown')),
            location: {
              file: 'current',
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column,
            },
            complexity: self.calculateComplexity(path),
          });
        },

        ClassDeclaration(path) {
          const node = path.node;
          const methods: FunctionInfo[] = [];
          const properties: ClassInfo['properties'] = [];

          path.traverse({
            ClassMethod(methodPath) {
              const method = methodPath.node;
              methods.push({
                name: method.key.type === 'Identifier' ? method.key.name : 'unknown',
                params: method.params.map((p) => (p.type === 'Identifier' ? p.name : 'unknown')),
                location: {
                  file: 'current',
                  line: method.loc?.start.line || 0,
                  column: method.loc?.start.column,
                },
                complexity: 1,
              });
            },
            ClassProperty(propertyPath) {
              const property = propertyPath.node;
              if (property.key.type === 'Identifier') {
                properties.push({
                  name: property.key.name,
                  type: undefined,
                  value: undefined,
                });
              }
            },
          });

          classes.push({
            name: node.id?.name || 'anonymous',
            methods,
            properties,
            location: {
              file: 'current',
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column,
            },
          });
        },
      });
    } catch (error) {
      logger.warn('Failed to parse code structure', error);
    }

    // Analyze module imports and exports
    const modules = this.analyzeModules(code);

    // Build call graph
    const callGraph = this.buildCallGraph(functions, code);

    return {
      functions,
      classes,
      modules,
      callGraph,
    };
  }

  /**
   * AI deep analysis
   */
  private async aiAnalyze(code: string, focus: string): Promise<Record<string, unknown>> {
    try {
      const messages = this.llm.generateCodeAnalysisPrompt(code, focus);
      const response = await this.llm.chat(messages, { temperature: 0.3, maxTokens: 2000 });

      // Try to parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      }

      return { rawAnalysis: response.content };
    } catch (error) {
      logger.warn('AI analysis failed, using fallback', error);
      return {};
    }
  }

  /**
   * Detect tech stack
   */
  private detectTechStack(code: string, aiAnalysis: Record<string, unknown>): TechStack {
    const techStack: TechStack = {
      other: [],
    };

    // Extract from AI analysis results
    if (aiAnalysis.techStack && typeof aiAnalysis.techStack === 'object') {
      const ts = aiAnalysis.techStack as Record<string, unknown>;
      techStack.framework = ts.framework as string | undefined;
      techStack.bundler = ts.bundler as string | undefined;
      if (Array.isArray(ts.libraries)) {
        techStack.other = ts.libraries as string[];
      }
    }

    // Detect based on code characteristics
    if (code.includes('React.') || code.includes('useState') || code.includes('useEffect')) {
      techStack.framework = 'React';
    } else if (code.includes('Vue.') || code.includes('createApp')) {
      techStack.framework = 'Vue';
    } else if (code.includes('@angular/')) {
      techStack.framework = 'Angular';
    }

    if (code.includes('__webpack_require__')) {
      techStack.bundler = 'Webpack';
    }

    // Detect crypto libraries
    const cryptoLibs: string[] = [];
    if (code.includes('CryptoJS')) cryptoLibs.push('CryptoJS');
    if (code.includes('JSEncrypt')) cryptoLibs.push('JSEncrypt');
    if (code.includes('crypto-js')) cryptoLibs.push('crypto-js');
    if (cryptoLibs.length > 0) {
      techStack.cryptoLibrary = cryptoLibs;
    }

    return techStack;
  }

  /**
   * Extract business logic
   */
  private extractBusinessLogic(aiAnalysis: Record<string, unknown>, context?: Record<string, unknown>): BusinessLogic {
    const businessLogic: BusinessLogic = {
      mainFeatures: [],
      entities: [],
      rules: [],
      dataModel: {},
    };

    if (aiAnalysis.businessLogic && typeof aiAnalysis.businessLogic === 'object') {
      const bl = aiAnalysis.businessLogic as Record<string, unknown>;
      if (Array.isArray(bl.mainFeatures)) {
        businessLogic.mainFeatures = bl.mainFeatures as string[];
      }
      if (typeof bl.dataFlow === 'string') {
        businessLogic.rules.push(bl.dataFlow);
      }
    }

    // Merge context information
    if (context) {
      businessLogic.dataModel = { ...businessLogic.dataModel, ...context };
    }

    return businessLogic;
  }

  /**
   * Analyze module imports and exports
   */
  private analyzeModules(code: string): CodeStructure['modules'] {
    const modules: CodeStructure['modules'] = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const imports: string[] = [];
      const exports: string[] = [];

      traverse(ast, {
        ImportDeclaration(path) {
          imports.push(path.node.source.value);
        },
        ExportNamedDeclaration(path) {
          if (path.node.source) {
            exports.push(path.node.source.value);
          }
        },
        ExportDefaultDeclaration() {
          exports.push('default');
        },
      });

      if (imports.length > 0 || exports.length > 0) {
        modules.push({
          name: 'current',
          imports,
          exports,
        });
      }
    } catch (error) {
      logger.warn('Module analysis failed', error);
    }

    return modules;
  }

  /**
   * Build call graph
   */
  private buildCallGraph(functions: FunctionInfo[], code: string): CallGraph {
    const nodes: CallGraph['nodes'] = functions.map((fn) => ({
      id: fn.name,
      name: fn.name,
      type: 'function' as const,
    }));

    const edges: CallGraph['edges'] = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let currentFunction = '';

      traverse(ast, {
        FunctionDeclaration(path) {
          currentFunction = path.node.id?.name || '';
        },
        FunctionExpression(path) {
          const parent = path.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            currentFunction = parent.id.name;
          }
        },
        CallExpression(path) {
          if (currentFunction) {
            const callee = path.node.callee;
            let calledFunction = '';

            if (callee.type === 'Identifier') {
              calledFunction = callee.name;
            } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
              calledFunction = callee.property.name;
            }

            if (calledFunction && functions.some((f) => f.name === calledFunction)) {
              edges.push({
                from: currentFunction,
                to: calledFunction,
              });
            }
          }
        },
      });
    } catch (error) {
      logger.warn('Call graph construction failed', error);
    }

    return { nodes, edges };
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(path: unknown): number {
    let complexity = 1;

    // Use any type to bypass type checking
    const anyPath = path as any;

    if (anyPath.traverse) {
      anyPath.traverse({
        IfStatement() {
          complexity++;
        },
        SwitchCase() {
          complexity++;
        },
        ForStatement() {
          complexity++;
        },
        WhileStatement() {
          complexity++;
        },
        DoWhileStatement() {
          complexity++;
        },
        ConditionalExpression() {
          complexity++;
        },
        LogicalExpression(logicalPath: any) {
          if (logicalPath.node.operator === '&&' || logicalPath.node.operator === '||') {
            complexity++;
          }
        },
        CatchClause() {
          complexity++;
        },
      });
    }

    return complexity;
  }

  /**
   * Analyze data flow - complete taint analysis implementation
   *
   * Based on the <sources, sinks, sanitizers> triple model
   * 1. Identify taint sources (Source): user input, network requests, localStorage, etc.
   * 2. Identify taint sinks (Sink): eval, innerHTML, document.write and other dangerous operations
   * 3. Taint propagation analysis: track data flow paths from source to sink
   * 4. Sanitization (Sanitizer): encryption, validation and other security processing
   */
  private async analyzeDataFlow(code: string): Promise<DataFlow> {
    const graph: DataFlow['graph'] = { nodes: [], edges: [] };
    const sources: DataFlow['sources'] = [];
    const sinks: DataFlow['sinks'] = [];
    const taintPaths: DataFlow['taintPaths'] = [];

    // Taint marker mapping: variable name -> taint source info
    const taintMap = new Map<string, { sourceType: string; sourceLine: number }>();

    // Sanitizer functions (Sanitizers) - detect safe data processing
    // Extended based on OWASP and industry best practices
    const sanitizers = new Set([
      // URL encoding
      'encodeURIComponent', 'encodeURI', 'escape', 'decodeURIComponent', 'decodeURI',
      // HTML escaping
      'htmlentities', 'htmlspecialchars', 'escapeHtml', 'escapeHTML',
      'he.encode', 'he.escape',
      // Validator library
      'validator.escape', 'validator.unescape', 'validator.stripLow',
      'validator.blacklist', 'validator.whitelist', 'validator.trim',
      'validator.isEmail', 'validator.isURL', 'validator.isInt',
      // DOMPurify
      'DOMPurify.sanitize', 'DOMPurify.addHook',
      // Encryption/Hashing
      'crypto.encrypt', 'crypto.hash', 'crypto.createHash', 'crypto.createHmac',
      'CryptoJS.AES.encrypt', 'CryptoJS.SHA256', 'CryptoJS.MD5',
      'bcrypt.hash', 'bcrypt.compare',
      // Base64 encoding
      'btoa', 'atob', 'Buffer.from',
      // SQL parameterization
      'db.prepare', 'db.query', 'mysql.escape', 'pg.query',
      // XSS protection
      'xss', 'sanitizeHtml',
      // Input validation
      'parseInt', 'parseFloat', 'Number', 'String',
      // Other
      'JSON.stringify', 'JSON.parse',
      'String.prototype.replace', 'String.prototype.trim',
      'Array.prototype.filter', 'Array.prototype.map',
    ]);

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const self = this;

      // First pass: identify taint sources and taint sinks
      traverse(ast, {
        // Identify taint sources
        CallExpression(path) {
          const callee = path.node.callee;
          const line = path.node.loc?.start.line || 0;

          // Network requests (taint source)
          if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const methodName = callee.property.name;

            // Network requests
            if (['fetch', 'ajax', 'get', 'post', 'request', 'axios'].includes(methodName)) {
              const sourceId = `source-network-${line}`;
              sources.push({ type: 'network', location: { file: 'current', line } });
              graph.nodes.push({
                id: sourceId,
                name: `${methodName}()`,
                type: 'source',
                location: { file: 'current', line },
              });

              // Mark return value as tainted
              const parent = path.parent;
              if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
                taintMap.set(parent.id.name, { sourceType: 'network', sourceLine: line });
              }
            }

            // DOM queries (user input)
            else if (['querySelector', 'getElementById', 'getElementsByClassName', 'getElementsByTagName'].includes(methodName)) {
              const sourceId = `source-dom-${line}`;
              sources.push({ type: 'user_input', location: { file: 'current', line } });
              graph.nodes.push({
                id: sourceId,
                name: `${methodName}()`,
                type: 'source',
                location: { file: 'current', line },
              });
            }
          }

          // Detect taint sinks (dangerous operations)
          if (t.isIdentifier(callee)) {
            const funcName = callee.name;

            // eval family (code injection)
            if (['eval', 'Function', 'setTimeout', 'setInterval'].includes(funcName)) {
              const sinkId = `sink-eval-${line}`;
              sinks.push({ type: 'eval', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `${funcName}()`,
                type: 'sink',
                location: { file: 'current', line },
              });

              // Check if arguments are tainted
              self.checkTaintedArguments(path.node.arguments, taintMap, taintPaths, funcName, line);
            }
          }

          // Dangerous methods called via member expressions
          if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const methodName = callee.property.name;

            // document.write/writeln (XSS)
            if (['write', 'writeln'].includes(methodName) &&
                t.isIdentifier(callee.object) && callee.object.name === 'document') {
              const sinkId = `sink-document-write-${line}`;
              sinks.push({ type: 'xss', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `document.${methodName}()`,
                type: 'sink',
                location: { file: 'current', line },
              });
              self.checkTaintedArguments(path.node.arguments, taintMap, taintPaths, methodName, line);
            }

            // SQL query methods (SQL injection)
            if (['query', 'execute', 'exec', 'run'].includes(methodName)) {
              const sinkId = `sink-sql-${line}`;
              sinks.push({ type: 'sql-injection', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `${methodName}() (SQL)`,
                type: 'sink',
                location: { file: 'current', line },
              });
              self.checkTaintedArguments(path.node.arguments, taintMap, taintPaths, methodName, line);
            }

            // Command execution (Command Injection)
            if (['exec', 'spawn', 'execSync', 'spawnSync'].includes(methodName)) {
              const sinkId = `sink-command-${line}`;
              sinks.push({ type: 'other', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `${methodName}() (Command)`,
                type: 'sink',
                location: { file: 'current', line },
              });
              self.checkTaintedArguments(path.node.arguments, taintMap, taintPaths, methodName, line);
            }

            // Path traversal (Path Traversal)
            if (['readFile', 'writeFile', 'readFileSync', 'writeFileSync', 'open'].includes(methodName)) {
              const sinkId = `sink-file-${line}`;
              sinks.push({ type: 'other', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `${methodName}() (File)`,
                type: 'sink',
                location: { file: 'current', line },
              });
              self.checkTaintedArguments(path.node.arguments, taintMap, taintPaths, methodName, line);
            }
          }
        },

        // Identify additional taint sources
        MemberExpression(path) {
          const obj = path.node.object;
          const prop = path.node.property;
          const line = path.node.loc?.start.line || 0;

          // location.* (URL parameters)
          if (t.isIdentifier(obj) && obj.name === 'location' && t.isIdentifier(prop)) {
            if (['href', 'search', 'hash', 'pathname'].includes(prop.name)) {
              const sourceId = `source-url-${line}`;
              sources.push({ type: 'user_input', location: { file: 'current', line } });
              graph.nodes.push({
                id: sourceId,
                name: `location.${prop.name}`,
                type: 'source',
                location: { file: 'current', line },
              });

              // Mark as tainted
              const parent = path.parent;
              if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
                taintMap.set(parent.id.name, { sourceType: 'url', sourceLine: line });
              }
            }
          }

          // document.cookie
          if (t.isIdentifier(obj) && obj.name === 'document' && t.isIdentifier(prop) && prop.name === 'cookie') {
            const sourceId = `source-cookie-${line}`;
            sources.push({ type: 'storage', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: 'document.cookie',
              type: 'source',
              location: { file: 'current', line },
            });
          }

          // localStorage/sessionStorage
          if (t.isIdentifier(obj) && ['localStorage', 'sessionStorage'].includes(obj.name)) {
            const sourceId = `source-storage-${line}`;
            sources.push({ type: 'storage', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: `${obj.name}.getItem()`,
              type: 'source',
              location: { file: 'current', line },
            });
          }

          // window.name (can be tainted cross-window)
          if (t.isIdentifier(obj) && obj.name === 'window' &&
              t.isIdentifier(prop) && prop.name === 'name') {
            const sourceId = `source-window-name-${line}`;
            sources.push({ type: 'user_input', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: 'window.name',
              type: 'source',
              location: { file: 'current', line },
            });
          }

          // postMessage receiver (cross-origin messages)
          if (t.isIdentifier(obj) && obj.name === 'event' &&
              t.isIdentifier(prop) && prop.name === 'data') {
            const sourceId = `source-postmessage-${line}`;
            sources.push({ type: 'network', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: 'event.data (postMessage)',
              type: 'source',
              location: { file: 'current', line },
            });
          }

          // WebSocket messages
          if (t.isIdentifier(obj) && obj.name === 'message' &&
              t.isIdentifier(prop) && prop.name === 'data') {
            const sourceId = `source-websocket-${line}`;
            sources.push({ type: 'network', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: 'WebSocket message.data',
              type: 'source',
              location: { file: 'current', line },
            });
          }
        },

        // Identify DOM manipulation taint sinks
        AssignmentExpression(path) {
          const left = path.node.left;
          const right = path.node.right;
          const line = path.node.loc?.start.line || 0;

          // innerHTML, outerHTML (XSS risk)
          if (t.isMemberExpression(left) && t.isIdentifier(left.property)) {
            const propName = left.property.name;
            if (['innerHTML', 'outerHTML'].includes(propName)) {
              const sinkId = `sink-dom-${line}`;
              sinks.push({ type: 'xss', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: propName,
                type: 'sink',
                location: { file: 'current', line },
              });

              // Check if right-hand value is tainted
              if (t.isIdentifier(right) && taintMap.has(right.name)) {
                const taintInfo = taintMap.get(right.name)!;
                taintPaths.push({
                  source: { type: taintInfo.sourceType as DataFlow['sources'][0]['type'], location: { file: 'current', line: taintInfo.sourceLine } },
                  sink: { type: 'xss', location: { file: 'current', line } },
                  path: [
                    { file: 'current', line: taintInfo.sourceLine },
                    { file: 'current', line },
                  ],
                });
              }
            }
          }
        },
      });

      // Second pass: taint propagation analysis (explicit flow)
      traverse(ast, {
        // Assignment propagation
        VariableDeclarator(path) {
          const id = path.node.id;
          const init = path.node.init;

          if (t.isIdentifier(id) && init) {
            // Check if processed by a Sanitizer
            if (t.isCallExpression(init) && self.checkSanitizer(init, sanitizers)) {
              // If argument is a tainted variable, clear taint after Sanitizer processing
              const arg = init.arguments[0];
              if (t.isIdentifier(arg) && taintMap.has(arg.name)) {
                // Do not propagate taint (already sanitized)
                logger.debug(`Taint cleaned by sanitizer: ${arg.name} -> ${id.name}`);
                return;
              }
            }

            // Direct assignment propagation
            if (t.isIdentifier(init) && taintMap.has(init.name)) {
              const taintInfo = taintMap.get(init.name)!;
              taintMap.set(id.name, taintInfo);
            }
            // Binary expression propagation
            else if (t.isBinaryExpression(init)) {
              const leftTainted = t.isIdentifier(init.left) && taintMap.has(init.left.name);
              const rightTainted = t.isIdentifier(init.right) && taintMap.has(init.right.name);

              if (leftTainted || rightTainted) {
                const taintInfo = leftTainted ? taintMap.get((init.left as t.Identifier).name)! : taintMap.get((init.right as t.Identifier).name)!;
                taintMap.set(id.name, taintInfo);
              }
            }
            // Function call propagation (non-Sanitizer)
            else if (t.isCallExpression(init)) {
              const arg = init.arguments[0];
              if (t.isIdentifier(arg) && taintMap.has(arg.name)) {
                const taintInfo = taintMap.get(arg.name)!;
                taintMap.set(id.name, taintInfo);
              }
            }
          }
        },

        // Assignment expression propagation
        AssignmentExpression(path) {
          const left = path.node.left;
          const right = path.node.right;

          if (t.isIdentifier(left) && t.isIdentifier(right) && taintMap.has(right.name)) {
            const taintInfo = taintMap.get(right.name)!;
            taintMap.set(left.name, taintInfo);
          }
        },
      });

    } catch (error) {
      logger.warn('Data flow analysis failed', error);
    }

    // Use LLM-assisted deep taint analysis (if taint paths exist)
    if (taintPaths.length > 0 && this.llm) {
      try {
        await this.enhanceTaintAnalysisWithLLM(code, sources, sinks, taintPaths);
      } catch (error) {
        logger.warn('LLM-enhanced taint analysis failed', error);
      }
    }

    return {
      graph,
      sources,
      sinks,
      taintPaths,
    };
  }

  /**
   * Enhance taint analysis with LLM
   *
   * For complex data flows, use LLM for deep analysis
   * Identify implicit data flows and complex taint propagation paths
   */
  private async enhanceTaintAnalysisWithLLM(
    code: string,
    sources: DataFlow['sources'],
    sinks: DataFlow['sinks'],
    taintPaths: DataFlow['taintPaths']
  ): Promise<void> {
    if (!this.llm || taintPaths.length === 0) return;

    try {
      const sourcesList = sources.map(s => `${s.type} at line ${s.location.line}`);
      const sinksList = sinks.map(s => `${s.type} at line ${s.location.line}`);

      const messages = this.llm.generateTaintAnalysisPrompt(
        code.length > 4000 ? code.substring(0, 4000) : code,
        sourcesList,
        sinksList
      );

      const response = await this.llm.chat(messages, {
        temperature: 0.2,
        maxTokens: 2000,
      });

      // Try to parse additional taint paths returned by LLM
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const llmResult = JSON.parse(jsonMatch[0]) as { taintPaths?: Array<any> };

        if (Array.isArray(llmResult.taintPaths)) {
          logger.info(`LLM identified ${llmResult.taintPaths.length} additional taint paths`);

          // Add LLM-discovered paths to results (deduplicated)
          llmResult.taintPaths.forEach((path: any) => {
            const exists = taintPaths.some(
              p => p.source.location.line === path.source?.location?.line &&
                   p.sink.location.line === path.sink?.location?.line
            );

            if (!exists && path.source && path.sink) {
              taintPaths.push({
                source: path.source,
                sink: path.sink,
                path: path.path || [],
              });
            }
          });
        }
      }
    } catch (error) {
      logger.debug('LLM taint analysis enhancement failed', error);
    }
  }

  /**
   * Check if function arguments are tainted
   */
  private checkTaintedArguments(
    args: Array<t.Expression | t.SpreadElement | t.ArgumentPlaceholder>,
    taintMap: Map<string, { sourceType: string; sourceLine: number }>,
    taintPaths: DataFlow['taintPaths'],
    _funcName: string,
    line: number
  ): void {
    args.forEach((arg) => {
      if (t.isIdentifier(arg) && taintMap.has(arg.name)) {
        const taintInfo = taintMap.get(arg.name)!;
        taintPaths.push({
          source: {
            type: taintInfo.sourceType as DataFlow['sources'][0]['type'],
            location: { file: 'current', line: taintInfo.sourceLine },
          },
          sink: {
            type: 'eval',
            location: { file: 'current', line },
          },
          path: [
            { file: 'current', line: taintInfo.sourceLine },
            { file: 'current', line },
          ],
        });
      }
    });
  }

  /**
   * Identify security risks - enhanced version
   *
   * Comprehensive security risk detection based on OWASP Top 10 and CWE standards
   * Combining static analysis and AI analysis results
   */
  private identifySecurityRisks(code: string, aiAnalysis: Record<string, unknown>): SecurityRisk[] {
    const risks: SecurityRisk[] = [];

    // Extract risks from AI analysis
    if (Array.isArray(aiAnalysis.securityRisks)) {
      aiAnalysis.securityRisks.forEach((risk: unknown) => {
        if (typeof risk === 'object' && risk !== null) {
          const r = risk as Record<string, unknown>;
          risks.push({
            type: (r.type as SecurityRisk['type']) || 'other',
            severity: (r.severity as SecurityRisk['severity']) || 'low',
            location: { file: 'current', line: (r.location as any)?.line || 0 },
            description: (r.description as string) || '',
            recommendation: (r.recommendation as string) || '',
          });
        }
      });
    }

    // Rule-based static detection - enhanced version
    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      traverse(ast, {
        // 1. XSS risk detection
        AssignmentExpression(path) {
          const left = path.node.left;
          const line = path.node.loc?.start.line || 0;

          if (t.isMemberExpression(left) && t.isIdentifier(left.property)) {
            const propName = left.property.name;

            // innerHTML/outerHTML assignment
            if (['innerHTML', 'outerHTML', 'insertAdjacentHTML'].includes(propName)) {
              risks.push({
                type: 'xss',
                severity: 'high',
                location: { file: 'current', line },
                description: `Potential XSS vulnerability: Direct assignment to ${propName} without sanitization`,
                recommendation: 'Use textContent for plain text, or DOMPurify.sanitize() for HTML content',
              });
            }

            // document.write
            if (propName === 'write' && t.isIdentifier(left.object) && left.object.name === 'document') {
              risks.push({
                type: 'xss',
                severity: 'high',
                location: { file: 'current', line },
                description: 'Dangerous use of document.write() which can lead to XSS',
                recommendation: 'Use modern DOM manipulation methods instead',
              });
            }
          }
        },

        // 2. Code injection risk
        CallExpression(path) {
          const callee = path.node.callee;
          const line = path.node.loc?.start.line || 0;

          // eval(), Function(), setTimeout/setInterval with string
          if (t.isIdentifier(callee)) {
            if (callee.name === 'eval') {
              risks.push({
                type: 'other',
                severity: 'critical',
                location: { file: 'current', line },
                description: 'Critical: Use of eval() allows arbitrary code execution',
                recommendation: 'Refactor to avoid eval(). Use JSON.parse() for data, or proper function calls',
              });
            }

            if (callee.name === 'Function') {
              risks.push({
                type: 'other',
                severity: 'critical',
                location: { file: 'current', line },
                description: 'Critical: Function constructor allows code injection',
                recommendation: 'Use regular function declarations or arrow functions',
              });
            }

            // setTimeout/setInterval with string argument
            if (['setTimeout', 'setInterval'].includes(callee.name)) {
              const firstArg = path.node.arguments[0];
              if (t.isStringLiteral(firstArg) || (t.isIdentifier(firstArg) && firstArg.name !== 'function')) {
                risks.push({
                  type: 'other',
                  severity: 'medium',
                  location: { file: 'current', line },
                  description: `${callee.name}() with string argument can lead to code injection`,
                  recommendation: `Use ${callee.name}() with function reference instead of string`,
                });
              }
            }
          }

          // 3. SQL injection risk detection (string concatenation queries)
          if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const methodName = callee.property.name;

            // Database query methods
            if (['query', 'execute', 'exec', 'run'].includes(methodName)) {
              const firstArg = path.node.arguments[0];

              // Check if string concatenation is used
              if (t.isBinaryExpression(firstArg) || t.isTemplateLiteral(firstArg)) {
                risks.push({
                  type: 'sql-injection',
                  severity: 'critical',
                  location: { file: 'current', line },
                  description: 'Potential SQL injection: Query built with string concatenation',
                  recommendation: 'Use parameterized queries or prepared statements',
                });
              }
            }
          }
        },

        // 4. Insecure random number generation
        MemberExpression(path) {
          const obj = path.node.object;
          const prop = path.node.property;
          const line = path.node.loc?.start.line || 0;

          if (t.isIdentifier(obj) && obj.name === 'Math' &&
              t.isIdentifier(prop) && prop.name === 'random') {
            // Check if used in security-related context (determined by context)
            const parent = path.parent;
            if (t.isCallExpression(parent) || t.isBinaryExpression(parent)) {
              risks.push({
                type: 'other',
                severity: 'medium',
                location: { file: 'current', line },
                description: 'Math.random() is not cryptographically secure',
                recommendation: 'Use crypto.getRandomValues() or crypto.randomBytes() for security-sensitive operations',
              });
            }
          }
        },

        // 5. Hardcoded sensitive information detection
        VariableDeclarator(path) {
          const id = path.node.id;
          const init = path.node.init;
          const line = path.node.loc?.start.line || 0;

          if (t.isIdentifier(id) && t.isStringLiteral(init)) {
            const varName = id.name.toLowerCase();
            const value = init.value;

            // Detect possible keys, passwords, tokens
            const sensitivePatterns = [
              { pattern: /(password|passwd|pwd)/i, type: 'password' },
              { pattern: /(api[_-]?key|apikey)/i, type: 'API key' },
              { pattern: /(secret|token|auth)/i, type: 'secret' },
              { pattern: /(private[_-]?key|privatekey)/i, type: 'private key' },
            ];

            for (const { pattern, type } of sensitivePatterns) {
              if (pattern.test(varName) && value.length > 8) {
                risks.push({
                  type: 'other',
                  severity: 'critical',
                  location: { file: 'current', line },
                  description: `Hardcoded ${type} detected in source code`,
                  recommendation: `Store ${type} in environment variables or secure configuration`,
                });
                break;
              }
            }
          }
        },
      });
    } catch (error) {
      logger.warn('Static security analysis failed', error);
    }

    // Deduplicate (based on type and line)
    const uniqueRisks = risks.filter((risk, index, self) =>
      index === self.findIndex((r) => r.type === risk.type && r.location.line === risk.location.line)
    );

    return uniqueRisks;
  }

  /**
   * Calculate code quality score - enhanced version
   *
   * Calculate code quality across multiple dimensions:
   * - Security
   * - Complexity
   * - Maintainability
   * - Code Smells
   * - AI Assessment
   */
  private calculateQualityScore(
    structure: CodeStructure,
    securityRisks: SecurityRisk[],
    aiAnalysis: Record<string, unknown>,
    complexityMetrics?: {
      cyclomaticComplexity: number;
      cognitiveComplexity: number;
      maintainabilityIndex: number;
    },
    antiPatterns?: Array<{ severity: string }>
  ): number {
    let score = 100;

    // 1. Security risk deduction (weight: 40%)
    let securityScore = 100;
    securityRisks.forEach((risk) => {
      if (risk.severity === 'critical') securityScore -= 20;
      else if (risk.severity === 'high') securityScore -= 10;
      else if (risk.severity === 'medium') securityScore -= 5;
      else securityScore -= 2;
    });
    securityScore = Math.max(0, securityScore);

    // 2. Code complexity deduction (weight: 25%)
    let complexityScore = 100;
    if (complexityMetrics) {
      // Cyclomatic complexity scoring
      if (complexityMetrics.cyclomaticComplexity > 20) complexityScore -= 30;
      else if (complexityMetrics.cyclomaticComplexity > 10) complexityScore -= 15;
      else if (complexityMetrics.cyclomaticComplexity > 5) complexityScore -= 5;

      // Cognitive complexity scoring
      if (complexityMetrics.cognitiveComplexity > 15) complexityScore -= 20;
      else if (complexityMetrics.cognitiveComplexity > 10) complexityScore -= 10;
    } else {
      // Fallback to simple average complexity calculation
      const avgComplexity =
        structure.functions.reduce((sum, fn) => sum + fn.complexity, 0) / (structure.functions.length || 1);
      if (avgComplexity > 10) complexityScore -= 20;
      else if (avgComplexity > 5) complexityScore -= 10;
    }
    complexityScore = Math.max(0, complexityScore);

    // 3. Maintainability score (weight: 20%)
    let maintainabilityScore = complexityMetrics?.maintainabilityIndex || 70;

    // 4. Code smell deduction (weight: 15%)
    let codeSmellScore = 100;
    if (antiPatterns) {
      antiPatterns.forEach((pattern) => {
        if (pattern.severity === 'high') codeSmellScore -= 10;
        else if (pattern.severity === 'medium') codeSmellScore -= 5;
        else codeSmellScore -= 2;
      });
    }
    codeSmellScore = Math.max(0, codeSmellScore);

    // 5. AI score (if available)
    let aiScore = 70; // default value
    if (typeof aiAnalysis.qualityScore === 'number') {
      aiScore = aiAnalysis.qualityScore;
    }

    // Weighted average
    score =
      securityScore * 0.40 +
      complexityScore * 0.25 +
      maintainabilityScore * 0.20 +
      codeSmellScore * 0.15;

    // Average with AI score (if AI score is available)
    if (typeof aiAnalysis.qualityScore === 'number') {
      score = (score + aiScore) / 2;
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Check if this is a Sanitizer function call
   * @param node - AST node
   * @param sanitizers - Set of Sanitizer functions
   * @returns Whether it is a Sanitizer
   */
  private checkSanitizer(
    node: t.CallExpression,
    sanitizers: Set<string>
  ): boolean {
    const { callee } = node;

    // Simple function call: encodeURIComponent()
    if (t.isIdentifier(callee)) {
      return sanitizers.has(callee.name);
    }

    // Member expression: DOMPurify.sanitize(), validator.escape()
    if (t.isMemberExpression(callee)) {
      const fullName = this.getMemberExpressionName(callee);
      return sanitizers.has(fullName);
    }

    return false;
  }

  /**
   * Get the full name of a member expression
   * @param node - Member expression node
   * @returns Full name, e.g. "DOMPurify.sanitize"
   */
  private getMemberExpressionName(node: t.MemberExpression): string {
    const parts: string[] = [];

    let current: t.Expression | t.PrivateName = node;
    while (t.isMemberExpression(current)) {
      if (t.isIdentifier(current.property)) {
        parts.unshift(current.property.name);
      }
      current = current.object;
    }

    if (t.isIdentifier(current)) {
      parts.unshift(current.name);
    }

    return parts.join('.');
  }

  /**
   * Detect code patterns and anti-patterns
   *
   * Identify common design patterns and code smells
   * Based on industry best practices and code quality standards
   */
  private detectCodePatterns(code: string): {
    patterns: Array<{ name: string; location: number; description: string }>;
    antiPatterns: Array<{ name: string; location: number; severity: string; recommendation: string }>;
  } {
    const patterns: Array<{ name: string; location: number; description: string }> = [];
    const antiPatterns: Array<{ name: string; location: number; severity: string; recommendation: string }> = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      traverse(ast, {
        // Detect Singleton pattern
        VariableDeclarator(path) {
          const init = path.node.init;
          if (t.isCallExpression(init) &&
              t.isFunctionExpression(init.callee) &&
              init.callee.body.body.some(stmt =>
                t.isReturnStatement(stmt) &&
                t.isObjectExpression(stmt.argument)
              )) {
            patterns.push({
              name: 'Singleton Pattern',
              location: path.node.loc?.start.line || 0,
              description: 'IIFE returning object (Singleton pattern)',
            });
          }
        },

        // Detect Observer pattern
        ClassDeclaration(path) {
          const methods = path.node.body.body.filter(m => t.isClassMethod(m));
          const methodNames = methods.map(m =>
            t.isClassMethod(m) && t.isIdentifier(m.key) ? m.key.name : ''
          );

          if (methodNames.includes('subscribe') &&
              methodNames.includes('unsubscribe') &&
              methodNames.includes('notify')) {
            patterns.push({
              name: 'Observer Pattern',
              location: path.node.loc?.start.line || 0,
              description: 'Class with subscribe/unsubscribe/notify methods',
            });
          }
        },

        // Anti-pattern: long function
        FunctionDeclaration(path) {
          const loc = path.node.loc;
          if (loc) {
            const lines = loc.end.line - loc.start.line;
            if (lines > 50) {
              antiPatterns.push({
                name: 'Long Function',
                location: loc.start.line,
                severity: 'medium',
                recommendation: `Function is ${lines} lines long. Consider breaking it into smaller functions (max 50 lines)`,
              });
            }
          }
        },

        // Anti-pattern: deep nesting
        IfStatement(path) {
          let depth = 0;
          let current: typeof path.parentPath | null = path.parentPath;

          while (current) {
            if (current.isIfStatement() ||
                current.isForStatement() ||
                current.isWhileStatement()) {
              depth++;
            }
            current = current.parentPath;
          }

          if (depth > 3) {
            antiPatterns.push({
              name: 'Deep Nesting',
              location: path.node.loc?.start.line || 0,
              severity: 'medium',
              recommendation: `Nesting depth is ${depth}. Consider extracting to separate functions or using early returns`,
            });
          }
        },

        // Anti-pattern: magic numbers
        NumericLiteral(path) {
          const value = path.node.value;
          const parent = path.parent;

          // Ignore common numbers (0, 1, -1, 2, 10, 100, 1000)
          const commonNumbers = [0, 1, -1, 2, 10, 100, 1000];
          if (commonNumbers.includes(value)) return;

          // Ignore array indices
          if (t.isMemberExpression(parent) && parent.property === path.node) return;

          // Ignore function parameter default values
          if (t.isAssignmentPattern(parent)) return;

          antiPatterns.push({
            name: 'Magic Number',
            location: path.node.loc?.start.line || 0,
            severity: 'low',
            recommendation: `Replace magic number ${value} with a named constant`,
          });
        },

        // Anti-pattern: empty catch block
        CatchClause(path) {
          const body = path.node.body.body;
          if (body.length === 0) {
            antiPatterns.push({
              name: 'Empty Catch Block',
              location: path.node.loc?.start.line || 0,
              severity: 'high',
              recommendation: 'Empty catch block swallows errors. Add proper error handling or logging',
            });
          }
        },

        // Anti-pattern: using var instead of let/const
        VariableDeclaration(path) {
          if (path.node.kind === 'var') {
            antiPatterns.push({
              name: 'Use of var',
              location: path.node.loc?.start.line || 0,
              severity: 'low',
              recommendation: 'Use let or const instead of var for better scoping',
            });
          }
        },
      });

      // Duplicate code detection - based on AST structural similarity
      const duplicates = this.detectDuplicateCode(ast);
      duplicates.forEach(dup => {
        antiPatterns.push({
          name: 'Duplicate Code',
          location: dup.location,
          severity: 'medium',
          recommendation: `Duplicate code found at lines ${dup.location} and ${dup.duplicateLocation}. Extract into a reusable function.`,
        });
      });
    } catch (error) {
      logger.warn('Code pattern detection failed', error);
    }

    return { patterns, antiPatterns };
  }

  /**
   * Analyze code complexity metrics
   *
   * Calculate multiple complexity metrics:
   * - Cyclomatic Complexity
   * - Cognitive Complexity
   * - Maintainability Index
   */
  private analyzeComplexityMetrics(code: string): {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    maintainabilityIndex: number;
    halsteadMetrics: {
      vocabulary: number;
      length: number;
      difficulty: number;
      effort: number;
    };
  } {
    let cyclomaticComplexity = 1;
    let cognitiveComplexity = 0;
    let operators = 0;
    let operands = 0;
    const uniqueOperators = new Set<string>();
    const uniqueOperands = new Set<string>();

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let nestingLevel = 0;

      traverse(ast, {
        // Cyclomatic complexity
        IfStatement() { cyclomaticComplexity++; },
        SwitchCase() { cyclomaticComplexity++; },
        ForStatement() { cyclomaticComplexity++; },
        WhileStatement() { cyclomaticComplexity++; },
        DoWhileStatement() { cyclomaticComplexity++; },
        ConditionalExpression() { cyclomaticComplexity++; },
        LogicalExpression(path) {
          if (path.node.operator === '&&' || path.node.operator === '||') {
            cyclomaticComplexity++;
          }
        },
        CatchClause() { cyclomaticComplexity++; },

        // Cognitive complexity (considering nesting)
        'IfStatement|ForStatement|WhileStatement|DoWhileStatement': {
          enter() {
            nestingLevel++;
            cognitiveComplexity += nestingLevel;
          },
          exit() {
            nestingLevel--;
          },
        },

        // Halstead metrics
        BinaryExpression(path) {
          operators++;
          uniqueOperators.add(path.node.operator);
        },
        UnaryExpression(path) {
          operators++;
          uniqueOperators.add(path.node.operator);
        },
        Identifier(path) {
          operands++;
          uniqueOperands.add(path.node.name);
        },
        NumericLiteral(path) {
          operands++;
          uniqueOperands.add(String(path.node.value));
        },
        StringLiteral(path) {
          operands++;
          uniqueOperands.add(path.node.value);
        },
      });
    } catch (error) {
      logger.warn('Complexity metrics calculation failed', error);
    }

    // Halstead metrics calculation
    const n1 = uniqueOperators.size; // unique operator count
    const n2 = uniqueOperands.size;  // unique operand count
    const N1 = operators;             // total operator count
    const N2 = operands;              // total operand count

    const vocabulary = n1 + n2;
    const length = N1 + N2;
    const difficulty = (n1 / 2) * (N2 / (n2 || 1));
    const effort = difficulty * length;

    // Maintainability Index
    // MI = 171 - 5.2 * ln(V) - 0.23 * G - 16.2 * ln(LOC)
    const volume = length * Math.log2(vocabulary || 1);
    const loc = code.split('\n').length;
    const maintainabilityIndex = Math.max(0,
      171 - 5.2 * Math.log(volume || 1) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(loc)
    );

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      maintainabilityIndex: Math.round(maintainabilityIndex),
      halsteadMetrics: {
        vocabulary,
        length,
        difficulty: Math.round(difficulty * 100) / 100,
        effort: Math.round(effort),
      },
    };
  }

  /**
   * Detect duplicate code - based on AST structural similarity
   *
   * Use AST structure hashing and similarity algorithms to detect duplicate code blocks
   * Algorithm references:
   * - Token-based Clone Detection
   * - AST-based Clone Detection (Type-1, Type-2, Type-3 clones)
   *
   * Type-1: Identical code (except whitespace and comments)
   * Type-2: Same structure but different variable names
   * Type-3: Similar structure but with minor modifications
   */
  private detectDuplicateCode(ast: t.File): Array<{
    location: number;
    duplicateLocation: number;
    similarity: number;
  }> {
    const duplicates: Array<{ location: number; duplicateLocation: number; similarity: number }> = [];
    const codeBlocks: Array<{
      node: t.Node;
      hash: string;
      location: number;
      normalizedCode: string;
    }> = [];

    try {
      const self = this;

      // Collect all code blocks (functions, class methods, block statements)
      traverse(ast, {
        FunctionDeclaration(path) {
          const hash = self.computeASTHash(path.node);
          const normalized = self.normalizeCode(path.node);
          codeBlocks.push({
            node: path.node,
            hash,
            location: path.node.loc?.start.line || 0,
            normalizedCode: normalized,
          });
        },

        FunctionExpression(path) {
          const hash = self.computeASTHash(path.node);
          const normalized = self.normalizeCode(path.node);
          codeBlocks.push({
            node: path.node,
            hash,
            location: path.node.loc?.start.line || 0,
            normalizedCode: normalized,
          });
        },

        ArrowFunctionExpression(path) {
          const hash = self.computeASTHash(path.node);
          const normalized = self.normalizeCode(path.node);
          codeBlocks.push({
            node: path.node,
            hash,
            location: path.node.loc?.start.line || 0,
            normalizedCode: normalized,
          });
        },

        ClassMethod(path) {
          const hash = self.computeASTHash(path.node);
          const normalized = self.normalizeCode(path.node);
          codeBlocks.push({
            node: path.node,
            hash,
            location: path.node.loc?.start.line || 0,
            normalizedCode: normalized,
          });
        },
      });

      // Compare all code blocks to find duplicates
      for (let i = 0; i < codeBlocks.length; i++) {
        for (let j = i + 1; j < codeBlocks.length; j++) {
          const block1 = codeBlocks[i]!;
          const block2 = codeBlocks[j]!;

          // Type-1 clone: identical hash
          if (block1.hash === block2.hash) {
            duplicates.push({
              location: block1.location,
              duplicateLocation: block2.location,
              similarity: 1.0,
            });
            continue;
          }

          // Type-2/Type-3 clone: calculate similarity
          const similarity = this.calculateCodeSimilarity(
            block1.normalizedCode,
            block2.normalizedCode
          );

          // Similarity threshold: 0.85 (85% or above is considered duplicate code)
          if (similarity >= 0.85) {
            duplicates.push({
              location: block1.location,
              duplicateLocation: block2.location,
              similarity,
            });
          }
        }
      }
    } catch (error) {
      logger.debug('Duplicate code detection failed', error);
    }

    return duplicates;
  }

  /**
   * Compute hash value of an AST node
   *
   * Used for Type-1 clone detection (identical code)
   * Ignores location information and comments
   */
  private computeASTHash(node: t.Node): string {
    // Simplified hash computation: convert AST to normalized string
    const normalized = JSON.stringify(node, (key, value) => {
      // Ignore location information
      if (['loc', 'start', 'end', 'range'].includes(key)) {
        return undefined;
      }
      // Ignore comments
      if (key === 'comments' || key === 'leadingComments' || key === 'trailingComments') {
        return undefined;
      }
      return value;
    });

    // Use simple string hash (ideally should use a better hash algorithm like MD5/SHA256)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Normalize code - used for Type-2 clone detection
   *
   * Replace identifiers such as variable names and function names with placeholders
   * Preserve code structure
   */
  private normalizeCode(node: t.Node): string {
    let identifierCounter = 0;
    const identifierMap = new Map<string, string>();

    const clonedNode = t.cloneNode(node, true, false);

    traverse(t.file(t.program([clonedNode as t.Statement])), {
      Identifier(path) {
        const name = path.node.name;

        // Skip reserved words and built-in objects
        const reserved = ['console', 'window', 'document', 'Math', 'JSON', 'Array', 'Object', 'String', 'Number'];
        if (reserved.includes(name)) return;

        // Assign a normalized name for each unique identifier
        if (!identifierMap.has(name)) {
          identifierMap.set(name, `VAR_${identifierCounter++}`);
        }
        path.node.name = identifierMap.get(name)!;
      },

      // Normalize string literals
      StringLiteral(path) {
        path.node.value = 'STRING';
      },

      // Normalize numeric literals
      NumericLiteral(path) {
        path.node.value = 0;
      },
    });

    return JSON.stringify(clonedNode);
  }

  /**
   * Calculate similarity between two code segments
   *
   * Use Levenshtein distance algorithm to calculate string similarity
   * Return value: 0.0 (completely different) to 1.0 (identical)
   */
  private calculateCodeSimilarity(code1: string, code2: string): number {
    // Levenshtein distance algorithm
    const len1 = code1.length;
    const len2 = code2.length;

    // Optimization: if length difference is too large, return low similarity directly
    if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.3) {
      return 0;
    }

    // Dynamic programming matrix - using Array.from to ensure type safety
    const matrix: number[][] = Array.from({ length: len1 + 1 }, () =>
      Array.from({ length: len2 + 1 }, () => 0)
    );

    // Initialize first row and first column
    for (let i = 0; i <= len1; i++) {
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0]![j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = code1[i - 1] === code2[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,      // deletion
          matrix[i]![j - 1]! + 1,      // insertion
          matrix[i - 1]![j - 1]! + cost // substitution
        );
      }
    }

    const distance = matrix[len1]![len2]!;
    const maxLen = Math.max(len1, len2);

    // Similarity = 1 - (edit distance / max length)
    return 1 - (distance / maxLen);
  }
}

