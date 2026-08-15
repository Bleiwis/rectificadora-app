---
applyTo: "**"
---

# Product Process Orchestrator

## Overview

Orchestrates the business/ideation layer that sits before the development engine: it identifies which product-layer mode a session needs, invokes it, and — once a certified brief exists — hands off to `development-process`. This skill does NOT do discovery, drafting, assessment, or extraction itself; it reads signal, decides the mode, delegates, and guarantees the phases that mode owes (same principle `development-process` applies to the engine side).

**Core principle:** Read signal, decide mode, invoke skill, never guess when ambiguous, never skip the gate.

## Product Layer Map

| Mode | Skill | Trigger | Output |
|------|-------|---------|--------|
| Discovery | `product-discovery` | Raw idea, intuition, unformed problem | Problem/JTBD/business-cases summary; hands off to `product-brief`, or a partial `.md` (draft) if stopped early |
| Structuring | `product-brief` | Matured idea needing a formal brief | `.md` conforming to the brief contract, already sealed by `readiness-gate` (Phase 6) |
| Assessment | `architecture-assessment` | Evaluate/critique an existing architecture | `.md` report, `readiness: n/a`, findings + recommendations |
| Extraction | `architecture-extraction` | Document/extract the current architecture | `.md` report, `readiness: n/a`, arc42-lite + C4 views |
| Certification | `readiness-gate` | Any document claiming to be a brief, at creation and again at the development crossing | Per-criterion G1–G9 verdict written into the document's frontmatter (`readiness` + `updated` only) |

## Step 0 — Context Detection (R3)

Determine whether this is an AWM-enabled repo or a standalone session before routing — this decides where an artifact can live (R4) and whether Modes 3/4 (`architecture-assessment`, `architecture-extraction`) have real code to read.

```bash
CTX="standalone"
[ -d docs ] && CTX="repo"
[ -f CONSTITUTION.md ] && CTX="repo(awm)"
[ -f .awm/sensors.json ] && CTX="repo(awm+sensors)"
echo "context: $CTX"
```

