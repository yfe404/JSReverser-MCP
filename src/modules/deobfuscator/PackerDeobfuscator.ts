/**
 * Packer Deobfuscator
 * Specifically designed to handle JavaScript code obfuscated with Dean Edwards' Packer
 *
 * Packer characteristics:
 * 1. eval(function(p,a,c,k,e,d){...})(...) pattern
 * 2. Uses base-62 or higher radix encoding
 * 3. String array storage
 * 4. Self-extracting logic
 *
 * References:
 * - Dean Edwards' Packer: http://dean.edwards.name/packer/
 * - Online unpacker tool: https://matthewfl.com/unPacker.html
 */

import { logger } from '../../utils/logger.js';

/**
 * Packer deobfuscation options
 */
export interface PackerDeobfuscatorOptions {
  code: string;
  maxIterations?: number;  // Maximum unpacking iteration count
}

/**
 * Packer deobfuscation result
 */
export interface PackerDeobfuscatorResult {
  code: string;
  success: boolean;
  iterations: number;
  warnings: string[];
}

/**
 * Packer Deobfuscator
 */
export class PackerDeobfuscator {
  /**
   * Detect whether the code is Packer-obfuscated
   */
  static detect(code: string): boolean {
    // Detect the typical Packer pattern
    const packerPattern = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]\s*\)/;
    return packerPattern.test(code);
  }

  /**
   * Deobfuscate Packer code
   */
  async deobfuscate(options: PackerDeobfuscatorOptions): Promise<PackerDeobfuscatorResult> {
    const { code, maxIterations = 5 } = options;

    logger.info('📦 Starting Packer deobfuscation...');

    const warnings: string[] = [];
    let currentCode = code;
    let iterations = 0;

    try {
      // Loop unpacking until the code is no longer in Packer format
      while (PackerDeobfuscator.detect(currentCode) && iterations < maxIterations) {
        const unpacked = this.unpack(currentCode);

        if (!unpacked || unpacked === currentCode) {
          warnings.push('Unpacking failed or reached final state');
          break;
        }

        currentCode = unpacked;
        iterations++;
        logger.info(`📦 Completed unpacking iteration ${iterations}`);
      }

      logger.info(`✅ Packer deobfuscation complete, ${iterations} iteration(s) total`);

      return {
        code: currentCode,
        success: true,
        iterations,
        warnings,
      };
    } catch (error) {
      logger.error('Packer deobfuscation failed', error);
      return {
        code: currentCode,
        success: false,
        iterations,
        warnings: [...warnings, String(error)],
      };
    }
  }

  /**
   * Unpack a single layer of Packer obfuscation
   */
  private unpack(code: string): string {
    // 1. Extract Packer parameters
    const match = code.match(
      /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]\s*\)\s*{([\s\S]*?)}\s*\((.*?)\)\s*\)/
    );

    if (!match || !match[2]) {
      return code;
    }

    const args = match[2];

    // 2. Parse parameters
    const params = this.parsePackerParams(args);
    if (!params) {
      return code;
    }

    // 3. Execute unpacking
    try {
      const unpacked = this.executeUnpacker(params);
      return unpacked || code;
    } catch (error) {
      logger.warn('Unpacking execution failed', error);
      return code;
    }
  }

  /**
   * Parse Packer parameters
   */
  private parsePackerParams(argsString: string): {
    p: string;
    a: number;
    c: number;
    k: string[];
    e: Function;
    d: Function;
  } | null {
    try {
      // Safely parse parameters using the Function constructor
      // eslint-disable-next-line no-new-func
      const parseFunc = new Function(`return [${argsString}];`);
      const params = parseFunc();

      if (params.length < 4) {
        return null;
      }

      return {
        p: params[0] || '',
        a: params[1] || 0,
        c: params[2] || 0,
        k: (params[3] || '').split('|'),
        e: params[4] || function (c: any) { return c; },
        d: params[5] || function () { return ''; },
      };
    } catch {
      return null;
    }
  }

  /**
   * Execute the unpacker
   */
  private executeUnpacker(
    params: { p: string; a: number; c: number; k: string[]; e: Function; d: Function }
  ): string {
    const { p, a, k } = params;
    let { c } = params;

    // Standard Packer unpacking logic
    let result = p;

    // Replace all encoded identifiers
    while (c--) {
      const replacement = k[c];
      if (replacement) {
        const pattern = new RegExp('\\b' + this.base(c, a) + '\\b', 'g');
        result = result.replace(pattern, replacement);
      }
    }

    return result;
  }

  /**
   * Radix conversion (encoding method used by Packer)
   */
  private base(num: number, radix: number): string {
    const digits = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    if (num === 0) {
      return '0';
    }

    let result = '';
    while (num > 0) {
      result = digits[num % radix] + result;
      num = Math.floor(num / radix);
    }

    return result || '0';
  }

  /**
   * Beautify unpacked code
   */
  beautify(code: string): string {
    // Simple code beautification
    let result = code;

    // Add line breaks
    result = result.replace(/;/g, ';\n');
    result = result.replace(/{/g, '{\n');
    result = result.replace(/}/g, '\n}\n');

    // Remove excessive blank lines
    result = result.replace(/\n\n+/g, '\n\n');

    return result.trim();
  }
}

