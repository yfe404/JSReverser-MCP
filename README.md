# JS Reverse MCP

An MCP server that standardizes the frontend JavaScript reverse engineering workflow.
The goal is not just page debugging, but chaining page observation, runtime sampling, local reproduction, environment patching, and evidence archiving into a reusable workflow.

## Core Methodology

This project follows these methodologies by default:

- `Observe-first`
- `Hook-preferred`
- `Breakpoint-last`
- `Rebuild-oriented`
- `Evidence-first`
- `Pure-extraction-after-pass`

This means:

1. First confirm requests, scripts, functions, and dependency sources in the browser
2. Then perform minimal Hook sampling
3. Then export for local rebuild
4. Then patch the environment item by item in Node
5. Every step is archived as a task artifact, not just left in conversation

## Archived Pipelines

The following parameter pipelines have public indexes and can serve as reusable entry points within the repository:

- JD `h5st` parameter
  - Index: [scripts/cases/README.md](scripts/cases/README.md)
  - Case: [scripts/cases/jd-h5st-pure-node.mjs](scripts/cases/jd-h5st-pure-node.mjs)

- Kuaishou `falcon` risk control parameter
  - Index: [scripts/cases/README.md](scripts/cases/README.md)
  - Case: [scripts/cases/ks-hxfalcon-pure-node.mjs](scripts/cases/ks-hxfalcon-pure-node.mjs)

- Douyin `a-bogus` parameter
  - Index: [scripts/cases/README.md](scripts/cases/README.md)
  - Case: [scripts/cases/douyin-a-bogus-pure-node.mjs](scripts/cases/douyin-a-bogus-pure-node.mjs)

Notes:

- The README homepage only displays anonymized parameter types and public entry points
- The actual `artifacts/tasks/<task-id>/` directories are treated as local private task directories by default
- Git only commits `artifacts/tasks/_TEMPLATE/` by default

## Supported Capabilities

### Page Observation and Script Location

First answer “what scripts are on the page and where is the target code.”

- `list_scripts`: List scripts loaded on the current page to establish the script scope.
- `get_script_source`: View the source code of a specified script, suitable for reading specific implementations.
- `find_in_script`: Locate strings, variable names, or characteristic snippets within a single script.
- `search_in_scripts`: Batch search across collected script cache, suitable for narrowing down candidate scripts.

### Hook and Runtime Sampling

Perform minimal-intrusion observation first to confirm what is actually called at runtime.

- `create_hook`: Create a reusable hook definition for later injection into the page.
- `inject_hook`: Inject an existing hook into the current page to start sampling target behavior.
- `get_hook_data`: Read the call records and summary results collected by hooks.
- `hook_function`: Directly hook global functions or object methods, recording arguments and return values.
- `trace_function`: Trace calls by source function name, suitable for following call chains.

### Breakpoint and Debug Control

When hooks are not enough, enter pause-based debugging.

- `set_breakpoint`: Set a breakpoint by script URL and line number.
- `set_breakpoint_on_text`: Automatically locate and set a breakpoint by code text.
- `resume`: Continue execution to the next breakpoint or end of execution.
- `pause`: Manually pause JavaScript execution on the current page.
- `step_over` / `step_into` / `step_out`: Single-step execution control, corresponding to skipping over, entering, and exiting functions.

### Request Pipeline and Network Analysis

Locate the target request and confirm who initiated it and what parameters were sent.

- `list_network_requests`: List network requests on the current page to find the target request.
- `get_network_request`: View the detailed content of a single request, including headers, response, and payload.
- `get_request_initiator`: Trace back who triggered a specific request to help locate the call chain.
- `break_on_xhr`: Break when the target request is sent, suitable for capturing the state before parameter generation.

### Page State and Pre-run Checks

Review page runtime state, console output, and local state dependencies.

- `check_browser_health`: Check browser connection and whether the current page is controllable, suitable as an initial verification step.
- `list_console_messages`: View console output of the current page, suitable for reviewing hook and trace logs.
- `get_storage`: Read cookies, `localStorage`, `sessionStorage` to confirm state dependencies.
- `evaluate_script`: Execute a function within the currently selected frame for small-scope runtime verification.
- `search_in_sources`: Search for keywords across all loaded source code to quickly narrow down suspicious code.

### WebSocket Observation and Message Grouping

When dealing with persistent connections, live streams, or binary frames, use these tools to categorize first and then examine details.

- `list_websocket_connections`: List WebSocket connections on the current page to get the target `wsid`.
- `analyze_websocket_messages`: Group messages by frame characteristics, suitable for identifying different message types first.
- `get_websocket_messages`: View message summaries and content for a specific connection or group.

### Local Reproduction and Environment Patching

Bring page evidence back locally and progressively patch the Node runtime environment.

- `export_rebuild_bundle`: Export the entry point, environment patches, and evidence materials needed for local reproduction.
- `diff_env_requirements`: Compare currently missing environment capabilities based on errors and observed capabilities.
- `record_reverse_evidence`: Write key observations into task artifacts to avoid evidence being left only in conversation.

