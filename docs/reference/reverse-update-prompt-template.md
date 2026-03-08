# Reverse Update Prompt Template

This template is for the scenario of “continuing to update an existing reverse engineering task”.

Applicable situations:

- Target site scripts have been upgraded
- Signature parameter behavior has changed
- Local `env rebuild` already has a foundation, but new evidence needs to be added
- Need Codex / Claude / Gemini to continue working on the same task chain

## Mandatory Opening Actions (Do First, Cannot Skip)

Before starting any analysis, environment patching, pure extraction, case writing, or script writing, read the following in order:

1. `docs/reference/reverse-bootstrap.md`
2. `docs/reference/case-safety-policy.md`
3. `docs/reference/reverse-workflow.md`
4. If the current task has already entered the pure algorithm phase after `env-pass`, or the goal is “extract pure algorithm after environment patching”, continue reading `docs/reference/pure-extraction.md`

The first formal work reply must explicitly state:

- The above rule documents have been read
- Current phase (Observe / Capture / Rebuild / Patch / PureExtraction / Port)
- Whether this session's output is “repository abstract template” or “task-local executable implementation”

Mandatory boundaries:

- `scripts/cases/*` can only contain abstract templates, input contracts, validation criteria, and risk boundaries
- Executable implementations, complete pipelines, and real task evidence all go in `artifacts/tasks/<task-id>/`
- If the user requests “persist a runnable version”, interpret this by default as writing to `artifacts/tasks/<task-id>/run/`, not into repository cases

If these constraints are not confirmed at the beginning, the correct workflow has not been entered.

## Template

You are continuing work in an existing JavaScript reverse engineering repository. The goal is not to guess from scratch, but to update the local reproduction pipeline and analysis conclusions based on current repository conclusions, MCP browser forensics, and task artifacts.

Before starting, read and comply with:

- `docs/reference/reverse-bootstrap.md`
- `docs/reference/case-safety-policy.md`
- `docs/reference/reverse-workflow.md`
- If currently in the extraction phase after `env-pass`, also read `docs/reference/pure-extraction.md`

And explicitly state in the first formal work reply:

- The above required documents have been read
- Current phase
- Whether this session's output will be written to the repository abstract layer or the task-local executable layer

### Task Objectives

1. Prioritize confirming the target request, scripts, functions, and cookie / storage / header dependencies in the page.
2. Write key evidence into the task artifact; do not leave it only in the conversation.
3. Use `export_rebuild_bundle` to export or update the local `env rebuild` project.
4. Run `env/entry.js` locally, prioritize reading proxy env logs, and first record `first divergence`.
5. Patch the environment by “minimal causal unit”: make only one patch decision at a time, corresponding to a single value, function shell, return object, or minimal object contract.
6. `diff_env_requirements` is only an auxiliary comparison; do not use it to replace proxy logs.
7. If there is a version upgrade or behavior inconsistency, locate the earliest fork point using the `first divergence` principle.
8. If the task goal has entered pure algorithm extraction, it must be advanced on the basis of `env-pass`; do not skip environment patching acceptance and directly write a “pure algorithm guess version”.

### Target Boundaries

- Target URL / page:
- Target API endpoint or URL pattern:
- `targetKeywords`:
- `targetUrlPatterns`:
- `targetFunctionNames`:
- `targetActionDescription`:
- Success criteria:

### Mandatory Rules

1. First Observe, then Capture, then Rebuild; do not skip page evidence and guess directly.
2. Do not guess cookies, storage, UA, headers, or timestamp sources; get what is missing from MCP first.
3. When there are many page requests, only sample around the current target; do not record the entire page noise.
4. If parameter names are unusual, do not rely on parameter name guessing; prioritize locking down using request, function, initiator, time window, and action correlation.
5. If results are inconsistent, you must state at which layer the first divergence appeared.
6. Without proxy logs or without a `first divergence` record, direct host patching is not allowed.
7. Patches must be traceable to proxy logs, page evidence, and the current fork point; re-run immediately after patching.
8. Repository cases can only retain abstract templates; complete executable implementations must not be written into `scripts/cases/*`.
9. If adding runnable scripts, place them uniformly in `artifacts/tasks/<task-id>/run/`, and keep only abstract indexes and method descriptions at the repository level.

### Suggested Output

1. Modified conclusions
2. New or updated evidence
3. Current proxy logs and `first divergence`
4. Current state of local `env rebuild`
5. Verified commands and results
6. Remaining blockers and next steps

## Shortest Version Call

First read `docs/reference/reverse-bootstrap.md`, then follow its requirements to read `docs/reference/case-safety-policy.md` and `docs/reference/reverse-workflow.md`; if the current task has entered the pure algorithm phase after `env-pass`, also read `docs/reference/pure-extraction.md`. Then continue analyzing the target pipeline based on existing repository conclusions, first using MCP page observation to gather evidence, then updating the task artifact and local `env rebuild`. When patching the environment, first read proxy env logs, first record `first divergence`, then advance with “minimal causal unit” patches; `diff_env_requirements` is auxiliary only and should not replace proxy logs. Do not guess the environment; if results are inconsistent, provide the earliest fork point, current proxy log conclusions, confirmed parts, unconfirmed parts, and next patching approach. Repository cases retain only abstract templates; executable implementations go uniformly in `artifacts/tasks/<task-id>/`.
