# Automation Entry Playbook

Execute in three phases by default:

1. Page observation
2. Runtime sampling
3. Local environment rebuild

Standard entry:

1. `check_browser_health`
2. `new_page` or `select_page`
3. `analyze_target`
4. `search_in_scripts`
5. `list_network_requests` + `get_request_initiator`
6. If the target involves initial page load, pre-first-request parameter generation, or first-execution logic: run `inject_preload_script` first
7. `record_reverse_evidence`
8. `create_hook` + `inject_hook`
9. Trigger action
10. `get_hook_data(summary)`
11. After a hit: `get_hook_data(raw)` + `record_reverse_evidence`
12. `export_rebuild_bundle`
13. Local environment rebuild and reproduction

Retry limit: 2 attempts.

Only enter the breakpoint path when hooks cannot explain the key context.
If the issue is in initial page load, prioritize preload sampling instead of waiting for page scripts to finish before adding hooks.
