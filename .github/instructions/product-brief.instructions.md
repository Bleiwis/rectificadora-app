---
applyTo: "**"
---

# Product Brief

## Overview

`product-brief` builds requirements-and-process briefs (the WHAT) that explicitly delegate technical design (the HOW) to an implementing agent that does have access to the code. This is the AWM adoption of the `brief-spec` methodology: the founding principle is that **the brief is written without access to the real system, and therefore must not assume anything that hasn't been verified.**

Briefs written from a conversation alone fail in a predictable way: they assume entity structures, names, integrations, and conventions that "sound reasonable" but don't exist that way in the code. The implementer builds on those assumptions and the result contradicts the real system. This methodology neutralizes that failure by turning every potential assumption into (a) a discovery task, (b) an open decision, or (c) a reference explicitly marked as conceptual.

This skill produces a single portable `.md` file conforming to the brief contract (`skills/readiness-gate/references/brief-contract.md`) — the same frontmatter and body structure shared by every product-layer artifact (`product-discovery`, `architecture-assessment`, `architecture-extraction`, and re-ingestion).

## Phase 1 — Collect Before Writing

Before drafting, make sure the conversation actually covers:

- The business need.
- The business cases: the catalog of cases, exceptions, and rules this brief must cover — not
  just the happy path. Press until exhausted ("what else? which edge case would embarrass us
  in production?") the same way `product-discovery`'s Phase 3 does; this catalog is what
  `readiness-gate`'s G4 checks for, and a brief drafted without it fails that criterion.
- The current process end-to-end, **as the owner describes it** — never as you imagine it.
- Hard constraints: cost, subscriptions, privacy/NDA, existing infrastructure that cannot be touched.
- Design agreements already closed in the conversation.

**If a prior product-layer artifact is in context** (a `product-discovery` partial summary,
or a `mode: assessment`/`mode: extraction` report from `architecture-assessment`/
`architecture-extraction`), read it before asking anything above — it answers some of these
points already:
- A `product-discovery` summary's business-case catalog (its Phase 3) becomes this brief's
  Business Cases section directly; its problem/JTBD findings seed Business Need.
- An `architecture-assessment`/`architecture-extraction` report's confirmed (non-inferred)
  findings become **verified** input to this brief — cite them in the Non-assumption
  mandate's verified-vs-not-verified split as already confirmed, narrowing what still needs
  discovery in R0. Anything the prior report left `inferred`/unconfirmed stays unverified here
  too — a prior report's inference is not this brief's verification.
Do not re-ask what a prior artifact already answers; only ask about what it leaves open.

If any of this is missing, ask — **one question per turn**.

## Phase 2 — Present the Index Before Drafting

Never write the brief directly. First present the proposed content section by section, marking what's decided and what will remain an open decision, and wait for the user's approval or adjustments. The user frequently corrects assumptions about their own process at this step — it is the cheapest validation point in the whole flow. Do not proceed to Phase 3 without approval.

## Phase 3 — Draft Against the Template

Draft using the structure of `references/brief-template.md` (read it while drafting — it lays out all 12 required sections in contract order). The non-negotiable rules while drafting:

**Non-assumption mandate, immediately after Business Need / Business Cases / Users & Context / Constraints.** It includes: the statement that the brief was built without access to the code; the **explicit and exhaustive list of what has NOT been verified** (entities, integrations, conventions, external payload formats, deployment mechanisms); the rule that any contradiction between the brief and the real system is reported to the owner and never resolved by assuming; and the explicit delegation of all technical definition (schemas, routes, signatures, libraries) to the implementer after discovery.

**Language calibrated to certainty.** References to system entities are conceptual and must be marked as such ("real structure: discover in R0", "verify in R0 whether this exists"). Never assert with certainty something the conversation did not verify. Thresholds and parameters are configurable and/or open decisions, never definitive magic numbers.

**Implementation-agnostic processes.** Processes (`PR-#`) describe behavior and rules, not technology. Mermaid diagrams (state diagram for lifecycles, flowchart for flows) only for what was conceptually agreed. When a process depends on something unverified, the process says so inline ("if R0 confirms X; otherwise, fallback Y").

**EARS-compatible requirements (new AWM extension).** Write each RF/RNF so the development-engine brainstorming can derive its EARS `## Requirements` without rework: one testable SHALL-style claim per ID.

**Independently productive releases.** Every release must: deliver value usable on its own (justify it in one line: "independent productive value"), not require later releases, and be verifiable with acceptance criteria executable against real data/usage — never against mocks. No release starts before the previous release's CAs are met and its blocking open decisions are resolved.

**R0 is always read-only discovery.** Its deliverable is: the real-state report + conceptual→real mapping + contradictions found + technical plan conforming to discovered conventions. R0 never modifies code or data, and everything downstream is gated by the owner's validation of its report.

**ID traceability.** Needs (`N#`), processes (`PR-#`), functional requirements (`RF-x.y`), non-functional requirements (`RNF-x.y` and cross-cutting `RNF-T.#`), acceptance criteria (`CA-x.y`), open decisions (`DA-#`). Every ID scheme here has a defined home in `references/brief-contract.md`'s section list — do not carry forward an ID prefix (e.g. brief-spec's `P#` for "principles") that has no section to land in; either fold it into an existing section or drop it.

