# Client Configuration Guide

This guide provides copy-ready MCP configuration examples for each client.

Conventions:

- Paths are written as `/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js`
- If you want to reuse an already-open browser, the default remote debugging address is `http://127.0.0.1:9222`
- External AI configuration is passed via the MCP server's `env`

## Most Common Full Template

If you just want to get up and running quickly, we recommend using this “take over an open browser + Gemini API” template:

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ],
      "env": {
        "DEFAULT_LLM_PROVIDER": "gemini",
        "GEMINI_API_KEY": "your_key",
        "GEMINI_MODEL": "gemini-2.0-flash-exp"
      }
    }
  }
}
```

Suitable scenarios:

- Need to reuse a locally logged-in browser
- Want AI-enhanced features like `understand_code` to work out of the box
- Using a client that supports the `mcpServers` JSON configuration format

If you are using Codex `config.toml`, see the “Codex” section below for the full template.

## Complete Ready-to-Use Examples

### For Clients Using the `mcpServers` JSON Structure

These clients typically use the following JSON structure to configure the MCP server.
If your Claude / Gemini / Cursor client uses the `mcpServers` configuration format, you can directly use the templates below.

#### Minimal Configuration

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js"
      ]
    }
  }
}
```

#### Take Over an Open Browser

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ]
    }
  }
}
```

#### Using the Gemini API

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ],
      "env": {
        "DEFAULT_LLM_PROVIDER": "gemini",
        "GEMINI_API_KEY": "your_key",
        "GEMINI_MODEL": "gemini-2.0-flash-exp"
      }
    }
  }
}
```

#### Using the Claude API

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ],
      "env": {
        "DEFAULT_LLM_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "your_key",
        "ANTHROPIC_MODEL": "claude-3-5-sonnet-20241022"
      }
    }
  }
}
```

#### Using the OpenAI API

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ],
      "env": {
        "DEFAULT_LLM_PROVIDER": "openai",
        "OPENAI_API_KEY": "your_key",
        "OPENAI_MODEL": "gpt-4o"
      }
    }
  }
}
```

#### Using the Gemini CLI

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ],
      "env": {
        "DEFAULT_LLM_PROVIDER": "gemini",
        "GEMINI_CLI_PATH": "gemini-cli"
      }
    }
  }
}
```

## Claude Code

### Simplest Configuration

```bash
claude mcp add js-reverse node /ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js
```

### Recommended Configuration Approach

If you are using a Claude client that supports `mcpServers` JSON configuration, prefer using the JSON templates above directly.
If you are using the `claude mcp add` command-line approach, first add the server, then add `env` in the corresponding client configuration.

### AI Configuration Examples

Claude API：

```toml
[mcp_servers.js-reverse]
command = "node"
args = ["/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js"]

