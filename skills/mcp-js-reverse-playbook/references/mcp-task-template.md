# JS Reverse MCP Task Template

Execute in fixed phases:

1. Page Observation
   - `check_browser_health`
   - `new_page` + optional `restore_session_state`
   - `analyze_target`
   - `search_in_scripts`
   - `list_network_requests` / `get_request_initiator`
   - Set target boundaries: `targetKeywords`, `targetUrlPatterns`, `targetFunctionNames`, `targetActionDescription`

2. Runtime Sampling
   - If the target is generated during initial page load or before the first request: use `inject_preload_script` first
   - `create_hook(fetch/xhr)` + `inject_hook`
   - Trigger the action
   - `get_hook_data(summary)`
   - On hit: `get_hook_data(raw)` + `record_reverse_evidence`

3. Local Environment Rebuild
   - `export_rebuild_bundle`
   - Run `env/entry.js` locally
   - Read proxy env log first
   - Record the current `first divergence`
   - Make one patch decision based on "minimal causal unit"
   - Use `diff_env_requirements` for supplementary comparison if needed
   - Re-run and confirm whether `first divergence` has moved forward

4. Deep Analysis
   - `deobfuscate_code`
   - Instrumentation / VMP analysis if needed

Core Requirements:

- Page observation before local environment rebuild
- Local environment rebuild before deep deobfuscation
- Environment rebuild defaults to "proxy log + `first divergence` + minimal causal unit"
- Write a task artifact at every step
- When parameter names are unclear, prioritize using requests, functions, time windows, and action descriptions to identify the target
