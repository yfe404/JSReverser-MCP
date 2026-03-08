/**
 * Deobfuscation module public exports
 */

// Main pipeline
export { Deobfuscator } from './Deobfuscator.js';
export type { DeobfuscateFullOptions } from './Deobfuscator.js';

// Sub-modules
export { AdvancedDeobfuscator } from './AdvancedDeobfuscator.js';
export type { AdvancedDeobfuscateOptions, AdvancedDeobfuscateResult } from './AdvancedDeobfuscator.js';

export { JSVMPDeobfuscator } from './JSVMPDeobfuscator.js';

export { ASTOptimizer } from './ASTOptimizer.js';

export {
  PackerDeobfuscator,
  AAEncodeDeobfuscator,
  URLEncodeDeobfuscator,
  UniversalUnpacker,
} from './PackerDeobfuscator.js';
export type { PackerDeobfuscatorOptions, PackerDeobfuscatorResult } from './PackerDeobfuscator.js';
