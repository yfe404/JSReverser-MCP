/**
 * AST Optimizer - Advanced deobfuscation transformations based on Babel
 *
 * Implemented transformations:
 * 1. Constant Folding
 * 2. Constant Propagation
 * 3. Dead Code Elimination
 * 4. Expression Simplification
 * 5. Variable Inlining
 * 6. Object Property Unfolding
 * 7. Computed Property Name Resolution
 * 8. Sequence Expression Expansion
 */

import * as parser from '@babel/parser';
import traverseImport from '@babel/traverse';
const traverse = (traverseImport as unknown as {default?: typeof traverseImport}).default ?? traverseImport;
import generateImport from '@babel/generator';
const generate = (generateImport as unknown as {default?: typeof generateImport}).default ?? generateImport;
import * as t from '@babel/types';
import { logger } from '../../utils/logger.js';

export class ASTOptimizer {
  /**
   * Optimize code
   */
  optimize(code: string): string {
    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // Run multiple optimization passes
      for (let i = 0; i < 3; i++) {
        logger.debug(`AST optimization pass ${i + 1}`);
        
        this.constantFolding(ast);
        this.constantPropagation(ast);
        this.deadCodeElimination(ast);
        this.expressionSimplification(ast);
        this.variableInlining(ast);
        this.objectPropertyUnfolding(ast);
        this.computedPropertyResolution(ast);
        this.sequenceExpressionExpansion(ast);
      }

      const output = generate(ast, {
        comments: false,
        compact: false,
      });

      return output.code;
    } catch (error) {
      logger.error('AST optimization failed', error);
      return code;
    }
  }

  /**
   * Constant Folding
   * Example: 1 + 2 -> 3
   */
  private constantFolding(ast: t.File): void {
    traverse(ast, {
      BinaryExpression(path) {
        const { left, right, operator } = path.node;

        if (t.isNumericLiteral(left) && t.isNumericLiteral(right)) {
          let result: number;

          switch (operator) {
            case '+':
              result = left.value + right.value;
              break;
            case '-':
              result = left.value - right.value;
              break;
            case '*':
              result = left.value * right.value;
              break;
            case '/':
              result = left.value / right.value;
              break;
            case '%':
              result = left.value % right.value;
              break;
            case '**':
              result = left.value ** right.value;
              break;
            default:
              return;
          }

          path.replaceWith(t.numericLiteral(result));
        }

        // String concatenation
        if (t.isStringLiteral(left) && t.isStringLiteral(right) && operator === '+') {
          path.replaceWith(t.stringLiteral(left.value + right.value));
        }
      },

      UnaryExpression(path) {
        const { argument, operator } = path.node;

        if (t.isNumericLiteral(argument)) {
          if (operator === '-') {
            path.replaceWith(t.numericLiteral(-argument.value));
          } else if (operator === '+') {
            path.replaceWith(t.numericLiteral(argument.value));
          } else if (operator === '!') {
            path.replaceWith(t.booleanLiteral(!argument.value));
          }
        }

        if (t.isBooleanLiteral(argument) && operator === '!') {
          path.replaceWith(t.booleanLiteral(!argument.value));
        }
      },
    });
  }

  /**
   * Constant Propagation
   * Example: const a = 5; const b = a; -> const b = 5;
   */
  private constantPropagation(ast: t.File): void {
    const constants = new Map<string, t.Expression>();

    traverse(ast, {
      VariableDeclarator(path) {
        const { id, init } = path.node;

        if (t.isIdentifier(id) && init && t.isLiteral(init)) {
          constants.set(id.name, init);
        }
      },

      Identifier(path: any) {
        const name = path.node.name;
        const constant = constants.get(name);

        if (constant && !path.isBindingIdentifier()) {
          path.replaceWith(t.cloneNode(constant));
        }
      },
    });
  }

  /**
   * Dead Code Elimination
   * Example: if (false) { ... } -> removed
   */
  private deadCodeElimination(ast: t.File): void {
    traverse(ast, {
      IfStatement(path) {
        const { test, consequent, alternate } = path.node;

        if (t.isBooleanLiteral(test)) {
          if (test.value) {
            // if (true) -> keep consequent
            path.replaceWith(consequent);
          } else {
            // if (false) -> keep alternate or remove
            if (alternate) {
              path.replaceWith(alternate);
            } else {
              path.remove();
            }
          }
        }
      },

      ConditionalExpression(path) {
        const { test, consequent, alternate } = path.node;

        if (t.isBooleanLiteral(test)) {
          path.replaceWith(test.value ? consequent : alternate);
        }
      },

      LogicalExpression(path) {
        const { left, right, operator } = path.node;

        if (t.isBooleanLiteral(left)) {
          if (operator === '&&') {
            path.replaceWith(left.value ? right : left);
          } else if (operator === '||') {
            path.replaceWith(left.value ? left : right);
          }
        }
      },
    });
  }

  /**
   * Expression Simplification
   */
  private expressionSimplification(ast: t.File): void {
    traverse(ast, {
      BinaryExpression(path) {
        const { left, right, operator } = path.node;

        // x + 0 -> x
        if (operator === '+' && t.isNumericLiteral(right) && right.value === 0) {
          path.replaceWith(left);
        }

        // x * 1 -> x
        if (operator === '*' && t.isNumericLiteral(right) && right.value === 1) {
          path.replaceWith(left);
        }

        // x * 0 -> 0
        if (operator === '*' && t.isNumericLiteral(right) && right.value === 0) {
          path.replaceWith(t.numericLiteral(0));
        }
      },

      UnaryExpression(path) {
        const { argument, operator } = path.node;

        // !!x -> Boolean(x)
        if (
          operator === '!' &&
          t.isUnaryExpression(argument) &&
          argument.operator === '!'
        ) {
          path.replaceWith(
            t.callExpression(t.identifier('Boolean'), [argument.argument])
          );
        }
      },
    });
  }

  /**
   * Variable Inlining
   * Example: const a = 5; console.log(a); -> console.log(5);
   */
  private variableInlining(ast: t.File): void {
    const inlineCandidates = new Map<string, { value: t.Expression; usageCount: number }>();

    // First pass: collect candidate variables
    traverse(ast, {
      VariableDeclarator(path) {
        const { id, init } = path.node;

        if (t.isIdentifier(id) && init && t.isLiteral(init)) {
          inlineCandidates.set(id.name, { value: init, usageCount: 0 });
        }
      },

      Identifier(path) {
        const name = path.node.name;
        const candidate = inlineCandidates.get(name);

        if (candidate && !path.isBindingIdentifier()) {
          candidate.usageCount++;
        }
      },
    });

    // Second pass: inline variables with few usages
    traverse(ast, {
      Identifier(path: any) {
        const name = path.node.name;
        const candidate = inlineCandidates.get(name);

        if (candidate && candidate.usageCount <= 3 && !path.isBindingIdentifier()) {
          path.replaceWith(t.cloneNode(candidate.value));
        }
      },
    });
  }

  /**
   * Object Property Unfolding
   * Example: obj['prop'] -> obj.prop
   */
  private objectPropertyUnfolding(ast: t.File): void {
    traverse(ast, {
      MemberExpression(path) {
        const { object, property, computed } = path.node;

        if (computed && t.isStringLiteral(property)) {
          // Check if the property name is a valid identifier
          if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(property.value)) {
            path.replaceWith(
              t.memberExpression(object, t.identifier(property.value), false)
            );
          }
        }
      },
    });
  }

  /**
   * Computed Property Name Resolution
   */
  private computedPropertyResolution(ast: t.File): void {
    traverse(ast, {
      ObjectProperty(path) {
        const { key, computed } = path.node;

        if (computed && t.isStringLiteral(key)) {
          if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key.value)) {
            path.node.computed = false;
            path.node.key = t.identifier(key.value);
          }
        }
      },
    });
  }

  /**
   * Sequence Expression Expansion
   * Example: (a, b, c) -> c (in certain cases)
   */
  private sequenceExpressionExpansion(ast: t.File): void {
    traverse(ast, {
      SequenceExpression(path: any) {
        const { expressions } = path.node;

        // If the sequence expression has only one element, replace directly
        if (expressions.length === 1 && expressions[0]) {
          path.replaceWith(expressions[0]);
        }

        // If inside an expression statement, expand into multiple statements
        if (path.parentPath.isExpressionStatement()) {
          const statements = expressions.map((expr: t.Expression) => t.expressionStatement(expr));
          path.parentPath.replaceWithMultiple(statements);
        }
      },
    });
  }
}

