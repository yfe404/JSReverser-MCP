# Reverse Task Index

Quickly locate MCP tools by reverse engineering objective, reducing the trial-and-error cost of “which tool should I use”.

## Step 0: Required Reading at Session Start (Mandatory)

For any new session, any new case, or any “continue previous reverse engineering” first step, read these first:

1. `docs/reference/reverse-bootstrap.md`
2. `docs/reference/case-safety-policy.md`
3. `docs/reference/reverse-workflow.md`
4. If the task has already passed `env-pass`, or the goal is explicitly “extract pure algorithm after environment patching”, continue reading `docs/reference/pure-extraction.md`

The first formal work reply at session start must state:

- The above documents have been read
- Current phase (Observe / Capture / Rebuild / Patch / PureExtraction / Port)
- Where this session's output will be written: `scripts/cases/*` abstract layer, or `artifacts/tasks/<task-id>/` executable layer

Repository-level safety boundaries:

- `scripts/cases/*` only allows abstract templates and method indexes
- Executable implementations, complete signature pipelines, and real task evidence all go into `artifacts/tasks/<task-id>/`

If the first reply does not explicitly confirm these constraints, it is considered that the correct workflow has not been entered.

Default workflow:

1. Page observation
2. Runtime sampling
3. Task artifact recording
4. Local rebuild
5. Local environment patching (proxy logs take priority)
6. Enter pure algorithm extraction only after `env-pass`

Reading priority (mandatory):

1. First read `artifacts/tasks/<task-id>/` (if it exists)
2. Then read abstract cases in `scripts/cases/*`
3. Finally create a new workflow from templates:
   - `docs/reference/parameter-methodology-template.md`
   - `docs/reference/parameter-site-mapping-template.md`

## 1) Quickly Identify What Scripts the Page Loaded

- `list_scripts`
- `get_script_source`
- `search_in_scripts`

Common scenarios: First examine main site scripts, dynamically loaded scripts, and the size and naming of webpack chunks.

## 2) Locate Key Logic in Minified/Obfuscated Code

- `find_in_script`
- `set_breakpoint_on_text`
- `understand_code`
- `deobfuscate_code`

Common keywords: `sign`, `token`, `nonce`, `encrypt`, `hmac`.

## 3) Trace How Request Parameters Are Generated

- `create_hook`
- `inject_hook`
- `get_hook_data`
- `break_on_xhr`
- `get_request_initiator`

Recommended to first hook `fetch/xhr/websocket`, then trigger the business action before capturing records.

Synchronous recording:

- `record_reverse_evidence`

## 4) One-Click Target Site Analysis (Recommended Entry Point)

- `analyze_target`

Key outputs:

- `requestFingerprints`
- `priorityTargets`
- `signatureChain`
- `actionPlan`

Suitable for first contact with a target site, quickly obtaining actionable next steps.

## 5) Export Local Environment Patching Project

- `export_rebuild_bundle`
- `diff_env_requirements`

Suitable for exporting `env/entry.js`, `env/env.js`, `env/polyfills.js`, `env/capture.json` for local rebuild after confirming the request pipeline in the page.

Fixed order:

1. First run `env/entry.js`
2. First read task-local proxy env logs
3. Record the current `first divergence`
4. Then decide on patches based on “minimal causal unit”
5. Only use `diff_env_requirements` for auxiliary comparison when necessary

For environment patching principles, also refer to: `docs/reference/env-patching.md`

## 6) Evaluate Risks and Cryptographic Implementations

- `detect_crypto`
- `risk_panel`
- `understand_code`

Used to identify weak algorithms, suspicious signature implementations, and security risk points.

## 7) Page Interaction Automation (Combined with Sampling)

- `navigate_page`
- `query_dom`
- `click_element`
- `type_text`
- `wait_for_element`
- `take_screenshot`

Suitable for collecting data after automatically triggering key actions such as login, order placement, and form submission.

## 8) Export Analysis Results

- `export_session_report`
- `collection_diff`
- `record_reverse_evidence`

Used to persist session evidence, compare differences between two sampling runs, and write key conclusions into the task artifact.

## 9) Session State Reuse (Recommended for Sites Requiring Login)

- `save_session_state`
- `restore_session_state`
- `list_session_states`
- `dump_session_state`
- `load_session_state`
- `check_browser_health`

Suitable for target sites that “require login to access”, reducing the cost of repeated QR code scanning/CAPTCHA.

## 10) Typical Minimal Pipeline

1. `new_page`
2. First read `docs/reference/reverse-bootstrap.md`, then follow its requirements to read `docs/reference/case-safety-policy.md` and `docs/reference/reverse-workflow.md`
3. `analyze_target`
4. Set target boundaries: `targetKeywords`, `targetUrlPatterns`, `targetFunctionNames`, `targetActionDescription`
5. `search_in_scripts`
6. `create_hook` + `inject_hook`
7. Trigger page action
8. `get_hook_data`
9. `record_reverse_evidence`
10. `export_rebuild_bundle`
11. Run `env/entry.js` and read proxy env logs
12. Record `first divergence`
13. `diff_env_requirements` (auxiliary only)
14. `risk_panel`
15. Proceed to pure algorithm extraction only after `env-pass`

## 11) Complete Parameter Reference

For full parameter and field descriptions, see: `docs/reference/tool-reference.md`

## 12) Parameter Reproduction Template Reuse (Recommended)

When encountering a “reproducible parameter” task, use templates first rather than writing ad-hoc scripts:

1. First read `docs/reference/reverse-bootstrap.md`
2. Then fill in the site-independent template: `docs/reference/parameter-methodology-template.md`
3. Then fill in the site mapping template: `docs/reference/parameter-site-mapping-template.md`
4. Execute Observe / Capture / Rebuild / Patch / Verify following the template; the environment patching phase defaults to “proxy logs + `first divergence` + minimal causal unit”
5. Executable code and complete pipelines are placed together in `artifacts/tasks/<task-id>/`

Safety constraints: `docs/reference/case-safety-policy.md`