/**
 * AAEncode Deobfuscator
 * Handles JavaScript encoded with emoticon characters
 */
export class AAEncodeDeobfuscator {
  /**
   * Detect whether the code is AAEncoded
   */
  static detect(code: string): boolean {
    // AAEncode uses emoticon characters
    return code.includes('゜-゜') || code.includes('ω゜') || code.includes('o゜)');
  }

  /**
   * Deobfuscate AAEncode code
   */
  async deobfuscate(code: string): Promise<string> {
    logger.info('😊 Starting AAEncode deobfuscation...');

    try {
      // AAEncode is essentially executable JavaScript
      // Use the Function constructor to execute and retrieve the result
      // eslint-disable-next-line no-new-func
      const decoded = new Function(`return (${code})`)();

      logger.info('✅ AAEncode deobfuscation complete');
      return decoded;
    } catch (error) {
      logger.error('AAEncode deobfuscation failed', error);
      return code;
    }
  }
}

/**
 * URLEncode Deobfuscator
 * Handles URL-encoded JavaScript
 */
export class URLEncodeDeobfuscator {
  /**
   * Detect whether the code is URL-encoded
   */
  static detect(code: string): boolean {
    // Detect a high number of percent-encoded sequences
    const percentCount = (code.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    return percentCount > 10;
  }

  /**
   * Deobfuscate URL-encoded code
   */
  async deobfuscate(code: string): Promise<string> {
    logger.info('🔗 Starting URLEncode deobfuscation...');

    try {
      const decoded = decodeURIComponent(code);
      logger.info('✅ URLEncode deobfuscation complete');
      return decoded;
    } catch (error) {
      logger.error('URLEncode deobfuscation failed', error);
      return code;
    }
  }
}

/**
 * Universal Unpacker
 * Automatically detects and applies the appropriate deobfuscator
 */
export class UniversalUnpacker {
  private packerDeobfuscator = new PackerDeobfuscator();
  private aaencodeDeobfuscator = new AAEncodeDeobfuscator();
  private urlencodeDeobfuscator = new URLEncodeDeobfuscator();

  /**
   * Automatically detect and deobfuscate
   */
  async deobfuscate(code: string): Promise<{
    code: string;
    type: string;
    success: boolean;
  }> {
    logger.info('🔍 Auto-detecting obfuscation type...');

    // 1. Detect Packer
    if (PackerDeobfuscator.detect(code)) {
      logger.info('Detected: Packer obfuscation');
      const result = await this.packerDeobfuscator.deobfuscate({ code });
      return {
        code: result.code,
        type: 'Packer',
        success: result.success,
      };
    }

    // 2. Detect AAEncode
    if (AAEncodeDeobfuscator.detect(code)) {
      logger.info('Detected: AAEncode obfuscation');
      const decoded = await this.aaencodeDeobfuscator.deobfuscate(code);
      return {
        code: decoded,
        type: 'AAEncode',
        success: decoded !== code,
      };
    }

    // 3. Detect URLEncode
    if (URLEncodeDeobfuscator.detect(code)) {
      logger.info('Detected: URLEncode obfuscation');
      const decoded = await this.urlencodeDeobfuscator.deobfuscate(code);
      return {
        code: decoded,
        type: 'URLEncode',
        success: decoded !== code,
      };
    }

    logger.info('No known obfuscation type detected');
    return {
      code,
      type: 'Unknown',
      success: false,
    };
  }
}

