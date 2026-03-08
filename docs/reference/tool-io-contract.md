# Complete Tool Read/Write Contract Table

Last updated: 2026-03-05

## Unified Data Plane (Single Source of Truth)

1. Hook collected data: `window.__hookStore[hookId]` (unique key on the page side)
2. Hook installation metadata: `window.__mcp_hooks__` (used only for list/unhook, does not store collected data)
3. Event monitoring metadata: `window.__mcp_monitors__` (monitor/stop management)
4. Server-side hook summary: `runtime.hookManager` (synced from `__hookStore` by `get_hook_data`)
5. Collection cache: `runtime.collector` + `UnifiedCacheManager` (code/summary/statistics cache)
6. Task artifacts: `artifacts/tasks/<taskId>/...` (evidence, env, reports, bundles)

## Contract Rules

- Each data category can only have one page-side primary key (e.g., hook data can only be written to `__hookStore`).
- Tool read paths must align with write paths; writing to A and reading from B is prohibited.
- Aggregation tools (`get_hook_data`/`risk_panel`/`export_session_report`) must use `hookManager.getAllKnownHookIds()` as the authoritative source.

## Tool Read/Write Contract (Complete)

| Tool | Read Sources | Write Sources | Canonical Store |
|---|---|---|---|
| `analyze_target` | `runtime.collector` + `runtime.hookManager` + code text | Analysis results; some tools write to task artifacts | HookManager / Artifacts |
| `deobfuscate_code` | `runtime.collector` + `runtime.hookManager` + code text | Analysis results; some tools write to task artifacts | HookManager / Artifacts |
| `detect_crypto` | `runtime.collector` + `runtime.hookManager` + code text | Analysis results; some tools write to task artifacts | HookManager / Artifacts |
| `export_session_report` | `hookManager.getAllKnownHookIds()` + `getRecords()` | Response report | HookManager |
| `record_reverse_evidence` | Request parameters + current context | Task artifact files | `artifacts/tasks/*` |
| `risk_panel` | `hookManager.getAllKnownHookIds()` + `getRecords()` | Response report | HookManager |
| `summarize_code` | `runtime.collector` + `runtime.hookManager` + code text | Analysis results; some tools write to task artifacts | HookManager / Artifacts |
| `understand_code` | `runtime.collector` + `runtime.hookManager` + code text | Analysis results; some tools write to task artifacts | HookManager / Artifacts |
| `collect_code` | `runtime.collector` + page scripts/network | `runtime.collector` cache | Collector Cache / UnifiedCache |
| `collection_diff` | `runtime.collector` + page scripts/network | `runtime.collector` cache | Collector Cache / UnifiedCache |
| `search_in_scripts` | `runtime.collector` + page scripts/network | `runtime.collector` cache | Collector Cache / UnifiedCache |
| `get_console_message` | Console cache | Response attach only | CDP Console |
| `list_console_messages` | Console cache | Response attach only | CDP Console |
| `break_on_xhr` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `evaluate_on_callframe` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `find_in_script` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `get_paused_info` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `get_request_initiator` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `get_script_source` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `get_storage` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `hook_function` | Target function call context | `__mcp_hooks__` + `__hookStore[hookId]` | `__hookStore`(sole data plane) |
| `inspect_object` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `list_breakpoints` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `list_hooks` | `__mcp_hooks__` | - | `__mcp_hooks__` |
| `list_scripts` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `monitor_events` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `pause` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `remove_breakpoint` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `remove_xhr_breakpoint` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `resume` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `search_in_sources` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `set_breakpoint` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `set_breakpoint_on_text` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `step_into` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `step_out` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `step_over` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `stop_monitor` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `trace_function` | DebuggerContext + Page Runtime | Breakpoint/XHR rules/page injection state | `__hookStore` / `__mcp_hooks__` / `__mcp_monitors__` |
| `unhook_function` | `__mcp_hooks__` | Restores original function and deletes `__mcp_hooks__[hookId]` | `__mcp_hooks__` |
| `find_clickable_elements` | DOM Runtime | Response only | - |
| `get_dom_structure` | DOM Runtime | Response only | - |
| `query_dom` | DOM Runtime | Response only | - |
| `list_frames` | Frame list | Selected frame | Runtime selectedFrame |
| `select_frame` | Frame list | Selected frame | Runtime selectedFrame |
| `create_hook` | `window.__hookStore` + `runtime.hookManager` | `runtime.hookManager`(after sync) | `__hookStore` / HookManager |
| `get_hook_data` | `__hookStore` -> `hookManager` | `hookManager` synced data | `__hookStore` / HookManager |
| `inject_hook` | `window.__hookStore` + `runtime.hookManager` | `runtime.hookManager`(after sync) | `__hookStore` / HookManager |
| `remove_hook` | `window.__hookStore` + `runtime.hookManager` | `runtime.hookManager`(after sync) | `__hookStore` / HookManager |
| `get_network_request` | Network panel cache | Response attach only | CDP Network |
| `list_network_requests` | Network panel cache | Response attach only | CDP Network |
| `check_browser_health` | PageController + browser session state | SessionState snapshot/restore | In-memory SessionState |
| `click_element` | PageController + browser session state | SessionState snapshot/restore | In-memory SessionState |
| `delete_session_state` | SessionState manager | SessionState manager | In-memory SessionState |
| `dump_session_state` | SessionState manager | SessionState manager | In-memory SessionState |
| `get_performance_metrics` | PageController + browser session state | SessionState snapshot/restore | In-memory SessionState |
| `list_session_states` | SessionState manager | SessionState manager | In-memory SessionState |
| `load_session_state` | SessionState manager | SessionState manager | In-memory SessionState |
| `restore_session_state` | SessionState manager | SessionState manager | In-memory SessionState |
| `save_session_state` | SessionState manager | SessionState manager | In-memory SessionState |
| `type_text` | PageController + browser session state | SessionState snapshot/restore | In-memory SessionState |
| `wait_for_element` | PageController + browser session state | SessionState snapshot/restore | In-memory SessionState |
| `list_pages` | BrowserManager pages | Current page selection/navigation | BrowserManager currentPage |
| `navigate_page` | BrowserManager pages | Current page selection/navigation | BrowserManager currentPage |
| `new_page` | BrowserManager pages | Current page selection/navigation | BrowserManager currentPage |
| `select_page` | BrowserManager pages | Current page selection/navigation | BrowserManager currentPage |
| `diff_env_requirements` | Runtime failure info + page capabilities + evidence input (assists env patching, does not replace proxy logs) | rebuild bundle/task artifacts | Artifacts |
| `export_rebuild_bundle` | Request parameters + current context | Task artifact files | `artifacts/tasks/*` |
| `take_screenshot` | Page/element rendering | Screenshot file or response attachment | filesystem(optional) |
| `evaluate_script` | Current frame runtime | Page injected script | PreloadScript Registry |
| `inject_preload_script` | Current frame runtime | Page injected script | PreloadScript Registry |
| `inject_stealth` | Stealth configuration | Page stealth injection / UA | Stealth Runtime |
| `list_stealth_features` | Stealth configuration | Page stealth injection / UA | Stealth Runtime |
| `list_stealth_presets` | Stealth configuration | Page stealth injection / UA | Stealth Runtime |
| `set_user_agent` | Stealth configuration | Page stealth injection / UA | Stealth Runtime |
| `analyze_websocket_messages` | WebSocket frame cache | Response attach only | CDP WebSocket |
| `get_websocket_message` | WebSocket frame cache | Response attach only | CDP WebSocket |
| `get_websocket_messages` | WebSocket frame cache | Response attach only | CDP WebSocket |
| `list_websocket_connections` | WebSocket frame cache | Response attach only | CDP WebSocket |
