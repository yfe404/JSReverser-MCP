# Automation Task Input Template
- Target URL
- Target API keywords / `targetUrlPatterns`
- Target fields / `targetKeywords`
- Target functions / `targetFunctionNames`
- Trigger action / `targetActionDescription`
- Whether it involves initial page load / pre-first-request logic
- Login requirements
- Success criteria
- Target time window
- Timeout and retry strategy
- Whether environment rebuild / breakpoints are allowed

## Structured Input (Recommended)
- It is recommended to use JSON Schema to constrain input structure:
  - `references/schemas/reverse-task-input.schema.json`
- Minimal sanitized example:
  - `references/schemas/reverse-task-input.example.json`
- Key points:
  - Required fields: `target/request/runtime/verify`
  - Only sanitized seeds are allowed (`keys-only` or `masked-values`)
  - Real cookie/token/secrets must not be committed
