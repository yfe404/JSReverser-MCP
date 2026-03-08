# Instrumentation Strategy (Including VMP)
- Hook-first, Breakpoint-last.
- VMP first-round minimal sampling: opcode, ip/pc, stack top summary, key register summary, output summary.
- Full state sampling is prohibited in the first round.
