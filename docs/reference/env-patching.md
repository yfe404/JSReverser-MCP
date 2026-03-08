# Environment Patching Specification

This document defines the local Node environment patching workflow for this repository. The goal is not to “simulate a browser all at once”, but to make the target parameter chain work first based on MCP page evidence, then fill in gaps incrementally.

## Core Principles

- Gather evidence first, then patch the environment
- Start with a minimal host, backfill incrementally
- Proxy diagnostics first, blind patching is prohibited
- Every patch must be traceable to proxy logs, first divergence, and page evidence

## Two-Stage Goals (Now Expanded to Three Stages)

This repository separates “local environment patching” and “external language invocation” into two stages by default:

### Stage 1: Node Environment Patching for Reproduction

Goal:

- Run the target chain in Node
- Identify the minimal dependency set
- Confirm the first divergence
- Gradually remove unrelated hosts and patches

The main artifacts from this stage are:

- `env/env.js`
- `env/polyfills.js`
- `env/entry.js`

### Stage 2: Portable JS Export

Goal:

- Purify the working chain into a callable complete JS bundle
- Reduce dependency on Node-specific capabilities and debugging scaffolding
- Provide a stable function entry point for Python `execjs`, `quickjs`, or other hosts

The target artifacts from this stage are typically:

- `run/exported-runtime.js`
- Or other single-file / few-file bundles

Key principles:

- Do not start environment patching with `Python + execjs`
- You should first get the environment working in Node, then export portable JS
- `execjs` is better suited for “calling purified functions”, not for “debugging the environment patching process”

### Stage 3: Pure Algorithm Extraction

Stage protocol and entry conditions are in: `docs/reference/pure-extraction.md`

Goal:

- After the portable runtime is available, continue purifying into readable pure algorithms
- Clearly define input contracts, random/time factors, fixed constants, and version boundaries
- Provide alignable fixed fixtures for Node / Python / other hosts

The target artifacts from this stage are typically:

- `run/pure-*.js`
- Optional `run/pure_*.py`
- Task-local fixed fixtures and acceptance records

Key principles:

- Only enter pure algorithm extraction after `env rebuild` runs successfully and server-side acceptance passes
- Pure runtime must support fixed runtimeContext or equivalent controls for cross-language alignment
- Some version-bound constants may be retained, but their boundaries must be documented in the task artifact
- Pure algorithm implementations remain task-local artifacts and do not enter `scripts/cases/*` or the public repository implementation layer

## Fixed Stages

### 1. MCP Page Evidence Collection

Gather evidence from the browser side first; do not guess in Node.

Content to prioritize recording in `capture.json`:

- `page.url`
- `page.title`
- `cookies`
- `localStorage`
- `sessionStorage`
- Target request samples
- Function names hit by hooks, argument summaries, return value summaries
- Target script source code or script location information

This data must come from MCP page observation; manually fabricating sensitive values or host state is not allowed.

### 2. Local Minimal Environment Bootstrap

`env.js` is only responsible for providing basic host objects and minimal shims so the target script can begin executing.

Allowed in `env.js`:

- `window/self/global`
- `document/location/navigator`
- `history/screen/canvas`
- `localStorage/sessionStorage`
- `atob/btoa`
- Minimal `crypto` shell

Do not pile site-specific custom logic, access logs, or large speculative patches here.

### 3. Proxy Diagnostics Layer

`polyfills.js` is specifically responsible for the proxy diagnostics layer.

Recommended capabilities:

- `watch`
- `safeFunction`
- `makeFunction`
- Proxy wrappers for `window/document/navigator/storage/location`
- Unified `[env:get]` / `[env:set]` / `[env:has]` / `[env:ownKeys]` / `[env:call]` diagnostic logging

The proxy diagnostics layer's responsibilities are to tell you:

- Which object path was accessed
- Whether what's missing is a value, a function, or a return object
- Where the first divergence first appeared

The proxy diagnostics layer is not meant to directly fake an entire browser.

### 4. Incremental Backfilling by Gap

When backfilling, only patch the minimal causal unit corresponding to the current `first divergence`, rather than mechanically playing whack-a-mole item by item.

A single patch decision may cover one of four types of minimal causal units:

- Missing basic value: patch with a constant directly, e.g., `navigator.userAgent`
- Missing function shell: use `makeFunction(“createElement”)`
- Missing return object: patch with a minimal return structure, e.g., the return object of `document.createElement()`
- Missing minimal object contract: only patch the minimal inseparable interface set for the current chain on that object, e.g., `localStorage.getItem/setItem/removeItem`

