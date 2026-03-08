/**
 * Crypto Detection Module - Optimized Version
 *
 * Features:
 * - Dynamic rule engine (supports custom rules)
 * - Keyword matching detection (AES, RSA, SHA256, etc.)
 * - Code pattern recognition (S-box, big number operations, bitwise operations)
 * - AI deep analysis (LLM-assisted identification of custom encryption)
 * - Crypto library detection (CryptoJS, JSEncrypt, forge, etc.)
 * - Constant detection (magic numbers, initialization vectors)
 * - Parameter extraction (key length, mode, padding)
 * - Security assessment (weak algorithm detection, insecure configurations)
 * - Encryption strength analysis
 * - Usage scenario analysis
 * - Performance optimization (single AST parse, result caching)
 */

import type { DetectCryptoOptions, DetectCryptoResult, CryptoAlgorithm, CryptoLibrary } from '../../types/index.js';
import { LLMService } from '../../services/LLMService.js';
import { logger } from '../../utils/logger.js';
import { CryptoRulesManager } from './CryptoRules.js';
import {
  SecurityIssue,
  CryptoStrength,
  detectByAST,
  mergeParameters,
  evaluateSecurity,
  analyzeStrength,
} from './CryptoDetectorEnhanced.js';

export class CryptoDetector {
  private llm: LLMService;
  private rulesManager: CryptoRulesManager;

  constructor(llm: LLMService, customRules?: CryptoRulesManager) {
    this.llm = llm;
    this.rulesManager = customRules || new CryptoRulesManager();
  }

  /**
   * Load custom rules
   */
  loadCustomRules(json: string): void {
    this.rulesManager.loadFromJSON(json);
  }

  /**
   * Export current rules
   */
  exportRules(): string {
    return this.rulesManager.exportToJSON();
  }

  /**
   * Detect crypto algorithms (optimized version - single AST parse)
   */
  async detect(options: DetectCryptoOptions): Promise<DetectCryptoResult & {
    securityIssues?: SecurityIssue[];
    strength?: CryptoStrength;
  }> {
    logger.info('Starting crypto detection...');
    const startTime = Date.now();

    try {
      const { code } = options;
      const algorithms: CryptoAlgorithm[] = [];
      const libraries: CryptoLibrary[] = [];
      const securityIssues: SecurityIssue[] = [];

      // 1. Keyword matching (fast detection)
      const keywordResults = this.detectByKeywords(code);
      algorithms.push(...keywordResults);
      logger.debug(`Found ${keywordResults.length} algorithms by keywords`);

      // 2. Detect crypto libraries (fast detection)
      const libraryResults = this.detectLibraries(code);
      libraries.push(...libraryResults);
      logger.debug(`Found ${libraryResults.length} libraries`);

      // 3. Unified AST parsing and detection (performance optimization)
      const astResults = detectByAST(code, this.rulesManager);
      algorithms.push(...astResults.algorithms);
      if (astResults.parameters) {
        mergeParameters(algorithms, astResults.parameters);
      }
      logger.debug(`Found ${astResults.algorithms.length} algorithms by AST analysis`);

      // 4. AI deep analysis (disabled by default, requires explicit opt-in to avoid unnecessary LLM calls)
      const useAI = (options as any).useAI === true;
      if (useAI) {
        const aiResults = await this.detectByAI(code);
        algorithms.push(...aiResults);
        logger.debug(`AI detected ${aiResults.length} algorithms`);
      }

      // 5. Merge and deduplicate
      const mergedAlgorithms = this.mergeResults(algorithms);

      // 6. Security assessment
      const securityResults = evaluateSecurity(mergedAlgorithms, code, this.rulesManager);
      securityIssues.push(...securityResults);
      logger.debug(`Found ${securityIssues.length} security issues`);

      // 7. Encryption strength analysis
      const strength = analyzeStrength(mergedAlgorithms, securityIssues);

      // 8. Calculate overall confidence
      const confidence =
        mergedAlgorithms.length > 0
          ? mergedAlgorithms.reduce((sum, algo) => sum + algo.confidence, 0) / mergedAlgorithms.length
          : 0;

      const duration = Date.now() - startTime;
      logger.success(`Crypto detection completed in ${duration}ms, found ${mergedAlgorithms.length} algorithms`);

      return {
        algorithms: mergedAlgorithms,
        libraries,
        confidence,
        securityIssues,
        strength,
      };
    } catch (error) {
      logger.error('Crypto detection failed', error);
      throw error;
    }
  }