- **AWM repo** (`docs/`, `CONSTITUTION.md`, and/or sensors present): artifacts may be versioned under `docs/` alongside plans; Modes 3/4 have a real codebase to cite `file:line` against.
- **Plain repo, no AWM markers:** artifacts still may be saved into the repo if the user wants, but there is no `CONSTITUTION.md`/sensor context to lean on.
- **Standalone (no repo attached):** artifacts are delivered as a file only (R4) — never bootstrap a repo, never assume a save location. Modes 3/4 fall back to whatever documentation/description the user supplies (their own Cross-Cutting Rules already cover this: "No repo, no invention" — ask, don't guess).

Announce which context was detected before routing.

## Step 0.5 — Brief Detection (R6)

If the user supplies a document (attachment, MCP resource, pasted text, or a file path) instead of — or in addition to — a plain request, check it before routing:

1. Invoke `readiness-gate`'s Phase 1 (Load & Lint) against the document.
2. **Discriminator present and well-formed** (`awm: product-brief` in frontmatter, per `skills/readiness-gate/references/brief-contract.md`): this is a real product-layer artifact — proceed to the **Re-ingestion** row of Step 1's routing table.
3. **No valid frontmatter** (missing discriminator, malformed YAML, or not a `product-brief` at all): per `readiness-gate` Phase 1, this returns "not a brief — offer adoption" rather than an error. Do not guess intent from headings or body content (brief-contract's discriminator rule applies here too). Offer **adoption (R6.1)**: convert the document into the contract's frontmatter shape while preserving its content verbatim — do not invent sections it doesn't have, do not silently drop what it does have. Ask the user (one question, do not guess) which `mode` the content most resembles — `discovery`, `brief`, `assessment`, or `extraction` — then initialize `readiness` per the contract's neutral rule (`draft` for discovery/brief, `n/a` for assessment/extraction; this is the one-time initialization every mode performs, never a self-certified `ready`). Once adopted, continue into whichever mode fits, or hand to `readiness-gate` if the adopted shape is `mode: brief`.

## Step 1 — Routing by Signal

| User signal | Route |
|---|---|
| "I have an idea / not sure yet what I want" | `product-discovery` |
| "I know what I want, help me structure it" | `product-brief` |
| "Evaluate / critique this architecture" | `architecture-assessment` |
| "Document / extract the current architecture" | `architecture-extraction` |
| Existing brief detected | Re-ingestion: Load & Lint → show state ("brief of X, readiness: draft, N open decisions") → ask: continue maturing, or hand off to development? |

**Re-ingestion detail — scoped by `mode`, not universal:** for `mode: brief`/`mode: discovery` documents, the "state" shown is always a **fresh** `readiness-gate` verdict, never the stored seal read as-is — `readiness-gate` re-evaluates content every time it runs, even when the frontmatter already says `ready` (R7/R7.2). For `mode: assessment`/`mode: extraction` documents, `readiness-gate` is **never invoked** at re-ingestion — these modes are never submitted to that gate and permanently carry `readiness: n/a` (`brief-contract.md`); their "state" is read directly from the document (its `mode`, its findings/open-decision count) without any gate call, since re-running the gate on them would risk writing a self-assigned value into a field the contract reserves exclusively for `readiness-gate`'s own G1-G9 verdicts. In both cases, report the document's `mode` and open-decision count, then ask explicitly: continue maturing in the mode that produced it (`product-discovery` if `mode: discovery`, `product-brief` if `mode: brief`; `mode: assessment`/`mode: extraction` reports are terminal and have no "maturing" step of their own — offer to chain into `product-brief` instead, per those skills' own Termination), or — only for `mode: brief`, and only if the fresh verdict is `ready` — proceed to Step 3's handoff. A raw `mode: discovery` document is structurally never `ready`: it has no Requirements section to satisfy G7, so its fresh verdict is always `draft`, and the only forward path for it is continuing to maturity in `product-discovery` (or, once its phases are complete, crystallizing into `product-brief`) — never a direct handoff.

**R1.1 (literal):** *If the signal is ambiguous between maturing the idea and building it, ASK — never guess the mode.* This applies at first routing and at every re-ingestion: do not infer "structure it" vs "build it" from tone alone when both readings are plausible.

**Valid chains (R2.1) — sequential and explicit, never silent:**
- `product-discovery` → `product-brief`: when all five discovery phases are covered, `product-discovery`'s own Termination hands off explicitly, naming `product-brief` as the next skill.
- `architecture-extraction` → `product-brief`: when the extraction's goal was to extend the system, `architecture-extraction`'s own Termination chains explicitly (does not wait to be asked), passing the extraction document as verified context.
- `architecture-extraction` → `architecture-assessment`: when extraction surfaces technical debt worth evaluating, `architecture-extraction`'s own Termination *offers* this chain (not automatic) using its Technical Debt & Extension Register as input.
- `architecture-assessment` → `product-brief`: when assessment findings derive into work worth doing, `architecture-assessment`'s own Termination *offers* this chain (not automatic) — assessment's goal is evaluation, so whether there is something to build stays an open question until findings say so.

These chains are executed by the mode skills themselves, per their own documented Termination — `product-process` does not re-implement or re-decide them; it only routes the *first* mode for a given signal and resumes control when a mode returns it (see Cross-Cutting Rules, R10.1).

## Step 2 — Convergence

Every path that produces a `mode: brief` document has already been sealed: `product-brief`'s own Phase 6 invokes `readiness-gate` before its Termination returns control here. `mode: discovery` (partial, user-stopped-early) documents and `mode: assessment`/`mode: extraction` reports are not gated (they carry `draft` or `n/a` by the contract's neutral-initialization rule, never a self-authored `ready`).

On regaining control from any mode:
1. Show the artifact's path/location and its current `readiness` state (from the gate's verdict, or `n/a`/`draft` if ungated).
2. Offer: save to repo (if Step 0 detected an AWM repo) / plain download (standalone, R4) / hand off to development now?
3. Never leave the artifact only inline in the conversation — it is always delivered as a file (same rule every mode already applies).

## Step 3 — Handoff

Handoff to `development-process` is only meaningful for a `mode: brief` (or discovery-crystallized-into-brief) document — `mode: assessment`/`mode: extraction` reports have no handoff of their own here; their only forward path is the Step 1 chains into `product-brief`.

1. User chooses "hand off to development."
2. Re-run `readiness-gate` on the document — this is the crossing-point re-verification (R7.2), and it happens **unconditionally**, even if the stored seal already reads `ready`. If the fresh verdict diverges from the stored seal, the crossing is blocked and the discrepancy is shown (which criterion changed and why) — same rule the gate itself states.
3. **Verdict `ready`:** check whether `development-process` is installed (e.g. `$HOME/.agents/skills/development-process`, `.agents/skills/development-process`, `$HOME/.claude/skills/development-process`, `.claude/skills/development-process`). If installed, invoke `development-process`, passing the brief's file path as its input — the brief is the only thing that crosses (R10.1). **If `development-process` is not installed (R8.3, literal):** *the handoff terminates by delivering the .md — no error.* Report that the artifact is delivered and stop; do not fabricate a substitute engine step.
4. **Verdict `draft`:** show the specific gaps (the gate's per-criterion ✗ list with evidence) and offer to return to whichever mode can close them — do not force the gate, there is no override.

## Cross-Cutting Rules

- **Single active orchestrator (R10, literal):** *product-process ends in an explicit terminal state (artifact delivered or development-process invoked) — no nesting, no co-existence.* Never run this orchestrator alongside `development-process`; control passes one direction, once, at the moment defined in Step 3.
- **The brief is the baton (R10.1, literal):** *context crosses between orchestrators only inside the artifact. What is not in the brief did not cross.* Do not carry conversational context to `development-process` by any channel other than the delivered `.md` — no side-channel summaries, no "by the way" context.
- **The orchestrator routes, it does not draft.** `product-process` never writes brief content, never runs the G1–G9 checklist itself, never performs discovery questions or architecture analysis — that is exclusively the invoked mode's job, exactly as `development-process` never implements code itself.
- **Never invoke `writing-plans`, `brainstorming`, or any development-engine skill directly.** The only engine-side skill this orchestrator ever invokes is `development-process` itself, and only at Step 3 — what `development-process` does internally afterward is its own concern, not this skill's.
- **Adoption never invents.** R6.1 conversion preserves the document's existing content; it does not backfill missing sections with plausible-sounding text to make the contract "look" satisfied.

## Checklist

| Item | Confirms |
|---|---|
| Context detection | AWM repo vs. standalone determined; artifact storage path known before any mode runs |
| Brief detection | Any supplied document checked via `readiness-gate` Phase 1; adoption offered if the discriminator is absent |
| Routing | Signal matched to exactly one mode, or the user was asked when ambiguous (R1.1) |
| Mode(s) executed | The invoked mode (and any chain it makes itself, per R2.1) ran to its own Termination |
| Gate | A fresh `readiness-gate` verdict backs any `readiness` shown or acted on — never the stored seal alone |
| Delivery/handoff | Artifact delivered (save/download) and/or `development-process` invoked; a terminal state was reached (R10) |

## Termination

This skill ends in exactly one of two ways: the artifact is delivered (Step 2, with no further handoff chosen or possible), or `development-process` is invoked (Step 3, verdict `ready`, engine installed). There is no third terminal state — if the engine isn't installed, delivering the `.md` (R8.3) is itself the termination, not a failure requiring escalation. A `draft` verdict is not a third terminus: it is a loop back into whichever mode can close the gaps (Step 3.4), which itself ends, in turn, in one of these same two ways. Never invoke `writing-plans`, `brainstorming`, or any other development-engine skill directly from here.
