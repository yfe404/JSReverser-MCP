# Browser Connection Guide

This guide addresses two questions:

- How to have MCP directly take over your already-open Chrome
- How to determine whether it has actually connected to the browser

## Why Connect Directly to the Browser

If you have already logged in manually, passed a CAPTCHA, or completed complex interactions, taking over the current Chrome is more practical than opening a fresh instance.

Common benefits:

- Reuse login sessions
- Reuse Cookies / Storage
- Preserve page state after manual operations

## Step 1: Launch Chrome with Remote Debugging

### Windows

```bash
"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\tmp\\chrome-mcp"
```

### macOS

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-mcp
```

### Linux

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-mcp
```

## Step 2: Verify Remote Debugging is Enabled

Visit in the browser:

```bash
http://127.0.0.1:9222/json/version
```

If you can see `webSocketDebuggerUrl`, remote debugging is enabled and working.

## Step 3: Choose a Connection Method

### Method A: `--browserUrl`

Best for beginners.

```bash
--browserUrl http://127.0.0.1:9222
```

Features:

- Simple configuration
- No need to parse the websocket address yourself

### Method B: `--wsEndpoint`

More precise, suitable when you already know which browser instance to connect to.

First, get the websocket address:

```bash
curl http://127.0.0.1:9222/json/version
```

Then read the `webSocketDebuggerUrl` value.

### Method C: `--autoConnect`

If your machine typically uses a common port like `9222`, you can let the server auto-detect.

```bash
--autoConnect
```

## Step 4: How to Verify MCP Has Actually Taken Over the Browser

Recommended verification sequence:

1. Manually open a target page
2. Start MCP
3. Call `list_pages`
4. Check whether the page you just opened appears in the response
5. Then call `list_network_requests` or `list_scripts`

If you can see the requests and scripts from your current page, the takeover was successful.

## Common Mistakes

- Being able to start MCP does not mean it has taken over the browser
- If `browserUrl` is configured but Chrome does not have remote debugging enabled, the connection will not succeed
- Do not configure `--browserUrl` and `--wsEndpoint` at the same time
- When already connected to a remote Chrome, do not force MCP to launch a new browser
