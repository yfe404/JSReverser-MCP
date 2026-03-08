/**
 * Script Manager - Thin wrapper around CDP Debugger domain
 *
 * Features:
 * - Get the list of all loaded scripts on the page
 * - Get the full source code of a specified script
 * - Listen for script load events
 *
 * Design principles:
 * - Thin wrapper around CDP Debugger.scriptParsed event and Debugger.getScriptSource method
 * - Relies on CodeCollector to obtain Page instances
 */

import type { CDPSession } from 'puppeteer';
import type { CodeCollector } from '../collector/CodeCollector.js';
import { logger } from '../../utils/logger.js';

export interface ScriptInfo {
  scriptId: string;
  url: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  sourceLength?: number;
  source?: string;
}

/**
 * Script chunk (100KB per chunk)
 */
interface ScriptChunk {
  scriptId: string;
  chunkIndex: number;
  content: string;
  size: number;
}

/**
 * Keyword index entry
 */
interface KeywordIndexEntry {
  scriptId: string;
  url: string;
  line: number;
  column: number;
  context: string;
}

export class ScriptManager {
  private cdpSession: CDPSession | null = null;
  private scripts: Map<string, ScriptInfo> = new Map();
  private scriptsByUrl: Map<string, ScriptInfo[]> = new Map();
  private initialized = false;

  // 🆕 In-memory index system
  private keywordIndex: Map<string, KeywordIndexEntry[]> = new Map();
  private scriptChunks: Map<string, ScriptChunk[]> = new Map();
  private readonly CHUNK_SIZE = 100 * 1024; // 100KB per chunk

  // ✅ Fix: Save event listener reference for cleanup
  private scriptParsedListener: ((params: any) => void) | null = null;

  constructor(private collector: CodeCollector) {}

  /**
   * Initialize CDP session and enable Debugger
   */
  async init(): Promise<void> {
    if (this.initialized) {
      logger.warn('ScriptManager already initialized');
      return;
    }

    // 🆕 Removed redundant check (cdpSession is never null when initialized is true)
    const page = await this.collector.getActivePage();
    this.cdpSession = await page.createCDPSession();
    
    // Enable the Debugger domain
    await this.cdpSession.send('Debugger.enable');

    // ✅ Fix: Save listener reference for later cleanup
    this.scriptParsedListener = (params: any) => {
      const scriptInfo: ScriptInfo = {
        scriptId: params.scriptId,
        url: params.url,
        startLine: params.startLine,
        startColumn: params.startColumn,
        endLine: params.endLine,
        endColumn: params.endColumn,
        sourceLength: params.length,
      };

      // Store script info
      this.scripts.set(params.scriptId, scriptInfo);

      // Index by URL
      if (params.url) {
        if (!this.scriptsByUrl.has(params.url)) {
          this.scriptsByUrl.set(params.url, []);
        }
        this.scriptsByUrl.get(params.url)!.push(scriptInfo);
      }

      logger.debug(`Script parsed: ${params.url || 'inline'} (${params.scriptId})`);
    };

    // Listen for script parsed events
    this.cdpSession.on('Debugger.scriptParsed', this.scriptParsedListener);

    // 🔧 Fix: Wait for script parsed events to stabilize (replaces hardcoded 2-second delay)
    // When enabling the Debugger domain, CDP re-fires events for all previously parsed scripts
    // Poll to detect when the script count stabilizes to determine if events are complete
    let lastCount = 0;
    let stableRounds = 0;
    const maxWait = 5000; // Maximum wait 5 seconds
    const pollInterval = 200; // Check every 200ms
    const requiredStableRounds = 3; // 3 consecutive unchanged counts means stable
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      const currentCount = this.scripts.size;
      if (currentCount === lastCount && currentCount > 0) {
        stableRounds++;
        if (stableRounds >= requiredStableRounds) break;
      } else {
        stableRounds = 0;
      }
      lastCount = currentCount;
    }

