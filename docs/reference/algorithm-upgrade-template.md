# Algorithm Upgrade And First Divergence Template

This template is used for "algorithm upgrade, obfuscation upgrade, version switch" scenarios. The goal is to quickly find the `first divergence`, rather than reverse-engineering from scratch.

## Required Reading Before Starting

Read the following before starting:

1. `docs/reference/reverse-bootstrap.md`
2. `docs/reference/case-safety-policy.md`
3. `docs/reference/reverse-workflow.md`
4. If the current issue is already in the purification phase after `env-pass`, also read `docs/reference/pure-extraction.md`

The upgrade template must also comply with repository boundaries:

- Repository cases only retain abstract conclusions and methods
- Executable upgrade implementations, temporary verification scripts, and real task evidence go uniformly in `artifacts/tasks/<task-id>/`

## Applicable Scope

- Signature algorithm version change
- Local pure algorithm results start diverging from browser results
- `env rebuild` still runs, but final parameters mismatch
- VMP / AST / helper names have migrated

## Input Recommendations

- Old version conclusions or old version artifacts
- New version JS files or new page evidence
- `targetKeywords`
- `targetUrlPatterns`
- `targetFunctionNames`
- `targetActionDescription`
- Key sample inputs from old and new versions
- Key sample outputs from portable runtime
- Key sample outputs from pure algorithm
- Fixed fixtures (if available)

## Recommended Order

1. First perform structure normalization
2. Then perform target-driven sampling
3. Then check `first divergence`
4. First determine whether to continue with `env rebuild`, fix `portable runtime`, or switch to pure algorithm
5. Only then modify the implementation

## `first divergence` Checklist

Prioritize which layer diverges first:

1. Target request
2. Key function output matched by hook
3. token / nonce / sign intermediate values
4. crypto helper
5. env collect / storage / fingerprint
6. Final assembly

If parameter names look unusual, do not get stuck on the field names themselves. Prioritize checking:

- Which request changed first
- Which function first outputs a different value
- Which page action triggered this pipeline
- Within which time window the key evidence appeared

## Deliverable Requirements

- One updated task artifact
- One divergence summary
- One current `env rebuild` status report
- One pure algorithm candidate implementation, or a clear explanation of why purification is not yet possible
- One fixture alignment result
- One server-side acceptance result

## Output Template

1. The `first divergence` from this upgrade
2. Confirmed unchanged parts
3. Confirmed changed parts
4. Whether to continue with `env rebuild`, fix `portable runtime`, or switch to pure algorithm / deobfuscation
5. Whether current fixtures are stable and cross-language alignment is achievable
6. Whether server-side acceptance passes
7. Next minimum action