[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "anthropic"
ANTHROPIC_API_KEY = "your_key"
ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
```

Gemini API：

```toml
[mcp_servers.js-reverse]
command = "node"
args = ["/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js"]

[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "gemini"
GEMINI_API_KEY = "your_key"
GEMINI_MODEL = "gemini-2.0-flash-exp"
```

OpenAI API：

```toml
[mcp_servers.js-reverse]
command = "node"
args = ["/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js"]

[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "openai"
OPENAI_API_KEY = "your_key"
OPENAI_MODEL = "gpt-4o"
```

### Take Over an Open Chrome

```bash
claude mcp add js-reverse node /ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js -- --browserUrl http://127.0.0.1:9222
```

If you always have a remote debugging port open locally, you can also use:

```bash
claude mcp add js-reverse node /ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js -- --autoConnect
```

## Cursor

`Settings -> MCP -> New MCP Server`

### Simplest Configuration

- Command: `node`
- Args: `[/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js]`

### Full JSON Example

If your version of Cursor supports JSON-based MCP configuration, you can use this directly:

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ],
      "env": {
        "DEFAULT_LLM_PROVIDER": "gemini",
        "GEMINI_API_KEY": "your_key",
        "GEMINI_MODEL": "gemini-2.0-flash-exp"
      }
    }
  }
}
```

### Take Over an Open Chrome

- Command: `node`
- Args:

```json
[
  "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
  "--browserUrl",
  "http://127.0.0.1:9222"
]
```

### Configure External AI Environment Variables

If the client interface supports configuring environment variables for the MCP server, pass in these keys:

- `DEFAULT_LLM_PROVIDER`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`
- `OPENAI_MODEL` / `ANTHROPIC_MODEL` / `GEMINI_MODEL`
- `GEMINI_CLI_PATH`

Recommended approach:

- Claude: set `DEFAULT_LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`
- Gemini: set `DEFAULT_LLM_PROVIDER=gemini` and `GEMINI_API_KEY`
- OpenAI: set `DEFAULT_LLM_PROVIDER=openai` and `OPENAI_API_KEY`

Full examples:

- Claude API

```json
{
  "DEFAULT_LLM_PROVIDER": "anthropic",
  "ANTHROPIC_API_KEY": "your_key",
  "ANTHROPIC_MODEL": "claude-3-5-sonnet-20241022"
}
```

- Gemini API

```json
{
  "DEFAULT_LLM_PROVIDER": "gemini",
  "GEMINI_API_KEY": "your_key",
  "GEMINI_MODEL": "gemini-2.0-flash-exp"
}
```

- OpenAI API

```json
{
  "DEFAULT_LLM_PROVIDER": "openai",
  "OPENAI_API_KEY": "your_key",
  "OPENAI_MODEL": "gpt-4o"
}
```

## Codex

Codex uses `config.toml`.

### Simplest Configuration

```toml
[mcp_servers.js-reverse]
command = "node"
args = ["/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js"]
```

### Take Over an Open Chrome

```toml
[mcp_servers.js-reverse]
command = "node"
args = [
  "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
  "--browserUrl",
  "http://127.0.0.1:9222"
]
```

### Auto-Connect to Local Browser

```toml
[mcp_servers.js-reverse]
command = "node"
args = [
  "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
  "--autoConnect"
]
```

### Configure External AI Environment Variables

Gemini API:

```toml
[mcp_servers.js-reverse]
command = "node"
args = ["/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js"]

[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "gemini"
GEMINI_API_KEY = "your_key"
GEMINI_MODEL = "gemini-2.0-flash-exp"
```

Claude API:

```toml
[mcp_servers.js-reverse]
command = "node"
args = [
  "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
  "--browserUrl",
  "http://127.0.0.1:9222"
]

[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "anthropic"
ANTHROPIC_API_KEY = "your_key"
ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
```

OpenAI API:

```toml
[mcp_servers.js-reverse]
command = "node"
args = [
  "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
  "--browserUrl",
  "http://127.0.0.1:9222"
]

[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "openai"
OPENAI_API_KEY = "your_key"
OPENAI_MODEL = "gpt-4o"
```

Gemini CLI:

```toml
[mcp_servers.js-reverse]
command = "node"
args = [
  "/ABSOLUTE/PATH/JSReverser-MCP/build/src/index.js",
  "--browserUrl",
  "http://127.0.0.1:9222"
]

[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "gemini"
GEMINI_CLI_PATH = "gemini-cli"
```

If you just want to switch from one provider to another, you typically only need to replace:

- `DEFAULT_LLM_PROVIDER = "anthropic"` and set `ANTHROPIC_API_KEY`
- `DEFAULT_LLM_PROVIDER = "openai"` and set `OPENAI_API_KEY`
- `DEFAULT_LLM_PROVIDER = "gemini"` and set `GEMINI_API_KEY` or `GEMINI_CLI_PATH`

## Post-Configuration Verification

Regardless of which client you use, it is recommended to perform a minimal verification:

1. Open a known page
2. Call `list_pages`
3. Call `list_scripts`
4. Call `list_network_requests`

If all three return information corresponding to your current page, the configuration is essentially correct.

If you also configured an external AI, you can add one more verification step:

5. Call `understand_code` to analyze a small piece of code

If you get a provider-not-configured error, it usually means the MCP server's `env` was not passed in, rather than the tool itself having a problem.
