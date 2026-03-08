/**
 * AdaptiveDataSerializer - Adaptive Data Serializer
 *
 * Core features:
 * 1. Auto-detect data types (large arrays, deep objects, code strings, network requests, etc.)
 * 2. Select optimal serialization strategy based on type
 * 3. Smart truncation and sampling
 * 4. Preserve key information, reduce token waste
 *
 * Design principles:
 * - Type detection first - identify type before processing
 * - Preserve structure - keep key structural information
 * - Progressive loading - support on-demand retrieval of full data
 */

import { DetailedDataManager } from './detailedDataManager.js';
import { safeStringify } from './safeJson.js';

/**
 * Serialization context
 */
export interface SerializationContext {
  maxDepth?: number; // Maximum depth (default 3)
  maxArrayLength?: number; // Maximum array length (default 10)
  maxStringLength?: number; // Maximum string length (default 1000)
  maxObjectKeys?: number; // Maximum number of object keys (default 20)
  threshold?: number; // Large data threshold (default 50KB)
}

/**
 * Data type
 */
type DataType =
  | 'large-array'
  | 'deep-object'
  | 'code-string'
  | 'network-requests'
  | 'dom-structure'
  | 'function-tree'
  | 'primitive'
  | 'unknown';

/**
 * Adaptive data serializer
 */
export class AdaptiveDataSerializer {
  private readonly DEFAULT_CONTEXT: Required<SerializationContext> = {
    maxDepth: 3,
    maxArrayLength: 10,
    maxStringLength: 1000,
    maxObjectKeys: 20,
    threshold: 50 * 1024,
  };

  /**
   * Serialize data
   */
  serialize(data: any, context: SerializationContext = {}): string {
    const ctx = { ...this.DEFAULT_CONTEXT, ...context };

    // Detect data type
    const type = this.detectType(data);

    // Select serialization strategy based on type
    switch (type) {
      case 'large-array':
        return this.serializeLargeArray(data, ctx);
      case 'deep-object':
        return this.serializeDeepObject(data, ctx);
      case 'code-string':
        return this.serializeCodeString(data, ctx);
      case 'network-requests':
        return this.serializeNetworkRequests(data, ctx);
      case 'dom-structure':
        return this.serializeDOMStructure(data, ctx);
      case 'function-tree':
        return this.serializeFunctionTree(data, ctx);
      case 'primitive':
        return safeStringify(data);
      default:
        return this.serializeDefault(data, ctx);
    }
  }

  /**
   * Detect data type
   */
  private detectType(data: any): DataType {
    if (data === null || data === undefined) {
      return 'primitive';
    }

    const type = typeof data;

    // Primitive types
    if (type === 'string' || type === 'number' || type === 'boolean') {
      // Check if it is a code string
      if (type === 'string' && this.isCodeString(data)) {
        return 'code-string';
      }
      return 'primitive';
    }

    // Array
    if (Array.isArray(data)) {
      // Check if it is a network request array
      if (data.length > 0 && this.isNetworkRequest(data[0])) {
        return 'network-requests';
      }
      // Check if it is a large array
      if (data.length > 100) {
        return 'large-array';
      }
    }

    // Object
    if (type === 'object') {
      // Check if it is a DOM structure
      if (this.isDOMStructure(data)) {
        return 'dom-structure';
      }
      // Check if it is a function tree
      if (this.isFunctionTree(data)) {
        return 'function-tree';
      }
      // Check if it is a deep object
      if (this.getDepth(data) > 3) {
        return 'deep-object';
      }
    }

    return 'unknown';
  }

  /**
   * Serialize large array
   */
  private serializeLargeArray(arr: any[], ctx: Required<SerializationContext>): string {
    if (arr.length <= ctx.maxArrayLength) {
      return safeStringify(arr);
    }

    // Sample: first 5 + last 5
    const sample = [
      ...arr.slice(0, 5),
      ...arr.slice(-5),
    ];

    const detailId = DetailedDataManager.getInstance().store(arr);

    return safeStringify({
      type: 'large-array',
      length: arr.length,
      sample,
      detailId,
      hint: `Use get_detailed_data("${detailId}") to get full array`,
    });
  }

  /**
   * Serialize deep object
   */
  private serializeDeepObject(obj: any, ctx: Required<SerializationContext>): string {
    const limited = this.limitDepth(obj, ctx.maxDepth);
    return safeStringify(limited);
  }

