# Task Artifacts

Each reverse engineering task should write to a task artifact directory, for example:

`artifacts/tasks/<taskId>/`

Recommended minimum contents:

- `task.json`
- `timeline.jsonl`
- `network.jsonl`
- `scripts.jsonl`
- `runtime-evidence.jsonl`
- `cookies.json`
- `env/entry.js`
- `env/env.js`
- `env/polyfills.js`
- `env/capture.json`
- `report.md`

These artifacts are used for:

- Allowing Codex / Claude / Gemini to continue the same task
- Reviewing page observation evidence
- Aligning local environment rebuild state
- Proceeding to subsequent AST deobfuscation or VMP deep analysis