    this.initialized = true;
    logger.info(`ScriptManager initialized, collected ${this.scripts.size} scripts`);
  }

  /**
   * Enable the script manager (alias method, consistent with other modules)
   */
  async enable(): Promise<void> {
    return this.init();
  }

  /**
   * Get all loaded scripts
   *
   * Warning: If includeSource=true, all script sources are loaded at once, which may cause memory overflow
   * Recommendation: For large websites, use getScriptSource() to load individual scripts on demand
   *
   * @param includeSource Whether to include source code (default false, recommended false)
   * @param maxScripts Maximum script count limit (default 1000, prevents memory overflow)
   */
  async getAllScripts(includeSource = false, maxScripts = 1000): Promise<ScriptInfo[]> {
    if (!this.cdpSession) {
      await this.init();
    }

    const scripts = Array.from(this.scripts.values());

    // 🔧 Fix: Check script count to prevent memory overflow
    if (scripts.length > maxScripts) {
      logger.warn(`Found ${scripts.length} scripts, limiting to ${maxScripts}. Increase maxScripts parameter if needed.`);
    }

    const limitedScripts = scripts.slice(0, maxScripts);

    // If source code is needed, fetch one by one
    if (includeSource) {
      logger.warn(`Loading source code for ${limitedScripts.length} scripts. This may use significant memory.`);

      let loadedCount = 0;
      let failedCount = 0;

      for (const script of limitedScripts) {
        if (!script.source) {
          try {
            const { scriptSource } = await this.cdpSession!.send('Debugger.getScriptSource', {
              scriptId: script.scriptId,
            });
            script.source = scriptSource;
            loadedCount++;

            // Log progress every 10 scripts loaded
            if (loadedCount % 10 === 0) {
              logger.debug(`Loaded ${loadedCount}/${limitedScripts.length} scripts...`);
            }
          } catch (error) {
            logger.warn(`Failed to get source for script ${script.scriptId}:`, error);
            failedCount++;
          }
        }
      }

      logger.info(`getAllScripts: ${limitedScripts.length} scripts (loaded: ${loadedCount}, failed: ${failedCount})`);
    } else {
      logger.info(`getAllScripts: ${limitedScripts.length} scripts (source not included)`);
    }

    return limitedScripts;
  }

  /**
   * Get the source code of a specified script
   */
  async getScriptSource(scriptId?: string, url?: string): Promise<ScriptInfo | null> {
    // ✅ Parameter validation
    if (!scriptId && !url) {
      throw new Error('Either scriptId or url parameter must be provided');
    }

    if (!this.cdpSession) {
      await this.init();
    }

    let targetScript: ScriptInfo | undefined;

    // Look up by scriptId
    if (scriptId) {
      targetScript = this.scripts.get(scriptId);
    }
    // Look up by URL (supports wildcards)
    else if (url) {
      const urlPattern = url.replace(/\*/g, '.*');

      // ✅ Fix: Add regex error handling
      let regex: RegExp;
      try {
        regex = new RegExp(urlPattern);
      } catch (error) {
        logger.error(`Invalid URL pattern: ${url}`, error);
        return null;
      }

      for (const [scriptUrl, scripts] of this.scriptsByUrl.entries()) {
        if (regex.test(scriptUrl)) {
          targetScript = scripts[0]; // Take the first matching script
          break;
        }
      }
    }

    if (!targetScript) {
      logger.warn(`Script not found: ${scriptId || url}`);
      return null;
    }

    // Get source code
    if (!targetScript.source) {
      try {
        const { scriptSource } = await this.cdpSession!.send('Debugger.getScriptSource', {
          scriptId: targetScript.scriptId,
        });
        targetScript.source = scriptSource;
        targetScript.sourceLength = scriptSource.length;

        // 🆕 Automatically build index and chunk
        this.buildKeywordIndex(targetScript.scriptId, targetScript.url, scriptSource);
        this.chunkScript(targetScript.scriptId, scriptSource);
      } catch (error) {
        logger.error(`Failed to get script source for ${targetScript.scriptId}:`, error);
        return null;
      }
    }

    logger.info(`getScriptSource: ${targetScript.url || 'inline'} (${targetScript.sourceLength} bytes)`);
    return targetScript;
  }

  /**
   * Find scripts by URL pattern
   */
  async findScriptsByUrl(urlPattern: string): Promise<ScriptInfo[]> {
    if (!this.cdpSession) {
      await this.init();
    }

    const pattern = urlPattern.replace(/\*/g, '.*');

    // ✅ Fix: Add regex error handling
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (error) {
      logger.error(`Invalid URL pattern: ${urlPattern}`, error);
      return [];
    }

    const results: ScriptInfo[] = [];

    for (const [url, scripts] of this.scriptsByUrl.entries()) {
      if (regex.test(url)) {
        results.push(...scripts);
      }
    }

    logger.info(`findScriptsByUrl: ${urlPattern} - found ${results.length} scripts`);
    return results;
  }

  /**
   * Clear cached script info (deprecated, use clear() instead)
   */
  clearCache(): void {
    this.clear();
  }

  /**
   * Search for keywords (across all scripts)
   */
  async searchInScripts(
    keyword: string,
    options: {
      isRegex?: boolean;
      caseSensitive?: boolean;
      contextLines?: number;
      maxMatches?: number;
    } = {}
  ): Promise<{
    keyword: string;
    totalMatches: number;
    matches: Array<{
      scriptId: string;
      url: string;
      line: number;
      column: number;
      matchText: string;
      context: string;
    }>;
  }> {
    if (!this.cdpSession) {
      await this.init();
    }

    const {
      isRegex = false,
      caseSensitive = false,
      contextLines = 3,
      maxMatches = 100,
    } = options;

    // ✅ Fix: Add regex error handling
    let searchRegex: RegExp;
    try {
      searchRegex = isRegex
        ? new RegExp(keyword, caseSensitive ? 'g' : 'gi')
        : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    } catch (error) {
      logger.error(`Invalid search pattern: ${keyword}`, error);
      return {
        keyword,
        totalMatches: 0,
        matches: [],
      };
    }

    const matches: Array<{
      scriptId: string;
      url: string;
      line: number;
      column: number;
      matchText: string;
      context: string;
    }> = [];

    // ✅ Fix: Get script list first (without source), avoid loading all sources at once
    const scriptList = await this.getAllScripts(false);
    logger.info(`Searching in ${scriptList.length} scripts...`);

    // Load script sources one by one and search
    for (const scriptInfo of scriptList) {
      if (matches.length >= maxMatches) break;

      // Load individual script source on demand
      const script = await this.getScriptSource(scriptInfo.scriptId);
      if (!script || !script.source) continue;

      const lines = script.source.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const lineMatches = Array.from(line.matchAll(searchRegex));

        for (const match of lineMatches) {
          if (matches.length >= maxMatches) break;

          // Extract context
          const startLine = Math.max(0, i - contextLines);
          const endLine = Math.min(lines.length - 1, i + contextLines);
          const contextArray = lines.slice(startLine, endLine + 1);
          const context = contextArray.join('\n');

          matches.push({
            scriptId: script.scriptId,
            url: script.url || 'inline',
            line: i + 1,
            column: match.index || 0,
            matchText: match[0],
            context,
          });
        }
      }
    }

    logger.info(`searchInScripts: "${keyword}" - found ${matches.length} matches`);

    return {
      keyword,
      totalMatches: matches.length,
      matches,
    };
  }

  /**
   * Extract a function and its dependency tree
   *
   * Note: This method requires Babel dependencies. If Babel is not installed, an error will be thrown.
   */
  async extractFunctionTree(
    scriptId: string,
    functionName: string,
    options: {
      maxDepth?: number;
      maxSize?: number; // KB
      includeComments?: boolean;
    } = {}
  ): Promise<{
    mainFunction: string;
    code: string;
    functions: Array<{
      name: string;
      code: string;
      dependencies: string[];
      startLine: number;
      endLine: number;
      size: number;
    }>;
    callGraph: Record<string, string[]>;
    totalSize: number;
    extractedCount: number;
  }> {
    const { maxDepth = 3, maxSize = 500, includeComments = true } = options;

    // Get script source code
    const script = await this.getScriptSource(scriptId);
    if (!script || !script.source) {
      throw new Error(`Script not found: ${scriptId}`);
    }

    // 🔧 Fix: Add error handling for Babel dynamic imports
    let parser: any, traverse: any, generate: any, t: any;

    try {
      parser = await import('@babel/parser');
      traverse = (await import('@babel/traverse')).default;
      generate = (await import('@babel/generator')).default;
      t = await import('@babel/types');
    } catch (error: any) {
      throw new Error(
        `Failed to load Babel dependencies. Please install: npm install @babel/parser @babel/traverse @babel/generator @babel/types\nError: ${error.message}`
      );
    }

    let ast: any;

    try {
      ast = parser.parse(script.source, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript'],
      });
    } catch (error: any) {
      throw new Error(`Failed to parse script ${scriptId}: ${error.message}`);
    }

    const allFunctions = new Map<
      string,
      {
        name: string;
        code: string;
        dependencies: string[];
        startLine: number;
        endLine: number;
        size: number;
      }
    >();
    const callGraph: Record<string, string[]> = {};

    // Helper function to extract dependencies
    const extractDependencies = (path: any): string[] => {
      const deps = new Set<string>();
      path.traverse({
        CallExpression(callPath: any) {
          if (t.isIdentifier(callPath.node.callee)) {
            deps.add(callPath.node.callee.name);
          }
        },
      });
      return Array.from(deps);
    };

    // Collect all function definitions
    traverse(ast, {
      FunctionDeclaration(path: any) {
        const name = path.node.id?.name;
        if (!name) return;

        const funcCode = generate(path.node, { comments: includeComments }).code;
        const deps = extractDependencies(path);

        allFunctions.set(name, {
          name,
          code: funcCode,
          startLine: path.node.loc?.start.line || 0,
          endLine: path.node.loc?.end.line || 0,
          dependencies: deps,
          size: funcCode.length,
        });

        callGraph[name] = deps;
      },

      VariableDeclarator(path: any) {
        if (
          t.isIdentifier(path.node.id) &&
          (t.isFunctionExpression(path.node.init) || t.isArrowFunctionExpression(path.node.init))
        ) {
          const name = path.node.id.name;
          const funcCode = generate(path.node, { comments: includeComments }).code;
          const deps = extractDependencies(path);

          allFunctions.set(name, {
            name,
            code: funcCode,
            startLine: path.node.loc?.start.line || 0,
            endLine: path.node.loc?.end.line || 0,
            dependencies: deps,
            size: funcCode.length,
          });

          callGraph[name] = deps;
        }
      },
    });

    // BFS to extract dependencies level by level
    const extracted = new Set<string>();
    let currentLevel = [functionName];
    let currentDepth = 0;

    while (currentLevel.length > 0 && currentDepth < maxDepth) {
      const nextLevel: string[] = [];

      for (const current of currentLevel) {
        if (extracted.has(current)) continue;

        const func = allFunctions.get(current);
        if (!func) continue;

        extracted.add(current);

        // Collect next level dependencies
        for (const dep of func.dependencies) {
          if (!extracted.has(dep) && allFunctions.has(dep)) {
            nextLevel.push(dep);
          }
        }
      }

      currentLevel = nextLevel;
      currentDepth++;
    }

    // Generate final code
    const functions = Array.from(extracted)
      .map(name => allFunctions.get(name)!)
      .filter(Boolean);

    const code = functions.map(f => f.code).join('\n\n');
    const totalSize = code.length;

    // Check size limit
    if (totalSize > maxSize * 1024) {
      logger.warn(`Extracted code size (${(totalSize / 1024).toFixed(2)}KB) exceeds limit (${maxSize}KB)`);
    }

    logger.info(`extractFunctionTree: ${functionName} - extracted ${functions.length} functions (${(totalSize / 1024).toFixed(2)}KB)`);

    return {
      mainFunction: functionName,
      code,
      functions,
      callGraph,
      totalSize,
      extractedCount: functions.length,
    };
  }

  /**
   * 🆕 Clear all data (called when switching websites)
   */
  clear(): void {
    this.scripts.clear();
    this.scriptsByUrl.clear();
    this.keywordIndex.clear();
    this.scriptChunks.clear();
    logger.info('✅ ScriptManager cleared - ready for new website');
  }

  /**
   * 🆕 Close ScriptManager and release all resources
   */
  async close(): Promise<void> {
    // Clear all data
    this.clear();

    // ✅ Fix: Remove event listener to prevent memory leaks
    if (this.cdpSession && this.scriptParsedListener) {
      try {
        this.cdpSession.off('Debugger.scriptParsed', this.scriptParsedListener);
        this.scriptParsedListener = null;
        logger.debug('Event listener removed');
      } catch (error) {
        logger.warn('Failed to remove event listener:', error);
      }
    }

    // Disable Debugger and detach CDP session
    if (this.cdpSession) {
      try {
        await this.cdpSession.send('Debugger.disable');
        await this.cdpSession.detach();
        logger.info('CDP session closed');
      } catch (error) {
        logger.warn('Failed to close CDP session:', error);
      }
      this.cdpSession = null;
    }

    // Reset initialization state
    this.initialized = false;
    logger.info('✅ ScriptManager closed');
  }

  /**
   * 🆕 Get statistics
   */
  getStats(): {
    totalScripts: number;
    totalUrls: number;
    indexedKeywords: number;
    totalChunks: number;
  } {
    let totalChunks = 0;
    for (const chunks of this.scriptChunks.values()) {
      totalChunks += chunks.length;
    }

    return {
      totalScripts: this.scripts.size,
      totalUrls: this.scriptsByUrl.size,
      indexedKeywords: this.keywordIndex.size,
      totalChunks,
    };
  }

  /**
   * 🆕 Build keyword index (automatically called when fetching script source)
   */
  private buildKeywordIndex(scriptId: string, url: string, content: string): void {
    const lines = content.split('\n');
    const keywordRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]{2,}\b/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const matches = Array.from(line.matchAll(keywordRegex));

      for (const match of matches) {
        const keyword = match[0].toLowerCase();

        // Extract context (3 lines before and after)
        const startLine = Math.max(0, i - 3);
        const endLine = Math.min(lines.length - 1, i + 3);
        const context = lines.slice(startLine, endLine + 1).join('\n');

        const entry: KeywordIndexEntry = {
          scriptId,
          url,
          line: i + 1,
          column: match.index || 0,
          context,
        };

        if (!this.keywordIndex.has(keyword)) {
          this.keywordIndex.set(keyword, []);
        }
        this.keywordIndex.get(keyword)!.push(entry);
      }
    }

    logger.debug(`📇 Indexed ${this.keywordIndex.size} keywords for ${url}`);
  }

  /**
   * 🆕 Chunk and store script (automatically called when fetching script source)
   */
  private chunkScript(scriptId: string, content: string): void {
    const chunks: ScriptChunk[] = [];
    let offset = 0;
    let chunkIndex = 0;

    while (offset < content.length) {
      const chunk = content.substring(offset, offset + this.CHUNK_SIZE);
      chunks.push({
        scriptId,
        chunkIndex,
        content: chunk,
        size: chunk.length,
      });
      offset += this.CHUNK_SIZE;
      chunkIndex++;
    }

    this.scriptChunks.set(scriptId, chunks);
    logger.debug(`📦 Chunked script ${scriptId} into ${chunks.length} chunks`);
  }

  /**
   * 🆕 Get a script chunk
   */
  getScriptChunk(scriptId: string, chunkIndex: number): string | null {
    const chunks = this.scriptChunks.get(scriptId);
    if (!chunks || chunkIndex >= chunks.length) {
      return null;
    }
    const chunk = chunks[chunkIndex];
    return chunk ? chunk.content : null;
  }

  /**
   * 🆕 Enhanced search (uses in-memory index, avoids reloading script sources)
   */
  async searchInScriptsEnhanced(
    keyword: string,
    options: {
      isRegex?: boolean;
      caseSensitive?: boolean;
      contextLines?: number;
      maxMatches?: number;
    } = {}
  ): Promise<{
    keyword: string;
    totalMatches: number;
    matches: Array<{
      scriptId: string;
      url: string;
      line: number;
      column: number;
      matchText: string;
      context: string;
    }>;
    searchMethod: 'indexed' | 'regex';
  }> {
    const { isRegex = false, caseSensitive = false, maxMatches = 100 } = options;

    const searchTerm = caseSensitive ? keyword : keyword.toLowerCase();
    const matches: Array<{
      scriptId: string;
      url: string;
      line: number;
      column: number;
      matchText: string;
      context: string;
    }> = [];

    if (!isRegex) {
      // Use index for fast lookup - O(1)
      for (const [indexedKeyword, entries] of this.keywordIndex.entries()) {
        if (indexedKeyword.includes(searchTerm)) {
          for (const entry of entries) {
            matches.push({
              scriptId: entry.scriptId,
              url: entry.url,
              line: entry.line,
              column: entry.column,
              matchText: indexedKeyword,
              context: entry.context,
            });

            if (matches.length >= maxMatches) {
              break;
            }
          }
        }

        if (matches.length >= maxMatches) {
          break;
        }
      }

      logger.info(`🔍 Enhanced search (indexed) found ${matches.length} matches for "${keyword}"`);

      return {
        keyword,
        totalMatches: matches.length,
        matches,
        searchMethod: 'indexed',
      };
    } else {
      // Regex search (falls back to the original method)
      const result = await this.searchInScripts(keyword, options);
      return {
        ...result,
        searchMethod: 'regex',
      };
    }
  }
}

