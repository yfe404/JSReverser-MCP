# run/

Put executable local scripts here.
Do not move these scripts into repository case files.

## Directory Constraints

- There must be a current main entry point, clearly documented here
- It is recommended to separate mainline, verification, forensics, evidence, and archived files
- Do not allow multiple equivalent top-level entry points to coexist long-term
- Do not treat `.venv/`, `__pycache__/`, or temporary caches as task artifacts

## Recommended Structure

- `core/`: Current mainline runtime / portable runtime / pure runtime
- `verify/`: API closed-loop verification
- `trace/`: Reverse engineering forensics, hooks, instrumentation, extraction aids
- `server/`: Minimal entry point for deployment or live invocation
- `evidence/`: Baselines, fixtures, summaries, difference records
- `legacy/`: Archived old entry points
- `vendor/`: Copies of original scripts

## Main Entry Point Requirements

Please document directly here:

- Current recommended entry file
- The 1 to 3 most commonly used commands
- Which directories have been archived and no longer accept new logic
