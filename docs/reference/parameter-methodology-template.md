# Parameter Reproduction Methodology Template (Site-Agnostic)

Updated: 2026-03-05

## Mandatory Constraints Before Starting

Read the following before filling out this template:

1. `docs/reference/reverse-bootstrap.md`
2. `docs/reference/case-safety-policy.md`
3. `docs/reference/reverse-workflow.md`
4. If the current task has already passed `env-pass`, or the goal is "purify to pure algorithm after environment patching", continue reading `docs/reference/pure-extraction.md`

Scope and implementation boundaries:

- This template only describes methods, input contracts, verification criteria, and divergence records; it does not carry complete executable implementations
- `scripts/cases/*` in the repository may only accumulate abstract templates; complete reusable signature pipelines must not be written there
- Executable scripts, task evidence, and run logs go uniformly in `artifacts/tasks/<task-id>/`

If the model has not first confirmed these boundaries at the start, it should not directly begin writing cases or code.

## Applicable Scope
- Applicable to any "request parameter reproduction" task (signatures, tokens, timestamp-derived fields, hybrid fingerprint parameters).
- Not tied to any specific site or parameter name.

## 0. Task Definition
- Target parameter: `<param_name>`
- Target request: `<method> <url_pattern>`
- Success criteria:
  - Parameter structure validation passes (segment count/length/encoding format)
  - Single request round-trip meets expectations (HTTP status + business fields)

## 1. Input Contract (Must Be Filled First)
- `requestSpec`
  - `url` / `method` / `headers schema` / `body schema`
- `paramContract`
  - Field name, type, encoding method, whether time-dependent
- `runtimeSeedSchema`
  - Cookie key set
  - localStorage/sessionStorage key set
  - Only record format and length, not sensitive raw values
- `clockPolicy`
  - Whether to fix timestamp, offset tolerance

## 2. Standard Workflow (Fixed Order)
1. Observe
- Locate the request containing the parameter, triggering action, script source, and candidate entry functions.
2. Capture
- Minimal sampling (prefer hooks, use breakpoints when necessary), only retain field structure evidence.
3. Rebuild
- Local minimal environment patching: first read proxy env log, first record `first divergence`, then patch by minimal causal unit; bulk guessing is prohibited.
4. Verify
- Single signature verification round-trip, record status code, business code, and response summary.
5. Divergence
- Record first divergence (the first point of difference) and provide the next patch direction.

## 3. Environment Patching Strategy (Minimal Causal Unit)
- Each time, make only one patch decision, rather than mechanically changing one property name at a time.
- One patch decision may correspond to:
  - One value / one function shell / one return object / one minimal object contract
- Before patching, must first confirm:
  - Current proxy env log
  - Current `first divergence`
  - Corresponding page evidence
- `diff_env_requirements` serves only as supplementary, not as a replacement for proxy logs.
- After each patch, immediately retest and record whether `first divergence` has moved forward.
- On failure, roll back using the "last known working snapshot".

## 4. Verification Criteria
- Structure verification:
  - Parameter segment count/length/character set matches expectations.
- Behavior verification:
  - Single target request returns an acceptable result.
- Divergence verification:
  - Values may differ, but the round-trip must pass.

## 5. Output Contract (Unified)
- `paramShape`: segment count, length, encoding rules
- `requiredInputs`: minimal input fields needed for reproduction
- `envDependencies`: environment patching dependency list
- `proxyLogSummary`: current proxy log summary
- `patchDecision`: current minimal causal unit patch decision
- `verifyResult`: status code, business summary
- `firstDivergence`: first divergence and follow-up actions

## 6. Safety Boundaries
- The repository only retains abstract methods and acceptance criteria.
- Do not commit real cookie/token/storage raw values.
- Do not commit complete executable scripts that can be directly reused.
- Executable implementations go uniformly in `artifacts/tasks/<task-id>/`.
