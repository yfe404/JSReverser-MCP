# Case: AST Deobfuscation

## Goal
- Break obfuscated code into "readable semantic blocks" rather than attempting a one-pass restoration to final source code.
- Produce verifiable evidence: each static rewrite step must align with runtime behavior.

## Applicable Scenarios
- String table + index function (`_0x***`)
- Flat control flow (`while(true)+switch`)
- Junk instructions (always-true/always-false branches, dead code)
- IIFE wrappers + multi-layer proxy calls

## Input Requirements
- Original script (preserve source map information if possible)
- Target function name or target keyword (for focusing)
- Minimal runtime sample (input parameters and expected output)

## Process (Recommended Order)
1. Pre-scan
- Collect AST metrics: node count, function count, literal ratio, `eval/new Function` occurrence count.
- Flag high-risk nodes: dynamic execution, anti-debugging, environment probes.

2. String Layer Deobfuscation
- Locate string table and decoding function.
- Perform "provably equivalent" replacements: only replace statically evaluable expressions.
- Record replacement statistics: replacement count, failure count, failure samples.

3. Proxy Layer Folding
- Identify proxy functions (simple forwarding, argument reordering, constant wrapping).
- Fold inlinable proxies into direct calls.
- Preserve indeterminate proxies to avoid incorrectly modifying business logic.

4. Control Flow Restoration
- Handle `while-switch` flattening, rebuild statement order based on dispatch sequence.
- Run a coverage verification pass before deleting unreachable branches.

5. Dead Code Cleanup
- Remove unreferenced declarations, always-false branches, side-effect-free expressions.
- Perform semantic comparison (minimal sample) after each cleanup step.

6. Runtime Verification
- Replay input/output for core functions:
  - Original code output
  - Rewritten code output
- Outputs must match; otherwise roll back the most recent transformation.

## Verification Criteria
- Structural metrics decrease:
  - Node count reduced
  - Nesting depth decreased
  - Dynamic execution points reduced
- Semantic metrics remain stable:
  - Key function I/O consistent
  - Key request parameters consistent (if signatures are involved)

## Common Failures and Fallbacks
- String decoding depends on runtime state:
  - Fall back to "runtime sampling + local replacement"; do not perform full static replacement.
- Behavior drift after control flow restoration:
  - Only restore the target function; minimize the rewrite surface.
- Crash after dead code cleanup:
  - Preserve suspect side-effect nodes; delete in batches.

## Suggested Output Artifacts
- `before.js` / `after.stepN.js`
- `transform-log.json` (per-step transformation statistics)
- `verify-report.md` (I/O comparison and difference explanation)

## Security Boundaries
- Do not include site-specific payloads that can be directly reused in bulk in the documentation.
- Do not commit sample inputs containing real credentials or business-sensitive parameters.
