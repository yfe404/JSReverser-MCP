# Reverse Report Template

This template is used to document the results of a single reverse engineering task. The focus is not on writing lengthy text, but on enabling others to reproduce, continue, and review the work.

## Required Reading Before Starting

Before writing a report, first confirm the current task complies with:

- `docs/reference/reverse-bootstrap.md`
- `docs/reference/case-safety-policy.md`
- `docs/reference/reverse-workflow.md`
- If already in the pure extraction phase, also refer to `docs/reference/pure-extraction.md`

## 1. Task Overview

- Task name:
- Target page:
- Target API endpoint and fields:
- Target action:
- Current phase: `Observe` / `Capture` / `Rebuild` / `Patch` / `PureExtraction` / `Port`
- Task artifact:

## 2. Confirmed Conclusions

- Which request participates in parameter generation
- Which script / function is most critical
- Which cookies / storage / headers participate in the pipeline
- Which fields are required, and which are derived values

## 3. Runtime Evidence

- Hook record summary
- Request -> initiator -> script / function associations
- Input/output samples
- Matched time windows / page actions
- Proxy env log summary
- Current `first divergence` record

## 4. Local Reproduction Status

- `env rebuild` current entry point
- Environment objects already patched
- Objects not yet patched
- Local execution errors
- Minimal causal unit corresponding to the current patch decision
- Most recent `diff_env_requirements` result (auxiliary only)

## 5. `first divergence` / Difference Analysis

- Compared to the old version or old conclusions, where is the earliest fork point
- Whether the fork occurs at the request, function output, crypto, env collect, or final assembly
- Proxy log evidence that triggered this fork point
- Why the current minimal causal unit was determined
- Confirmed differences
- Unconfirmed differences

## 6. Risks and Uncertainties

- Confidence level
- Whether it depends on login state
- Whether it depends on remote delivery
- Whether random paths / time-sensitive paths exist

## 7. Patches and Rollback Steps

- Which environments were patched this time
- Which proxy log and page evidence each patch corresponds to
- Which patches are temporary
- If rolling back, which patches to revert first

## 8. Verification

- Verification commands
- Key output
- Whether `first divergence` moved forward after this round of patches
- Whether server acceptance passed
- Which tests are still not covered

## 9. Next Steps

- Recommended next steps
- If the version changes again, where to look first
