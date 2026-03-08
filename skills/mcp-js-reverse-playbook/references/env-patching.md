# Environment Patching Guidelines
- Read the proxy env log first, then confirm `first divergence`, and finally decide on the patch.
- Make only one patch decision at a time; that decision should correspond to one minimal causal unit.
- A minimal causal unit can be: a value / function shell / return object / minimal object contract.
- `diff_env_requirements` is only an aid, not a replacement for proxy logs.
- Every patch must be reversible, re-testable, and traceable to page evidence.
- Common items: `navigator`, `webdriver`, `crypto`, `atob/btoa`, `TextEncoder`.
- Avoid one-shot global browser simulation.
- When there are no proxy logs or no `first divergence` records, direct host patching is not allowed.