“One patch at a time” here refers to “making one patch decision at a time”, not “only ever changing one property name”.
If proxy logs and `first divergence` have already proven the current gap belongs to a single minimal object contract, you can patch that entire contract together;
if you only see multiple scattered accesses without confirming they belong to the same causal unit, then only patch the one that is currently blocking execution first.

Every patch should satisfy:

- It can point to which proxy log entry, which `first divergence` record, and which page evidence it originates from
- It can explain why only this item or this minimal object contract is being patched
- Re-test immediately after patching
- If there are no proxy logs or no `first divergence` records, patching is not allowed

## Patch Decision Table

| Observed Symptom | Common Gap Type | Recommended Fix | What NOT to Do |
|---|---|---|---|
| `navigator.userAgent`, `location.href` reads return `undefined` | Missing basic value | Patch with minimal constant value | Don't patch an entire `navigator` / `location` fake implementation |
| `document.createElement is not a function` | Missing function shell | Use `makeFunction(“createElement”)` to add a function shell | Don't patch a complete DOM implementation |
| `Cannot read properties of undefined (reading 'style')` and the previous step just called `createElement()` | Missing return object structure | Add a minimal return object for that function | Don't fill in unrelated fields |
| `localStorage.getItem is not a function` | Missing host object method | Patch the storage shim's minimal method set | Don't introduce site-specific private cache values |
| Multiple interface gaps appear consecutively on the same object, all pointing to the same first divergence | Missing minimal object contract | Patch the object's minimal interface set at once | Don't expand into a complete browser object |
| `Illegal invocation` / brand check failure | Incorrect host modeling approach | Fix object shape or this binding first, then decide whether to patch values | Don't blindly wrap brand-sensitive objects with Proxy |
| `crypto.subtle` / `TextEncoder` missing | Missing platform API | Patch with minimal platform API shell or polyfill | Don't fabricate algorithm results |

## Anti-Patterns

The following practices are all blind patching and should not occur:

- Patching the complete `window/document/navigator/crypto` all at once before confirming dependencies on the page
- Seeing that a request needs a Cookie and hardcoding the real Cookie value into `env.js`
- When `createElement` is missing, directly copying an entire third-party DOM simulation library
- Stuffing a field into the current task just because another site used that same field
- Patching the host without a first divergence record, based only on “the script probably reads this”

## File Responsibility Boundaries

### `env/env.js`

Responsibilities:

- Provide the basic host
- Provide minimal storage shims
- Provide minimal encoding/crypto shells

Prohibited:

- Access logs
- Large amounts of site-specific custom branches
- Directly inlining target business scripts

### `env/polyfills.js`

Responsibilities:

- Host the proxy diagnostics layer
- Host reusable function disguise capabilities
- Host “missing function shell” and “access log” helper logic

Prohibited:

- Large amounts of hardcoded business values
- Directly replacing `env.js` as the base host

### `env/entry.js`

Responsibilities:

- Load `env.js` first
- Then load `polyfills.js`
- Read corresponding data from `capture.json`
- Load the target script
- Output first divergence and current callable state

## Recommended Diagnostic Order

1. Run `env/entry.js` once
2. Check local errors first
3. Then read proxy diagnostic logs to locate the first abnormal access
4. Record and confirm the current `first divergence`
5. Go back to page evidence to confirm the real source
6. Only patch the minimal causal unit corresponding to the current `first divergence`
7. Use `diff_env_requirements` for supplementary comparison when needed, rather than replacing proxy logs
8. Immediately re-run `env/entry.js`

## Prohibited Practices

- Do not guess the environment
- Do not simulate the entire browser all at once
- Do not patch cookie / storage / header / UA without page evidence
- Do not patch the host without proxy logs and a `first divergence` record
- Do not treat `diff_env_requirements` as the primary source of truth, skipping proxy logs to patch directly
- Do not put environment patching logic directly into the MCP core runtime

## Artifact Requirements

Each task directory should maintain at least the following reusable files:

- `env/env.js`
- `env/polyfills.js`
- `env/entry.js`
- `env/capture.json`

These four files together form the minimal local rebuild skeleton.

If the goal is to later use Python `execjs` or other hosts, it is recommended to also export:

- `run/exported-runtime.js`

If the goal is to further purify into readable pure algorithms, additionally include:

- `run/pure-*.js`
- Optional `run/pure_*.py`
- Fixed fixtures and server-side acceptance records

The goal of these files is not to continue debugging environment patching, but to expose stable function entry points and preserve alignable pure algorithm results, for example:

- `genSign(...)`
- `getToken(...)`
- `buildHeaders(...)`
- `genABogus(pathQuery, runtimeContext)`
