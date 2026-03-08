# Reverse Workflow

This document is a **model execution protocol**, not a human tutorial.

Goal: Unify front-end reverse engineering tasks into stable phases, preventing step-skipping, proceeding from memory, or prematurely extracting pure algorithms before environment patching has converged.

## Scope

Applicable to the following tasks:
- Request signature, encrypted parameter, and risk-control parameter localization
- Page runtime sampling
- Local Node environment patching and reproduction
- Pure algorithm extraction after environment patching passes
- Porting to Python or other host languages after extraction

## Core Principles

- `Observe-first`
- `Hook-preferred`
- `Breakpoint-last`
- `Rebuild-oriented`
- `Evidence-first`
- `Pure-extraction-after-pass`

## Phase Overview

1. `Observe`
2. `Capture`
3. `Rebuild`
4. `Patch`
5. `PureExtraction`
6. `Port`

Every task should clearly identify its current phase; without a phase conclusion, you should not move directly to the next phase.

---

## 1. Observe

### Goal
- Confirm the target request, key scripts, candidate functions, and trigger actions
- Establish task boundaries to avoid blindly guessing the environment or directly patching the host

### Required Actions
- Confirm target request URL / parameters / response characteristics
- Locate the initiator, candidate script URL, candidate function names, or key strings
- Record page actions, trigger conditions, and the target `targetContext`
- Write key observations into the task artifact

### Prohibited Actions
- Starting environment patching before confirming the target request
- Manually reading obfuscated code before locating key scripts

### Completion Criteria
- Can answer: who initiated the target request, which script is involved, and how to trigger it on the page

---

## 2. Capture

### Goal
- Obtain runtime samples, parameters, call sequences, and intermediate values with minimal intrusion

### Required Actions
- Prefer using `hook` or preload hook
- Sample fetch/xhr, candidate functions, and key object fields
- Try to capture input/output before and after calls, not just the final result
- Continuously write samples into the task artifact

### Prohibited Actions
- Immediately switching to breakpoints when hooks are insufficient
- Capturing a full object snapshot all at once, causing excessive noise

### Completion Criteria
- At least one reusable real runtime sample exists
- The minimal call sequence of the parameter chain is known

---

## 3. Rebuild

### Goal
- Export page evidence into a locally runnable Node reproduction project

### Required Actions
- Export the local rebuild bundle
- Pin the entry point, target scripts, initial state, and necessary seeds
- Run the target chain on `env/entry.js` or an equivalent entry point
- Record the current failure point or the first runnable result

### Prohibited Actions
- Hand-writing `window/document/navigator` without page evidence
- Starting environment patching directly with Python `execjs`

### Completion Criteria
- A stable local reproduction entry point exists
- The current runtime error or current phase output is visible

---

## 4. Patch

### Goal
- Drive environment patching based on proxy logs and `first divergence` until the local chain is runnable and server-side validation passes

### Required Actions
- Read the proxy env log first
- Record the `first divergence` first
- Only patch the minimal causal unit corresponding to the current `first divergence`
- Re-test immediately after each patch round
- Record whether the `first divergence` has shifted forward
- Obtain at least one server-side validation pass

### Prohibited Actions
- Patching the host without proxy logs
- Patching multiple objects without a `first divergence` record
- Mistaking successful environment patching for completed pure algorithm extraction

### Completion Criteria
- The local env rebuild stably runs the target chain
- At least one server-side validation has passed
- At least one `first divergence` and its fix path have been recorded

### Next Phase Input
- Stable samples
- The validated local rebuild
- Key intermediate values and call boundary evidence

---

## 5. PureExtraction

`PureExtraction` is not an extension of environment patching, but an independent phase.

See detailed protocol at: `docs/reference/pure-extraction.md`

### Entry Conditions
- `Patch` is complete
- Stable samples, fixture candidates, and server-side validation records exist

### Goal
- Separate “environment noise” from “algorithm input”
- First extract a readable Node pure algorithm implementation
- Produce stable fixtures

### Prohibited Actions
- Starting Python porting before env rebuild passes
- Directly copying page objects without distinguishing input boundaries

### Completion Criteria
- Node pure implementation is aligned with the runtime fixture
- It is clear which values are algorithm inputs and which are environment state

---

## 6. Port

### Goal
- Port the extracted Node pure algorithm implementation to Python or other host languages

### Required Actions
- Use the same fixtures as Node pure
- Align inputs, key intermediate values, and final outputs segment by segment
- Preserve external language call boundary documentation

### Prohibited Actions
- Skipping Node pure by using the page runtime as the source of truth
- Rewriting to Python without fixtures

### Completion Criteria
- The external language version is aligned with Node pure
- At least one server-side validation has passed

---

## Phase Transition Rules

- Entry to `PureExtraction` is only allowed after `env rebuild` runs successfully and server-side validation passes
- Entry to `Port` is only recommended after Node pure is stable
- If any phase shows inconsistency, prioritize rolling back to the earliest divergent phase rather than continuing forward

## Required Artifacts

At minimum, the following should be produced:
- Target request and script evidence
- `targetContext` in the task artifact
- Local rebuild entry point
- Proxy env log
- `first divergence` records
- Runtime samples
- Pure fixture
- Pure implementation
- Server-side validation records

## Related Documentation

- `docs/reference/env-patching.md`
- `docs/reference/pure-extraction.md`
- `docs/reference/reverse-artifacts.md`
- `docs/reference/reverse-update-prompt-template.md`
- `docs/reference/reverse-report-template.md`
- `docs/reference/algorithm-upgrade-template.md`
