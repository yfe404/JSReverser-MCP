# Getting Started

This guide is for first-time users of `JSReverser-MCP`, with the goal of getting the service running in 3 minutes.

## 1. Install Dependencies and Build

```bash
npm install
npm run build
```

After building, the entry file is:

```bash
build/src/index.js
```

## 2. Simplest Way to Start

If you just want to confirm the MCP service works, you can start it directly:

```bash
npm run start
```

This approach is suitable for:

- Verifying that the MCP service can start normally
- Getting familiar with the tool list
- When you do not need to reuse a logged-in browser yet

## 3. Choose a Browser Connection Method

There are two common approaches:

- Method A: Let MCP manage the browser itself
  - Simplest, suitable for first-time use
- Method B: Take over your already-open Chrome
  - Suitable for scenarios requiring reuse of login sessions, CAPTCHAs, or bot verification

If you want to take over an open browser, see:

- `docs/guides/browser-connection.md`

## 4. Configure Your Client

Continue based on the client you are using:

- `docs/guides/client-configuration.md`

## 5. Recommended First Verification Commands

After a successful connection, start by verifying these tools:

- `list_pages`
- `list_network_requests`
- `list_scripts`

If you can see the current page, requests, and scripts normally, the basic pipeline is working.

## 6. Optional: Configure External AI Analysis

If you want to use `understand_code`, or want `deobfuscate_code` / `detect_crypto` to produce stronger AI-assisted results, pass environment variables via `env` in the MCP server configuration.

For example, in an MCP client that supports `env`, pass in:

```toml
[mcp_servers.js-reverse.env]
DEFAULT_LLM_PROVIDER = "gemini"
GEMINI_API_KEY = "your_key"
GEMINI_MODEL = "gemini-2.0-flash-exp"
```

If you are running `npm run start` or `node build/src/index.js` locally in the project directory, use a `.env` file:

```bash
DEFAULT_LLM_PROVIDER=gemini

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o

# Anthropic / Claude
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_CLI_PATH=gemini-cli
```

Usage tips:

- If you only want to run the core reverse engineering pipeline, configuration is not required
- To use `understand_code`, it is recommended to configure a provider first
- `detect_crypto` only enables AI enhancement when `useAI=true` is passed
- When `gemini` has no `GEMINI_API_KEY`, it will attempt to use the local CLI
