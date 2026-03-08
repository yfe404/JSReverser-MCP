/**
 * Safe JSON operation utilities
 *
 * Features:
 * - Handles circular references
 * - Handles BigInt
 * - Handles special objects (Error, RegExp, Date, etc.)
 * - Provides friendly error handling
 */

/**
 * Safe JSON.stringify
 *
 * @param data Data to serialize
 * @param space Indentation spaces (optional)
 * @param maxDepth Maximum depth (default 10, prevents deep nesting)
 * @returns JSON string, or error description on failure
 */
export function safeStringify(data: any, space?: number, maxDepth = 10): string {
  const seen = new WeakSet();
  let depth = 0;

  const replacer = (key: string, value: any): any => {
    // Handle undefined
    if (value === undefined) {
      return '[undefined]';
    }

    // Handle BigInt
    if (typeof value === 'bigint') {
      return `[BigInt: ${value.toString()}]`;
    }

    // Handle functions
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }

    // Handle Symbol
    if (typeof value === 'symbol') {
      return `[Symbol: ${value.toString()}]`;
    }

    // Handle special objects
    if (value instanceof Error) {
      return {
        __type: 'Error',
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value instanceof RegExp) {
      return {
        __type: 'RegExp',
        source: value.source,
        flags: value.flags,
      };
    }

    if (value instanceof Date) {
      return {
        __type: 'Date',
        value: value.toISOString(),
      };
    }

    // Handle objects and arrays
    if (value !== null && typeof value === 'object') {
      // Depth limit
      depth++;
      if (depth > maxDepth) {
        depth--;
        return '[Max depth exceeded]';
      }

      // Circular reference detection
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);

      // Normal return
      const result = value;
      depth--;
      return result;
    }

    return value;
  };

  try {
    return JSON.stringify(data, replacer, space);
  } catch (error) {
    // If it still fails, return an error description
    return `[Serialization Error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Safe JSON.parse
 *
 * @param text JSON string
 * @returns Parsed object, or null on failure
 */
export function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}