  /**
   * Keyword-based detection (using dynamic rules)
   */
  private detectByKeywords(code: string): CryptoAlgorithm[] {
    const algorithms: CryptoAlgorithm[] = [];
    const keywordRules = this.rulesManager.getKeywordRules();

    keywordRules.forEach((rule) => {
      rule.keywords.forEach((keyword) => {
        // Use word boundary matching to avoid false matches
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi');
        const matches = code.match(regex);

        if (matches) {
          // Skip mode and padding, they are not standalone algorithms
          if (rule.category === 'mode' || rule.category === 'padding') {
            return;
          }

          algorithms.push({
            name: keyword,
            type: rule.category as CryptoAlgorithm['type'],
            confidence: rule.confidence,
            location: {
              file: 'current',
              line: this.findLineNumber(code, keyword),
            },
            usage: `Found ${matches.length} occurrence(s) of ${keyword}${rule.description ? ` (${rule.description})` : ''}`,
          });
        }
      });
    });

    return algorithms;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // detectByPatterns and detectByConstants have been replaced by the unified detectByAST
  // See CryptoDetectorEnhanced.ts

  /**
   * AI-based detection
   */
  private async detectByAI(code: string): Promise<CryptoAlgorithm[]> {
    try {
      const messages = this.llm.generateCryptoDetectionPrompt(code);
      const response = await this.llm.chat(messages, { temperature: 0.2, maxTokens: 2000 });

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const result = JSON.parse(jsonMatch[0]) as { algorithms?: unknown[] };
      if (!Array.isArray(result.algorithms)) {
        return [];
      }

      return result.algorithms.map((algo: unknown) => {
        const a = algo as Record<string, unknown>;
        return {
          name: (a.name as string) || 'Unknown',
          type: (a.type as CryptoAlgorithm['type']) || 'other',
          confidence: (a.confidence as number) || 0.5,
          location: {
            file: 'current',
            line: 0,
          },
          parameters: a.parameters as CryptoAlgorithm['parameters'],
          usage: (a.usage as string) || '',
        };
      });
    } catch (error) {
      logger.warn('AI crypto detection failed', error);
      return [];
    }
  }

  /**
   * Detect crypto libraries (using dynamic rules)
   */
  private detectLibraries(code: string): CryptoLibrary[] {
    const libraries: CryptoLibrary[] = [];
    const libraryRules = this.rulesManager.getLibraryRules();

    libraryRules.forEach((rule) => {
      const found = rule.patterns.some((pattern) => code.includes(pattern));

      if (found) {
        // Try to extract version number
        let version: string | undefined;
        if (rule.versionPattern) {
          const versionMatch = code.match(rule.versionPattern);
          version = versionMatch?.[1];
        }

        libraries.push({
          name: rule.name,
          version,
          confidence: rule.confidence,
          // features are stored in the rule, no need to add to the library object
        });
      }
    });

    return libraries;
  }

  // detectByConstants has been replaced by the unified detectByAST
  // See CryptoDetectorEnhanced.ts

  // extractParameters and getCalleeFullName have been replaced by the implementation in detectByAST
  // See CryptoDetectorEnhanced.ts

  /**
   * Merge and deduplicate detection results
   */
  private mergeResults(algorithms: CryptoAlgorithm[]): CryptoAlgorithm[] {
    const merged = new Map<string, CryptoAlgorithm>();

    algorithms.forEach((algo) => {
      const key = `${algo.name}-${algo.type}`;
      const existing = merged.get(key);

      if (!existing || algo.confidence > existing.confidence) {
        merged.set(key, algo);
      }
    });

    return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Find the line number where a keyword occurs
   */
  private findLineNumber(code: string, keyword: string): number {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.includes(keyword)) {
        return i + 1;
      }
    }
    return 0;
  }
}

