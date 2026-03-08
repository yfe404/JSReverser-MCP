# Case Template: Signature Algorithm Node Environment Rebuild (Site-Agnostic)

## Purpose
- This template is for reproducing "any site's signature parameters"; it is not bound to `h5st` or any specific domain.
- It defines only the process and input contract, without providing a complete ready-to-run implementation.

## Two-Layer Capability Model
- Generic Capability Layer (this file)
  - Goal: Abstract the fixed flow of "Observe -> Capture -> Rebuild -> Verify".
- Site Capability Layer (separate case)
  - Goal: Supplement site-specific field mappings, risk points, and verification criteria.

## Input Contract (Minimal)
- `target.script_url`: Target signature script URL
- `target.sign_entry`: Entry function or class name (e.g., `sign`, `ParamsSignMain`)
- `target.request_spec`: Verification request template (URL, query/body, headers)
- `runtime.seed`: Session seed (cookie/localStorage/sessionStorage), can be empty
- `runtime.clock`: Fixed timestamp strategy (optional)

## Standard Process
1. Observe
- Identify signature fields, entry call points, and request trigger timing.
2. Capture
- Collect minimal seed: retain only fields required for signing; full sensitive export is strictly prohibited.
3. Rebuild
- Use Node `vm` to provide minimal browser capabilities: `window/document/navigator/storage/canvas`.
- Use proxy env log to locate gaps first, then constrain patch boundaries using `first divergence`.
- Do not expose `process` or other Node-specific features to the `vm`.
4. Verify
- Send a verification request immediately after generating the signature (closed loop); the server response is the final criterion.
5. Harden
- Record the first divergence (first point of difference) and iterate using "minimal causal unit patches"; `diff_env_requirements` is used only as a supplement.

## Output Contract
- `signature_parts_count`
- `signature_key_part_len` (e.g., fingerprint segment length)
- `verify_status`
- `verify_body_preview`
- `first_divergence_note`

## Security Red Lines
- Do not commit real cookies, tokens, or raw storage content.
- Do not commit complete scripts with fixed parameter combinations that can be directly reused.
- Documentation should contain only field names, processes, thresholds, and decision criteria.
