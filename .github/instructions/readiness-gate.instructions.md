---
applyTo: "**"
---

# Readiness Gate

## Overview

`readiness-gate` is the Definition-of-Ready checkpoint for the AWM product
layer. It takes a `product-brief` document (see
`references/brief-contract.md` for the full contract), evaluates its actual
content against a fixed nine-criterion checklist (G1–G9), and writes a
verdict back into the document's own frontmatter. It does not write, fix, or
negotiate content — it certifies or it doesn't.

This skill is invoked in two situations: (1) at the end of a brief-producing
mode, to seal the artifact before handoff; (2) at the crossing point into
`development-process`, where it always re-runs regardless of what the stored
`readiness` field already says.

## Phase 1 — Load & Lint

1. Read the target document and parse its YAML frontmatter.
2. Validate the frontmatter against `references/brief-contract.md`:
   - Discriminator `awm: product-brief` must be present.
   - `schema` must be an integer. Any schema **at or below** the version
     this gate knows (currently `1`) is valid. A schema **higher** than the
     gate knows is a **forward-compatibility failure, not a lint failure**:
     do not treat the document as invalid, do not guess at unknown fields —
     stop and tell the user this document was written by a newer contract
     version than this gate understands, and ask them to update the AWM
     registry rather than proceeding on a possibly-incomplete read.
   - `mode` must be exactly one of `discovery | brief | assessment |
     extraction` (the contract's enum) — any other value, including a
     plausible-looking typo, is malformed, not a fifth mode to guess at.
   - `title`, `readiness`, `created`, `updated`, `open_decisions`, `project`
     must be present and well-formed per the contract.
3. **If the document has no valid frontmatter** — this covers every failure
   above except the forward-compatibility case: missing discriminator,
   malformed YAML, not a `product-brief` at all, `mode` outside the enum, or
   any other field present but not well-formed. All of these are **the same
   outcome**: this is **not an error of the gate**. Return control to the
   invoker with the message "not a brief — offer adoption". Do not proceed
   to Phase 2. Do not attempt to guess intent from body content, and do not
   attempt to coerce a malformed field (e.g. an unrecognized `mode`) into
   the closest-looking valid value.

## Phase 2 — Checklist G1–G9

Evaluate every criterion below against the brief's body content. Each
criterion is independent — a pass on one never substitutes for another.

| # | Criterion | Verifies |
|---|-----------|----------|
| G1 | Problem defined | N# entry names who bears the pain and the cost of leaving it unresolved |
| G2 | Users identified | Users & Context section names who uses/suffers this, and in what context |
| G3 | Scope bounded | Out of scope section is explicit and non-empty |
| G4 | Business cases enumerated | Business Cases section carries a catalog of cases, exceptions, and rules — not just the happy path |
| G5 | Constraints declared | Constraints section covers technical, cost, privacy, and untouchable-infrastructure limits |
| G6 | Risks known | risk/impact/mitigation table is present |
| G7 | Requirements traceable | every RF/RNF carries a stable ID and testable wording |
| G8 | Open decisions managed | every DA-# has a `blocks` value; no DA blocks the first release |
| G9 | Non-assumption intact | the not-verified list is present; nothing is asserted without a source |

For each criterion, locate the concrete evidence in the document (or its
concrete absence) — do not accept a criterion on the strength of a section
existing if its content doesn't actually satisfy the verification question.

## Phase 3 — Verdict

Produce a per-criterion verdict, ✓ or ✗, each backed by evidence — when ✗,
cite the specific gap (e.g. "G8 fails: DA-2 has no `blocks` value" or "G3
fails: Out of scope section is empty").

- **All nine ✓** → write `readiness: ready` and update `updated:` to the
  current date in the document's frontmatter. Nothing else in the document
  changes.
- **Any ✗** → write `readiness: draft` (or leave it as `draft` if already
  so) and update `updated:`. Emit the actionable list of gaps, one per
  failing criterion, with its evidence.

**There is no override. A draft brief does not cross into development; the path is closing the gaps, not forcing the gate.**

## Cross-Cutting Rules

- The gate evaluates **content**, never the stored seal (R7). A brief that
  already says `readiness: ready` is re-evaluated from scratch every time
  this skill runs — the existing seal is never trusted as a shortcut.
- At the crossing point into `development-process`, the gate **always**
  re-runs, even when the seal already reads `ready` (R7.2). If the fresh
  verdict diverges from the stored seal (e.g. seal says `ready` but a
  criterion now fails, or the reverse), the crossing is **blocked** and the
  discrepancy is shown explicitly — which criterion changed status and why.
- The gate does not edit brief content. Its writes are limited to exactly
  two frontmatter fields: `readiness` and `updated`. Body sections
  (Business need, Requirements, Open decisions, etc.) are never touched by
  this skill — closing a gap is the producing mode's job, not the gate's.

## Termination

`readiness-gate` returns the verdict (per-criterion ✓/✗ table plus overall
`ready`/`draft`) and the updated brief document back to the orchestrator that
invoked it. It never invokes another skill itself — routing on the verdict
(e.g. looping back to a producer mode to close gaps, or proceeding with a
handoff) is the calling orchestrator's decision, not this skill's.
