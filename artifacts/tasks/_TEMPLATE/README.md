# Task Template Contract

This template is not meant to make all tasks look identical, but to prevent task directories from gradually devolving into a mixed state of mainline, experiments, legacy compatibility, dependencies, and evidence all tangled together.

## Goals

Each task directory should answer at least 4 questions:

1. What is the current mainline entry point?
2. Which files are experimental artifacts?
3. Which files have been archived and should not have new logic added?
4. Which dependencies are required at runtime, and which are only local development aids?

## Recommended Layering

- `task.json`
  - Task metadata, objectives, success criteria
- `network.jsonl` / `scripts.jsonl` / `runtime-evidence.jsonl`
  - Page and runtime evidence
- `env/`
  - Environment rebuild entry and minimal host
- `run/`
  - Current executable mainline, verification, pure algorithm implementation, fixtures, trace
- `replay/`
  - Page action replay
- `report.md`
  - Results, first differences, upgrade boundaries

## Recommendations for Further Subdividing run/

If files in `run/` start to grow significantly, prioritize splitting by responsibility into the following subdirectories:

- `core/`
  - Current mainline runtime, portable runtime, pure runtime
- `verify/`
  - Verification scripts for API closed-loop testing
- `trace/`
  - Reverse engineering forensics and instrumentation scripts before and after extraction
- `server/`
  - Minimal entry point for deployment or direct invocation
- `evidence/`
  - Summaries, fixtures, and baselines produced by trace/verify
- `legacy/`
  - Archived old entry points, kept only for retrospective value, no new logic added
- `vendor/`
  - Copies of original page scripts or pinned external scripts

Not every task needs all these directories; only split when file count and responsibilities start to become tangled.

## Hard Constraints

- Every task must have a “current main entry point”, documented in `run/README.md`
- Every task must distinguish between “mainline files” and “archived files”
- `legacy/` is for archiving only, no new logic accepted
- Do not keep multiple equivalent top-level entry points in the executable mainline
- Pure algorithm implementations and portable runtimes must be separated from trace/experimental scripts
- Runtime-required dependencies must not be mixed with `.venv/`, caches, `__pycache__/`, or other local environment artifacts

## Lessons Learned from Complex Tasks

If a task has progressed to the point where:
- Local rebuild has passed
- Portable runtime is callable
- Pure algorithm extraction has begun
- Python port or other host migration already exists

Then the most common point of loss of control is usually not the algorithm itself, but rather:
- Too many top-level entry points accumulating
- Old verify / trace / tool scripts mixed in alongside the mainline
- Baselines, fixtures, evidence, and tool outputs lacking proper layering
- Local virtual environments and caches placed inside the task directory

Therefore, the template should primarily constrain “file responsibilities and archiving boundaries” rather than just providing a minimal demo.