### Page Automation

Perform minimal necessary page operations to reproduce trigger conditions and assist with evidence collection.

- `navigate_page`: Navigate, go back, or refresh the current page.
- `query_dom`: Query page elements to confirm selectors and node states.
- `click_element`: Trigger a click by selector to reproduce page actions.
- `type_text`: Write text into input fields to drive form interactions.
- `take_screenshot`: Capture the current page state to preserve visual evidence.

### Deep Analysis

After obtaining code and runtime evidence, continue with structural understanding and deobfuscation.

- `collect_code`: Collect page code, with support for controlling sampling volume by priority or scope.
- `understand_code`: Combine static analysis and AI for code structure, business logic, and risk understanding.
- `deobfuscate_code`: Clean up, restore, and assist in analyzing obfuscated code.
- `risk_panel`: Aggregate code analysis, encryption detection, and hook signals to output a comprehensive risk view.

### Session and Login State Reuse

- `save_session_state`: Save the current page's cookies and storage state to an in-memory snapshot.
- `restore_session_state`: Restore a snapshot to the current page, reusing login state and context.
- `dump_session_state`: Export the session snapshot as a JSON file for persistence.
- `load_session_state`: Reload a session snapshot from an existing JSON file or string.

For complete parameter documentation, see [docs/reference/tool-reference.md](docs/reference/tool-reference.md).
To select tools by reverse engineering workflow, see [docs/reference/reverse-workflow.md](docs/reference/reverse-workflow.md).


### How to Configure External AI

This project supports integrating external LLMs as an “analysis enhancement layer.” Currently supported:

- `openai`
- `anthropic`
- `gemini`

The configuration entry point is essentially process environment variables.
When launching via an MCP client, pass them preferably through the `env` field in the MCP server configuration; `.env` is only suitable when you directly run `node build/src/index.js` or `npm run start` locally.

Recommended configuration example:

```toml
[mcp_servers.js-reverse]
command = "node"
args = ["/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js"]

[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "anthropic"
ANTHROPIC_API_KEY = "your_key"
ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
```

If you are launching directly from the project directory locally, you can also use `.env`:

```bash
# Choose one: openai / anthropic / gemini
DEFAULT_LLM_PROVIDER=gemini

# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=

# Anthropic / Claude
ANTHROPIC_API_KEY=your_key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_BASE_URL=

# Gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.0-flash-exp

# If not using API, you can also use the local CLI
GEMINI_CLI_PATH=gemini-cli
```

Notes:

- `DEFAULT_LLM_PROVIDER` determines which provider is used by default
- `gemini` supports two modes: uses the API when `GEMINI_API_KEY` is set; otherwise attempts to use `GEMINI_CLI_PATH`
- `openai` and `anthropic` require their corresponding API keys
- If you configure multiple providers, the one actually used is still determined by `DEFAULT_LLM_PROVIDER`

### Which Features Depend on External AI

Features that strongly depend on external AI:

- `understand_code`
  - Internally calls LLM for code semantic understanding, business logic extraction, and security risk supplementation

Features with optional external AI:

- `detect_crypto`
  - Only calls LLM additionally when `useAI=true` is passed; otherwise relies primarily on local rules and AST analysis
- `analyze_target`
  - When `useAI=true` is passed, enables deeper AI-assisted analysis in the all-in-one analysis
- `risk_panel`
  - Has a `useAI` parameter, but the current implementation primarily relies on local analysis result aggregation

Features that work better with AI but can run without it:

- `deobfuscate_code`
  - Local rules, AST optimization, and dedicated deobfuscation pipelines are always available; with external AI configured, complex semantic cleanup, VM structure understanding, and some encoding-type obfuscation degradation analysis will be more comprehensive

Features that do not depend on external AI at all:

- Browser takeover
- Hook / Breakpoint / Console / Storage / Network / WebSocket
- `collect_code`
- `export_rebuild_bundle`
- `diff_env_requirements`
- `record_reverse_evidence`

If external AI is not configured, the typical impact is:

- `understand_code` will directly report that the provider is not configured
- `detect_crypto(useAI=true)` will fall back to local analysis or skip AI enhancement
- `deobfuscate_code` can still run, but the quality of explanation and cleanup for some highly obfuscated code will decrease

## Standard Task Structure

Task directories use a unified structure:

- `artifacts/tasks/_TEMPLATE/`
- `artifacts/tasks/<task-id>/`

Recommended directory structure:

- `task.json`
- `runtime-evidence.jsonl`
- `network.jsonl`
- `scripts.jsonl`
- `env/env.js`
- `env/polyfills.js`
- `env/entry.js`
- `env/capture.json`
- `run/`
- `report.md`

Responsibility boundaries:

- `env.js`
  - Basic host objects and minimal shims
