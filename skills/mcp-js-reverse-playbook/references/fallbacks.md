# Failure Fallbacks
- Hook returns no data: confirm action was executed -> expand scope by one level -> if still failing, stop. Do not directly guess local rebuild.
- If Hook missed first-screen initialization: return to the page entry, add `inject_preload_script` first, then retry.
- Too much data: use summary to filter noise -> drill down into individual raw entries.
- Local environment patching fails: read the proxy env log first, confirm the current `first divergence`, then review page evidence; `diff_env_requirements` is only an aid.
- Local rebuild shows no progress for two consecutive rounds: return to page observation, add `record_reverse_evidence`, then continue.
- Breakpoint unstable: fall back to the Hook path.
