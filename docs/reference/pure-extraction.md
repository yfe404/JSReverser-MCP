# Pure Extraction

This document is the **execution protocol for entering the pure algorithm extraction phase after environment patching passes**.

It does not answer “how to patch the environment”, only:
- When is extraction allowed to begin
- What should be done first in the extraction phase
- How to connect hook logs, runtime values, and the final pure algorithm code

## Prerequisites

Entry to `PureExtraction` is only allowed when all of the following conditions are met:
- Target request, scripts, and key functions have been confirmed
- Local `env rebuild` stably runs the target chain
- At least one `first divergence` and its fix path have been recorded
- At least one server-side validation has passed

If any of the above conditions are not met, return to `Observe` / `Capture` / `Patch` instead of continuing extraction.

## Phase Goal

Split the current chain into three layers:
1. **Environment layer**: browser objects, page state, host noise
2. **Runtime layer**: intermediate values and assembly logic inside the current script
3. **Algorithm layer**: the pure algorithm portion that can be replayed with explicit inputs

The goal of `PureExtraction` is not to “understand all page code”, but to isolate the parts of the runtime layer that truly belong to the algorithm.

## Core Principles

- `Freeze-first`
- `Hook-local-runtime`
- `Boundary-before-rewrite`
- `Fixture-before-port`
- `Node-before-Python`
- `Evidence-first`

## Recommended Steps

### Step 1: Freeze

Pin one sample that has passed server-side validation, recording at least:
- Request input
- Time-related fields
- token / fingerprint / vk
- clt / gs / gsd / tail / final signature
- The cookie / user-agent / page state summary used in this round

Without a pinned sample, proceeding to the next step is not allowed.

### Step 2: Hook Local Runtime

Continue hooking on the locally patched runtime that has passed, rather than going back to the page.

Prioritize sampling:
- Key function inputs
- Key function outputs
- Key intermediate values
- Boolean conditions or version constants that affect branching

The goal is not to get more results, but to answer:
- Which values are algorithm inputs
- Which values are merely environment-driven runtime state

### Step 3: Define Boundary

Split the current chain into the smallest explainable units.

At minimum, clarify:
- Which fields must be explicit inputs
- Which fields can be derived from the previous step
- Which fields still belong to the environment layer and should not be included in the pure implementation
- Which branches are token family / version constants / platform differences

If this boundary layer is not clearly documented, directly rewriting pure algorithm code is not allowed.

### Step 4: Build Fixture

Solidify fixtures under the task-local `run/` directory.

Fixtures should contain at least:
- Inputs
- Intermediate values
- Final output
- Version info / constant boundaries

Fixture goals:
- Can align with runtime output
- Can verify the subsequent pure implementation
- Can serve as the source of truth for Python/other host language porting

### Step 5: Extract Node Pure

Extract the Node pure algorithm implementation first.

Requirements:
- Explicit input boundaries
- Explicit output boundaries
- No longer depends on large browser host objects
- No longer depends on full-page runtime scheduling
- Must be alignable with runtime using pinned fixtures

### Step 6: Verify Node Pure

Verify at least:
- Pure implementation is segment-by-segment consistent with the runtime fixture
- Intermediate values are consistent or explainable
- Server-side validation still passes

If inconsistencies are found, roll back to `Step 2` or `Step 3` instead of directly modifying Python.

### Step 7: Port

External language porting can only happen after Node pure is stable.

Recommended order:
- Node pure
- Python pure
- Other hosts / SDK wrappers

## Required Artifacts

At minimum, the following task-local artifacts are recommended:
- `run/exported-runtime.*`
- `run/pure-*.js`
- Optional `run/pure_*.py`
- `run/fixtures.json` or equivalent fixture file
- Pure extraction boundary description in `report.md`

## Prohibited Actions

- Writing pure Python before env rebuild passes
- Starting extraction without a pinned sample
- Guessing algorithm boundaries from large page code without local runtime hook evidence
- Directly stuffing the entire page state object into the pure implementation input
- Doing a Python port before Node pure is done

## Completion Criteria

`PureExtraction` completion means at least:
- A Node pure implementation exists
- Pinned fixtures exist
- Node pure is aligned with the runtime fixture
- The boundary between extracted and non-extracted parts has been documented
- If a Python version exists, Python is aligned with Node pure

## Relationship to Other Documents

- Overall phase protocol: `docs/reference/reverse-workflow.md`
- Environment patching specification: `docs/reference/env-patching.md`
- Artifact constraints: `docs/reference/reverse-artifacts.md`
- Upgrade troubleshooting: `docs/reference/algorithm-upgrade-template.md`
