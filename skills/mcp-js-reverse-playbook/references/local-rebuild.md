# Local Rebuild

The default goal of local reproduction is not "fully simulate the browser," but "first get the target parameter chain running."

Recommended export files:

- `env/entry.js`
- `env/env.js`
- `env/polyfills.js`
- `env/capture.json`

Execution sequence:

1. Confirm the target request, script, and function on the page
2. Export the local reproduction package
3. Run `env/entry.js`
4. Read the proxy env log first
5. Record the current `first divergence`
6. Make one patch decision based on "minimal causal unit"
7. Use `diff_env_requirements` for supplementary comparison if necessary
8. Re-run and confirm whether `first divergence` has advanced
9. Write the patch back to the task artifact

Priority patching targets:

- `window`
- `document`
- `navigator`
- `location`
- `localStorage/sessionStorage`
- `crypto`
- `fetch/XMLHttpRequest`

Do not speculatively patch the environment in bulk without page evidence, proxy env logs, or `first divergence` records.
