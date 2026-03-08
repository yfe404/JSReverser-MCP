---
name: mcp-js-reverse-playbook
description: Used when performing front-end JavaScript reverse engineering with MCP. Applicable to signature chain location, page observation and evidence collection, local environment patching and reproduction, VMP-style instrumentation analysis, AST deobfuscation, and evidence-based output.
---

# MCP Front-End JS Reverse Engineering Playbook

## Core Principles

- `Observe-first`
- `Hook-preferred`
- `Breakpoint-last`
- `Rebuild-oriented`
- `Evidence-first`

Observe the page first, then do minimal sampling, then do local environment patching. Do not skip evidence collection and guess the environment directly.

## Target Scenarios

The default main scenarios are:

1. Locate API signatures, encrypted parameters, and key request fields
2. Identify which request, script, and function participate in parameter generation on the page
3. Export local reproduction materials
4. Patch the environment in Node using “proxy env log + first divergence + minimal causal unit” until it runs successfully
5. After successful execution, proceed with AST deobfuscation, VMP instrumentation, or logic extraction

## Five-Phase Workflow

### 1. Observe

Goal:

- First confirm the target request, related scripts, and candidate functions. Do not guess the environment.

Default entry points:

- `references/automation-entry.md`
- `references/mcp-task-template.md`

Required outputs:

- Target request
- Initiator clues
- Suspicious script URL / scriptId
- Initial task artifact

### 2. Capture

Goal:

- Perform minimally invasive sampling on target requests to obtain parameter samples, call sequences, and runtime evidence.

Rules:

- Prefer fetch/xhr hooks
- If the target occurs during first-screen initialization, pre-first-request parameter assembly, or initial page execution, first use `inject_preload_script` to attach early sampling or environment patching scripts
- After a hit, check the summary first, then view raw data as needed
- Only consider breakpoints when hooks are insufficient

### 3. Rebuild

Goal:

- Export page evidence as a locally iterable Node reproduction project.

References:

- `references/local-rebuild.md`
- `references/task-artifacts.md`

Rules:

- Local environment patching must be based on page observation evidence
- Speculative patching of `window/document/navigator/crypto/storage` without evidence is not allowed

### 4. Patch

Goal:

- Drive environment patching using proxy logs and `first divergence` until the local script can reliably produce the target parameters.

Rules:

- Read the proxy env log first, then record the current `first divergence`
- Make only one patch decision at a time -- this does not mean mechanically changing only one property at a time
- One patch decision corresponds to one minimal causal unit: value / function shell / return object / minimal object contract
- `diff_env_requirements` is only an aid, not a replacement for proxy logs
- Re-test immediately after each patch and record whether `first divergence` has advanced
- Write every patch into the task artifact

### 5. DeepDive

Goal:

- After local execution succeeds, proceed with deobfuscation, VMP analysis, control flow restoration, and business logic extraction.

Rules:

- If the current task only requires producing a signature, this phase can be downgraded
- If the algorithm chain needs to be reused long-term, this phase is mandatory

## Execution Requirements

- All important steps must be written into the local task artifact
- Do not call a tool if you cannot explain why it is being called
- Output must comply with `references/output-contract.md`
- On failure, fall back according to `references/fallbacks.md`
- Parameter defaults follow `references/tool-defaults.md`
- `skills/references/cases/*` only allows abstract cases (mapping / judgment criteria)
- Site-level reusable workflows are maintained in `scripts/cases/*`; do not write operational workflows back into `skills/references/cases/*`
- When adding formal documentation, follow the repository layering: rules/templates go in `docs/reference/`, human tutorials go in `docs/guides/`, and public parameter indexes are updated in `scripts/cases/README.md`

## Required References

- Automation entry: `references/automation-entry.md`
- Parameter defaults: `references/tool-defaults.md`
- Task input template: `references/task-input-template.md`
- MCP-specific task orchestration: `references/mcp-task-template.md`
- Task artifacts: `references/task-artifacts.md`
- Local reproduction: `references/local-rebuild.md`
- Environment patching: `references/env-patching.md`, `references/node-env-rebuild.md`
- Instrumentation: `references/instrumentation.md`
- AST deobfuscation: `references/ast-deobfuscation.md`
- Fallbacks: `references/fallbacks.md`
- Output contract: `references/output-contract.md`
- Case library: `references/cases/`

## Companion Templates

- Update prompt: `docs/reference/reverse-update-prompt-template.md`
- Report template: `docs/reference/reverse-report-template.md`
- Algorithm upgrade / first divergence: `docs/reference/algorithm-upgrade-template.md`
