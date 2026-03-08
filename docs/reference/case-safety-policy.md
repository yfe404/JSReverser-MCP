# Case Safety Policy

Updated: 2026-03-07

Status: **Currently active policy**, not a historical archive document.

For model entry point, read first: `docs/reference/reverse-bootstrap.md`

## Objective
- Ensure that `scripts/cases/*` in the repository only retains abstract methods, and does not store complete reverse-engineering/signature implementations that can be directly reused.
- Reduce legal and compliance risks of direct misuse.
- Completely separate the "public repository layer" from the "task-local executable layer".

## Repository Documentation Layers

- `docs/reference/`: Rules, contracts, templates, indexes
- `docs/guides/`: Operational guides for human users
- `scripts/cases/README.md`: Public parameters / pipeline indexes
- `artifacts/tasks/<task-id>/`: Local private task artifacts, not used as public repository documentation entry points

When adding new formal documents, do not place them directly in the `docs/` root directory.

## Mandatory Rules
1. Case files in the repository must be "non-executable abstract templates".
2. Cases in the repository may only contain:
- Input contracts (field names, types, formats)
- Reproduction workflows (Observe/Capture/Rebuild/Verify)
- Verification criteria (status codes, structure, divergence determination)
- Risk boundaries (data sanitization, items prohibited from committing)
3. Cases in the repository must not contain:
- Complete executable signature pipeline code
- Real cookie/token/storage raw values
- Fixed reusable production parameter combinations
- One-click scripts that can directly call production endpoints

## Local Execution Conventions
- Executable code and complete pipeline artifacts are placed uniformly in task directories (split by parameter/task):
  - `artifacts/tasks/<task-id>/`
- Recommended directory structure:
  - `task.json` (objectives and boundaries)
  - `runtime-evidence.jsonl` (key evidence)
  - `env/` (environment patching scripts)
  - `run/` (executable scripts and run logs)
  - `report.md` (results and `first divergence`)
- Git commit rules:
  - Only `artifacts/tasks/_TEMPLATE/` is allowed to be committed by default
  - Real `artifacts/tasks/<task-id>/` directories are treated as local private task directories by default and should not be committed directly
  - If a task directory truly needs to be shared, a sanitization review must be completed first, then explicitly `git add -f`

## Reuse Priority
1. Prefer reading from `artifacts/tasks/<task-id>/` (complete pipeline).
2. If no corresponding task exists, read the abstract case from `scripts/cases/*`.
3. If there is still no reference, create a new task following the methodology template and accumulate artifacts in `artifacts/tasks/`.
4. If you want to publicly display "which parameters / pipelines have been accumulated", update `scripts/cases/README.md` uniformly; do not use real task directories as a public index.

## Relationship with Model Entry Point
- At the start of a new model session, first read `docs/reference/reverse-bootstrap.md`
- `reverse-bootstrap` will force the model to continue reading this policy and the phase protocol
- `reverse-task-index`, `reverse-update-prompt-template`, and parameter templates should all treat this policy as a mandatory prerequisite, not an optional reference

## Review Checklist
- Is the case directly executable within the repository?
- Do any real sensitive values appear?
- Does it provide a complete algorithm implementation that can be directly reused?
- Does it only retain abstract workflows and acceptance criteria?
- Has a real `task-id` directory been mistakenly committed to Git?

If any item is not satisfied, it is considered non-compliant and must be reverted to an abstract template before merging.