  /**
   * Serialize code string
   */
  private serializeCodeString(code: string, _ctx: Required<SerializationContext>): string {
    const lines = code.split('\n');

    if (lines.length <= 100) {
      return safeStringify(code);
    }

    // Only return the first 50 lines
    const preview = lines.slice(0, 50).join('\n');
    const detailId = DetailedDataManager.getInstance().store(code);

    return safeStringify({
      type: 'code-string',
      totalLines: lines.length,
      preview,
      detailId,
      hint: `Use get_detailed_data("${detailId}") to get full code`,
    });
  }

  /**
   * Serialize network requests
   */
  private serializeNetworkRequests(requests: any[], ctx: Required<SerializationContext>): string {
    if (requests.length <= ctx.maxArrayLength) {
      return safeStringify(requests);
    }

    // Only return key information
    const summary = requests.map(req => ({
      requestId: req.requestId,
      url: req.url,
      method: req.method,
      type: req.type,
      timestamp: req.timestamp,
    }));

    const detailId = DetailedDataManager.getInstance().store(requests);

    return safeStringify({
      type: 'network-requests',
      count: requests.length,
      summary: summary.slice(0, ctx.maxArrayLength),
      detailId,
      hint: `Use get_detailed_data("${detailId}") to get full requests`,
    });
  }

  /**
   * Serialize DOM structure
   */
  private serializeDOMStructure(dom: any, ctx: Required<SerializationContext>): string {
    // Limit depth
    const limited = this.limitDepth(dom, ctx.maxDepth);
    return safeStringify(limited);
  }

  /**
   * Serialize function tree
   */
  private serializeFunctionTree(tree: any, ctx: Required<SerializationContext>): string {
    // Only keep function names and call relationships
    const simplified = this.simplifyFunctionTree(tree, ctx.maxDepth);
    return safeStringify(simplified);
  }

  /**
   * Default serialization
   */
  private serializeDefault(data: any, ctx: Required<SerializationContext>): string {
    const jsonStr = safeStringify(data);

    if (jsonStr.length <= ctx.threshold) {
      return jsonStr;
    }

    // Return summary for large data
    const detailId = DetailedDataManager.getInstance().store(data);

    return safeStringify({
      type: 'large-data',
      size: jsonStr.length,
      sizeKB: (jsonStr.length / 1024).toFixed(1),
      preview: jsonStr.substring(0, 500),
      detailId,
      hint: `Use get_detailed_data("${detailId}") to get full data`,
    });
  }

  // ==================== Helper methods ====================

  /**
   * Check if it is a code string
   */
  private isCodeString(str: string): boolean {
    if (str.length < 100) return false;

    // Check if it contains code patterns
    const codePatterns = [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /class\s+\w+/,
      /import\s+.*from/,
      /export\s+(default|const|function)/,
    ];

    return codePatterns.some(pattern => pattern.test(str));
  }

  /**
   * Check if it is a network request
   */
  private isNetworkRequest(obj: any): boolean {
    return obj && typeof obj === 'object' &&
      ('requestId' in obj || 'url' in obj) &&
      ('method' in obj || 'type' in obj);
  }

  /**
   * Check if it is a DOM structure
   */
  private isDOMStructure(obj: any): boolean {
    return obj && typeof obj === 'object' &&
      ('tag' in obj || 'tagName' in obj) &&
      ('children' in obj || 'childNodes' in obj);
  }

  /**
   * Check if it is a function tree
   */
  private isFunctionTree(obj: any): boolean {
    return obj && typeof obj === 'object' &&
      ('functionName' in obj || 'name' in obj) &&
      ('dependencies' in obj || 'calls' in obj || 'callGraph' in obj);
  }

  /**
   * Get object depth
   */
  private getDepth(obj: any, currentDepth = 0): number {
    if (obj === null || typeof obj !== 'object') {
      return currentDepth;
    }

    if (currentDepth > 10) return currentDepth; // Prevent infinite recursion

    let maxDepth = currentDepth;

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const depth = this.getDepth(obj[key], currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  /**
   * Limit object depth
   */
  private limitDepth(obj: any, maxDepth: number, currentDepth = 0): any {
    if (currentDepth >= maxDepth) {
      return '[Max depth reached]';
    }

    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.limitDepth(item, maxDepth, currentDepth + 1));
    }

    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = this.limitDepth(obj[key], maxDepth, currentDepth + 1);
      }
    }

    return result;
  }

  /**
   * Simplify function tree
   */
  private simplifyFunctionTree(tree: any, maxDepth: number, currentDepth = 0): any {
    if (currentDepth >= maxDepth) {
      return { name: tree.functionName || tree.name, truncated: true };
    }

    return {
      name: tree.functionName || tree.name,
      dependencies: (tree.dependencies || []).map((dep: any) =>
        this.simplifyFunctionTree(dep, maxDepth, currentDepth + 1)
      ),
    };
  }
}

