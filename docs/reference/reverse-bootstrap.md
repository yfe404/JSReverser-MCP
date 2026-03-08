# Reverse Bootstrap

Last updated: 2026-03-07

This document is the **model's first-read entry point**.

Its purpose is not to explain every detail, but to ensure the model follows the correct repository workflow from the start of a new session -- no skipping steps, no crossing boundaries, and no accidentally writing task-local implementations into repository cases.

## When You Must Read This First

Read this file first whenever any of the following situations apply:

- Starting a new reverse engineering task
- Continuing an existing reverse engineering task
- The user says “patch environment”, “extract pure algorithm”, “export Python”, “upgrade algorithm”, or “fix signature”
- Need to write to `scripts/cases/*`
- Need to continue building the pipeline under `artifacts/tasks/<task-id>/`

## Required Reading Order at Session Start

After reading this file, continue reading in order:

1. `docs/reference/case-safety-policy.md`
2. `docs/reference/reverse-workflow.md`
3. If the task has already passed `env-pass`, or the goal is explicitly “extract pure algorithm after environment patching”, continue reading `docs/reference/pure-extraction.md`

If the goal is “create a new case from template”, also read:

4. `docs/reference/parameter-methodology-template.md`
5. `docs/reference/parameter-site-mapping-template.md`

After completing the required reading above, if “continuing an existing task”, prioritize reading:

1. `artifacts/tasks/<task-id>/`
2. Abstract cases in `scripts/cases/*`

## First Formal Work Reply Must Include

- Which required documents have been read
- Current phase: `Observe` / `Capture` / `Rebuild` / `Patch` / `PureExtraction` / `Port`
- Output destination for this session: `scripts/cases/*` or `artifacts/tasks/<task-id>/`
- Success criteria for this round: what evidence and acceptance results are needed

Missing any of these items indicates the repository workflow has not been properly entered.

## Repository Hard Boundaries

- `scripts/cases/*` only allows abstract templates, input contracts, validation criteria, and risk boundaries
- `artifacts/tasks/<task-id>/` is where executable implementations, complete pipelines, and real task evidence go
- Real cookie/token/storage values must not be placed in the public repository layer
- Complete signature implementations that can be directly reused for a specific site must not be written into repository cases

## Phase Transition Red Lines

- Do not enter environment patching without page observation
- Do not blindly patch without proxy env logs and `first divergence`
- Do not enter `PureExtraction` until `env rebuild` runs successfully and server acceptance passes
- Do not write Python pure directly until Node pure is stable

## Shortest Execution Command

Before starting reverse engineering, read `docs/reference/reverse-bootstrap.md`, then follow its requirements to read `docs/reference/case-safety-policy.md` and `docs/reference/reverse-workflow.md`; if already in the extraction phase after `env-pass`, also read `docs/reference/pure-extraction.md`. The first formal work reply must state the documents read, current phase, output destination, and success criteria for this round.