**Release sequencing by value, with justification.** Release order is recommended by business value (whatever replaces the cost/pain that motivated the project goes first), not by technical dependency, and the justification is written out.

**Frontmatter contract (new AWM extension).** Every brief opens with the literal YAML block below, with `mode: brief` for this skill's output (see `skills/readiness-gate/references/brief-contract.md` for the full normative rules — discriminator, `schema` semantics, single-writer `readiness`):

```yaml
---
awm: product-brief
schema: 1
title: <short name>
mode: brief
readiness: draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
open_decisions: [DA-1, DA-3]
project: <slug or null>
---
```

`readiness` is always written as `draft` by this skill — it is not this skill's field to set to `ready`; only `readiness-gate` (Phase 6) writes that value.

## Phase 4 — Flag Deviations at Delivery

If, while drafting, any decision was taken that differs from what was discussed (a reordering, an adjusted scope), flag it explicitly when delivering the brief so the user can approve or revoke it. Never leave silent deviations inside the document.

## Phase 5 — Deliver Per Context

The brief is a standalone Markdown artifact. Deliver it storage-agnostically (R4, R4.1):

- **In an AWM repo** — offer to save it to `docs/`, or offer a plain download; do not assume which.
- **Standalone** — deliver the file for the user to place; never bootstrap a repo, never require a storage platform, never assume where the artifact will live after delivery.

Never dump the brief inline in the conversation instead of as a file.

## Phase 6 — Invoke `readiness-gate`

Once the brief is delivered per Phase 5, invoke `readiness-gate` (see `skills/readiness-gate/SKILL.md`) to certify it against the G1–G9 checklist. Do not re-implement that checklist here — this skill only produces content; `readiness-gate` is the sole writer of the `readiness` field.

## Cross-Cutting Rules

- **Style and tone.** Neutral, technical/consulting register. Imperative voice directed at the implementer. Header with project, date, status, audience (the implementing agent), and methodology. Tables for glossary, open decisions, and risks (risk/impact/mitigation) — the risk "contradictions between brief and real system" is always included, mitigated by the non-assumption mandate + R0. Concise: the brief defines need and behavior; speculative technical verbosity is exactly what this methodology forbids.
- **Discriminator, not heuristics.** A document is a brief if and only if it carries `awm: product-brief` in frontmatter (R5). Never infer "this looks like a brief" from headings or filename.
- **One question at a time**, throughout Phases 1 and whenever a gap surfaces later.
- **Anti-patterns — stop and correct if any of these appear:**
  - Defining "tentative" table schemas, endpoint routes, or exact tool signatures with certainty syntax — that is assuming with the syntax of certainty. Describe the responsibility, delegate the form.
  - Acceptance criteria that are not executable ("the code must be clean") or verifiable only with synthetic/mock data.
  - Releases that only make sense if the next one exists.
  - Resolving an owner's ambiguity by choosing for them inside the document instead of registering it as `DA-#`.
  - Omitting "out of scope" — what will not be done is declared, with the same seriousness as what will.

## Termination

The brief is delivered as a file (Phase 5) and `readiness-gate` has run against it (Phase 6). Return control to the orchestrator (`product-process`, or the discovery session that invoked this skill) reporting the delivered artifact's path/location and the gate's verdict (`draft` + gaps, or `ready`). This skill never invokes another mode skill itself — routing on the verdict is the calling orchestrator's decision.
