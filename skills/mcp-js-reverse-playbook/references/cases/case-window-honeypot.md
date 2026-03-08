# Case: window Honeypot

## Goal
- Identify probe access paths the page uses for `window`/`document`/`navigator`.
- Apply minimal patches to pass detection without breaking the main business flow.

## Common Honeypot Types
- Existence probes: `if (window.chrome && window.chrome.runtime)`
- Descriptor probes: `Object.getOwnPropertyDescriptor(...)`
- Prototype chain probes: `instanceof`, `constructor.name`
- Consistency probes: `innerWidth/outerWidth/screen` cross-validation
- Behavioral probes: function `toString`, error stacks, call timing

## Process
1. Observe First
- Use hooks to record property access chains: who is reading, when, and what.
- Collect failure samples first, then decide on patch points.

2. Group and Locate
- Group by probe category: existence / descriptor / prototype chain / behavioral.
- Select only the earliest trigger point in each group as the first divergence.

3. Single-Field Patch
- Patch only one field or one descriptor at a time.
- Retest immediately after patching to confirm the scope of impact.

4. Regression Verification
- Verify detection is passed.
- Verify the target business request has not regressed (parameters and status code are normal).

## Patch Strategy
- Prefer "returning realistic distribution values"; avoid hardcoded magic constants.
- Prefer "read-only patches"; avoid rewriting business functions whenever possible.
- Only inject preload scripts when necessary to avoid timing loss.

## Failure Fallbacks
- Patch triggers a new probe: roll back the most recent patch and target an earlier trigger point instead.
- Behavioral inconsistency: check whether `toString`, `name`, or `length` descriptors are exposed.

## Output Artifacts
- `probe-paths.json`: access paths and trigger order
- `patch-log.md`: patch content, result, and rollback record for each iteration
- `verify.md`: detection results + business request results

## Security Requirements
- Do not commit real session data.
- Do not commit complete patch scripts that can be directly reused against a specific site.
