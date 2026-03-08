# Case Index

Public parameter / pipeline reference entries in the repository are located in `scripts/cases/`.

Only abstract cases, methodologies, and acceptance criteria are kept here -- no directly reusable complete implementation code.

## Published Pipelines

### MCP General Workflow

- Case: [scripts/cases/mcp-reverse-pure-node-workflow.mjs](mcp-reverse-pure-node-workflow.mjs)
- Category: Workflow
- Status: abstract-case
- Runtime: pure-node
- Notes: First review tool order, per-step artifacts, and next-step decisions, then map to a specific site case

### High-Density Abstract Skeleton Template

- Case: [scripts/cases/abstract-case-template.mjs](abstract-case-template.mjs)
- Category: Template
- Status: abstract-case
- Runtime: pure-node
- Notes: When adding a new site case, start from this high-density abstract skeleton and fill in key fields, hook points, breakpoint hints, and pure extraction key points


### JD `h5st` Parameter

- Case: [scripts/cases/jd-h5st-pure-node.mjs](jd-h5st-pure-node.mjs)
- Category: Parameter Signing
- Status: abstract-case
- Runtime: pure-node
- Notes: Covers the abstract flow from Node environment rebuild, portable runtime to pure extraction / Python port

### Kuaishou `falcon` Anti-Fraud Parameter

- Case: [scripts/cases/ks-hxfalcon-pure-node.mjs](ks-hxfalcon-pure-node.mjs)
- Category: Anti-Fraud Parameter
- Status: abstract-case
- Runtime: pure-node
- Notes: Anti-fraud pipeline identification and local rebuild abstract case

### Douyin `a-bogus` Parameter

- Case: [scripts/cases/douyin-a-bogus-pure-node.mjs](douyin-a-bogus-pure-node.mjs)
- Category: Parameter Signing
- Status: abstract-case
- Runtime: pure-node
- Notes: Parameter pipeline identification, tool order mapping, pure Node reproduction and pure extraction post-phase abstract case

## Field Specification

- `Case`: Path to the public abstract case file in the repository
- `Category`: Classification such as parameter signing, anti-fraud parameter, device fingerprint, workflow, etc.
- `Status`: Current consolidation status, e.g., `abstract-case`
- `Runtime`: Current primary reproduction runtime, e.g., `pure-node`
- `Notes`: One-line description of the target and scope covered by this case

## Usage Constraints

- At the start of a new session, first read: `docs/reference/reverse-bootstrap.md`
- Reading priority: read local `artifacts/tasks/<task-id>/` first, then read abstract cases here
- If adding new public parameter / pipeline entries, update this file accordingly
- Recommended order: review the general workflow case first, then the target site case
- Do not write real page/api hosts directly; use Base64-encoded text with recommended field names `entry_url_b64` or `api_host_b64`, and decode before use
- Executable scripts and real task artifacts are kept locally in `artifacts/tasks/<task-id>/` by default
- Do not commit real Cookies, Storage, or directly reusable production parameter combinations to the repository

For more tool entry points, see:

- [docs/reference/reverse-bootstrap.md](../../docs/reference/reverse-bootstrap.md)
- [docs/reference/reverse-task-index.md](../../docs/reference/reverse-task-index.md)
- [docs/reference/tool-reference.md](../../docs/reference/tool-reference.md)
- [docs/reference/case-safety-policy.md](../../docs/reference/case-safety-policy.md)
