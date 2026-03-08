# Parameter Site Mapping Template (Site-Specific Supplement Layer)

Updated: 2026-03-05

## Mandatory Constraints Before Starting

Read the following before filling out site mappings:

1. `docs/reference/reverse-bootstrap.md`
2. `docs/reference/case-safety-policy.md`
3. `docs/reference/reverse-workflow.md`
4. If the current task has already passed `env-pass`, or the goal is "purify to pure algorithm after environment patching", continue reading `docs/reference/pure-extraction.md`

Boundaries remain consistent:

- This section only supplements site mappings and determination criteria; it does not include complete executable implementations
- Repository cases only retain abstract mappings; task-local directories hold runnable code

## Objective
- On top of the "site-agnostic methodology template", supplement site-specific mappings.
- Only record mapping relationships and determination criteria, not executable details.

## 1. Site Information
- Site: `<site_name>`
- Parameter name: `<param_name>`
- Common entry: `<entry_function_or_class>`
- Related scripts: `<script_url_pattern>`
- Entry page / host: `<entry_url_b64 | api_host_b64>`

## 2. Request Mapping
- Target endpoint pattern:
  - `method`: `<GET/POST/...>`
  - `urlPattern`: `<domain/path pattern>`
  - `functionId/operation`: `<optional>`
- Parameter location:
  - `query` / `body` / `header`

## 3. Field Mapping
- Parameter-related fields:
  - Required: `<field_a>`, `<field_b>`, ...
  - Optional: `<field_x>`, `<field_y>`, ...
- Dependency seed types:
  - Cookie keys: `<k1,k2,...>`
  - Storage keys: `<k1,k2,...>`
  - Fingerprint capabilities: `<canvas/webgl/...>`

## 4. Site-Specific Risk Points
- Initialization timing (first screen / async script / lazy loading):
  - `<note>`
- High change points (version fields, dynamic algorithms, server-issued tokens):
  - `<note>`
- Common false positives:
  - `<note>`

## 5. Verification Criteria (Site Version)
- Structure criteria:
  - `<segment_count / charset / length>`
- Behavior criteria:
  - `<status + business code>`
- Divergence tolerance:
  - `<which part can differ but still pass>`

## 6. Regression Checklist
- After script version changes, does the output contract still hold?
- Have `requiredInputs` been added or removed?
- Has the first anomalous path in the proxy env log changed?
- Has first divergence changed or moved forward?

## 7. Related Documentation
- Methodology template: `docs/reference/parameter-methodology-template.md`
- Safety policy: `docs/reference/case-safety-policy.md`
- Tool I/O contract: `docs/reference/tool-io-contract.md`