- `polyfills.js`
  - Proxy diagnostic layer, `watch`, `safeFunction`, `makeFunction`
- `entry.js`
  - Run entry point, target script loading, first divergence output

## Standard Execution Flow

Recommended flow:

1. Page observation
2. Runtime sampling
3. Evidence archiving
4. Local rebuild
5. Incremental environment patching
6. First divergence location
7. After `env-pass`, proceed to pure algorithm / risk control logic extraction

Default principles:

- Do not skip page evidence and guess the environment directly
- Do not simulate the entire browser all at once
- Do not commit real task directories directly to Git

## Parameter Archiving and Security Boundaries

Parameter pipeline archiving follows these rules:

1. First read local task artifacts
- `artifacts/tasks/<task-id>/`

2. If not available locally, read abstract cases
- `scripts/cases/*`

3. If still insufficient, create new ones from templates
- `docs/reference/parameter-methodology-template.md`
- `docs/reference/parameter-site-mapping-template.md`

Security boundaries:

- Cases only retain abstract methods and processes
- Real task directories are kept locally by default
- Sensitive values must be anonymized before sharing
- Git only commits `_TEMPLATE` by default

See also:

- [docs/reference/case-safety-policy.md](docs/reference/case-safety-policy.md)
- [docs/reference/reverse-artifacts.md](docs/reference/reverse-artifacts.md)
- [docs/reference/env-patching.md](docs/reference/env-patching.md)

## 3-Minute Quick Start

### 1) Install Dependencies and Build

```bash
npm install
npm run build
```

Build entry point:

```bash
build/src/index.js
```

### 2) Simplest Way to Start

```bash
npm run start
```

### 3) Configure the Client

Minimal configuration examples:

#### Claude Code

```bash
claude mcp add js-reverse node /ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js
```

#### Cursor

- Command: `node`
- Args: `[/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js]`

#### Codex

```toml
[mcp_servers.js-reverse]
command = "node"
args = ["/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js"]
```

If you need to take over an already open browser, see:

- [docs/guides/browser-connection.md](docs/guides/browser-connection.md)
- [docs/guides/client-configuration.md](docs/guides/client-configuration.md)

Complete copy-paste-ready MCP configuration examples, including:

- `mcpServers` JSON structure example
- Codex `config.toml` example
- `--browserUrl` browser takeover example
- Gemini / Claude / OpenAI API `env` examples

All available in [docs/guides/client-configuration.md](docs/guides/client-configuration.md).

## Documentation Entry Points

For reverse engineering tasks, start by reading: `docs/reference/reverse-bootstrap.md`. That entry point will further direct the model to read `docs/reference/case-safety-policy.md` and `docs/reference/reverse-workflow.md`; if already in the post-`env-pass` extraction phase, also read `docs/reference/pure-extraction.md`.

### Guides

- Getting Started: [docs/guides/getting-started.md](docs/guides/getting-started.md)
- Browser Connection: [docs/guides/browser-connection.md](docs/guides/browser-connection.md)
- Client Configuration: [docs/guides/client-configuration.md](docs/guides/client-configuration.md)
- Reverse Engineering Workflow: [docs/reference/reverse-workflow.md](docs/reference/reverse-workflow.md)
- Environment Patching Guide: [docs/reference/env-patching.md](docs/reference/env-patching.md)

### Reference

- Model Bootstrap Entry: [docs/reference/reverse-bootstrap.md](docs/reference/reverse-bootstrap.md)
- Reverse Task Index: [docs/reference/reverse-task-index.md](docs/reference/reverse-task-index.md)
- Tool Parameter Reference: [docs/reference/tool-reference.md](docs/reference/tool-reference.md)
- Tool I/O Contract: [docs/reference/tool-io-contract.md](docs/reference/tool-io-contract.md)
- Task Artifact Documentation: [docs/reference/reverse-artifacts.md](docs/reference/reverse-artifacts.md)

### Templates And Supporting Docs

- [docs/reference/reverse-update-prompt-template.md](docs/reference/reverse-update-prompt-template.md)
- [docs/reference/reverse-report-template.md](docs/reference/reverse-report-template.md)
- [docs/reference/algorithm-upgrade-template.md](docs/reference/algorithm-upgrade-template.md)
- [docs/reference/parameter-methodology-template.md](docs/reference/parameter-methodology-template.md)
- [docs/reference/parameter-site-mapping-template.md](docs/reference/parameter-site-mapping-template.md)

## Development and Testing

```bash
npm run build
npm run test:unit
npm run test:property
npm run coverage:full
```

## Troubleshooting

For more troubleshooting, see:

- [docs/guides/browser-connection.md](docs/guides/browser-connection.md)

## Referenced Projects

This project referenced the following projects during design and implementation. Specific license declarations (e.g., MIT) are subject to their respective upstream repositories:

- https://github.com/wuji66dde/jshook-skill
- https://github.com/zhizhuodemao/js-reverse-mcp

## License

Apache-2.0
