---
applyTo: "**"
---

# Architecture Assessment

## Overview

`architecture-assessment` evaluates an existing architecture against the
quality attributes that actually matter for it, using a lightweight version
of ATAM (Architecture Tradeoff Analysis Method): elicit drivers, turn each
into concrete scenarios, walk the real system against each scenario, and
surface findings with severity and evidence. This is diagnosis, not design —
**the core discipline of this whole skill is that assessment changes
nothing**. No code, config, or document under review is ever edited here;
the only output is the report.

This skill is invoked in two situations: (1) standalone, when someone wants
to know whether an architecture holds up before a decision (adopt it,
extend it, replace it); or (2) as the contextual reviewer another flow
calls when it needs a targeted "does this hold up" opinion mid-conversation
(see Reuse of `architecture-advisor` below).

## Phase 1 — Elicit Drivers

Before anything else, establish **which quality attributes matter here**
and their relative priority — assessing against attributes nobody asked for
produces findings nobody acts on.

Ask the user (one question at a time if the answer isn't already in the
conversation):
- Which quality attributes are in scope? Offer the common set as a
  starting menu, not an exhaustive checklist: scalability, operability
  (deployability, observability, on-call load), cost, security,
  evolvability (how cheaply the system absorbs new requirements),
  reliability/availability, performance/latency.
- Of those, which 2-4 are the ones that actually drive this assessment?
  Rank them — a finding against a low-priority driver is lower severity by
  construction than the same finding against the top-priority one.
- Is there a triggering event? ("we're about to 3x the user base", "we keep
  missing on-call SLAs", "we're deciding whether to extend this before a
  new market") — the trigger, if any, usually reveals the true top driver
  even when the user's stated list says otherwise.

**Output:** an ordered driver list (e.g. "1. Operability, 2. Scalability,
3. Cost") with one line each on why it matters *for this system, now* — not
a generic definition of the attribute.

## Phase 2 — Build Concrete Scenarios per Driver

Every driver becomes 1-3 scenarios in **stimulus → environment → expected
response** form. A scenario that isn't independently checkable ("should
scale well") is not a scenario — reject it and rebuild it as measurable.

Format and worked examples:

| Driver | Scenario (stimulus → environment → expected response) |
|---|---|
| Scalability | "If traffic triples within 6 months, the system must sustain p95 latency under 300ms without a rewrite of the data layer." |
| Operability | "If the primary region goes down during business hours, an on-call engineer must restore service within 15 minutes using documented runbooks, without a code change." |
| Cost | "If usage grows 3x, infrastructure cost must grow sub-linearly (< 2x) — not scale 1:1 with load." |
| Evolvability | "If a new payment provider is added, integrating it must not require changes to the checkout or order modules — only a new adapter." |
| Security | "If an attacker obtains a leaked API key, blast radius must be limited to that key's declared scope — not full data access." |

Present the scenario set and get the user's confirmation or correction
before moving to Phase 3 — the user often knows the real trigger better
than the assessor does, and cheap correction here is worth more than a
polished analysis of the wrong scenario.

## Phase 3 — Analyze the Real System Against Each Scenario

For each confirmed scenario, determine whether the system, as it actually
is, would satisfy the expected response — and how confidently that can be
claimed.

- **If a repo is accessible:** read the real code and configuration.
  Every claim about how the system behaves is backed by a `file:line`
  citation. Do not reason from the system's name or its stack's reputation
  ("it's on Postgres so it scales") — trace the actual code path the
  scenario stresses.
- **If no repo is accessible:** work from documentation, diagrams, or
  descriptions the user supplies. Ask for what's missing rather than
  filling the gap with a plausible guess (Cross-Cutting Rules).
- For each scenario, record: **verdict** (meets / partially meets / does
  not meet / unknown), the **evidence** for that verdict, and any
  **sensitivity point** (a single design decision that, if changed, would
  flip several scenarios at once — ATAM's classic high-leverage spot) or
  **trade-off** (a decision that helps one driver at the cost of another,
  e.g. "the synchronous integration [file:line] simplifies consistency but
  is the operability bottleneck behind the Phase 2 failover scenario").

## Phase 4 — Findings

Consolidate Phase 3's analysis into a findings table. Every finding carries
a severity and its evidence — a finding without both is not yet ready for
this table.

| # | Finding | Related scenario(s) | Severity | Evidence |
|---|---|---|---|---|
| 1 | [risk / trade-off / sensitivity point, one line] | [driver/scenario it violates or threatens] | High / Medium / Low | [file:line, or cited doc/section] |

Severity is driven by two things together: how badly the finding threatens
a **high-priority** driver from Phase 1, and how likely the triggering
stimulus is to actually occur. A scalability sensitivity point is High only
if scalability was ranked high in Phase 1 *and* the tripling-of-traffic
stimulus is plausible for this system — severity is not assigned from the
finding's technical scariness alone.

## Phase 5 — Prioritized Recommendations

Turn findings into recommendations ordered by **severity × effort** — high
severity and low effort first, not severity alone (a High-severity finding
that needs a quarter-long rewrite may reasonably be sequenced after two
Medium-severity findings fixable this week).

| Recommendation | Addresses finding(s) | Severity | Estimated effort | Priority |
|---|---|---|---|---|
| [concrete action] | [# from Phase 4] | High/Medium/Low | S/M/L | 1, 2, 3... |

Recommendations are actions ("add a circuit breaker around the payment
integration"), not restatements of the finding ("the integration is
fragile").

## Reuse of `architecture-advisor` (Contextual Mode)

Per the Task 1 audit (`docs/plans/2026-07-22-product-layer-audit.md`),
`architecture-advisor`'s verdict is **adapt**: its Phases 1-5 and Contextual
Mode table are self-contained and directly reusable. Its Phase 6 ("Generate
design artifact") no longer routes anywhere dead — the 2026-07-23
flow-cleanup (`docs/plans/2026-07-23-architecture-flow-cleanup-design.md`)
replaced that routing with direct delivery, matching this skill's own
Termination section.

**Advisor gate (mandatory evaluation at the close of Phase 3).** When
closing Phase 3, explicitly evaluate whether the analysis needs a second,
architecture-design-trained opinion: are there findings that question the
design itself, not just its behavior against the scenarios? If yes —
invoke `architecture-advisor` (`skills/architecture-advisor/SKILL.md`)
**in its Contextual Mode**, using its own documented row for this exact
case:

> "Validate whether this architecture makes sense" → Review of the
> existing + flag risks/improvements

Pass it the system context already gathered in Phase 3 (do not make it
re-derive context `architecture-advisor`'s own Step 0.1 would otherwise
gather — Contextual Mode explicitly skips that step and uses the invoker's
context). Its output folds back into this skill's Phase 3/4 as additional
evidence and candidate findings — `architecture-advisor` in Contextual Mode
returns a result to the invoker rather than producing its own artifact
(its Phase 6 does not apply to Contextual Mode), so this skill remains the
one producing the final report.

If no — declare **"advisor pass: not applicable"** in the report, as a
one-line note alongside the Phase 4 findings table. Either way the gate
produces an explicit outcome: the advisor's integrated input, or the
"not applicable" declaration. Silence is not a valid gate outcome. The
evaluation itself is mandatory; only the invocation is conditional —
Phases 1-5 still run on their own whenever the gate concludes a second
opinion isn't needed.

**Availability.** `architecture-advisor` ships in the `dev` bundle, not
`product` — a `product`-only install (`bundles/product/bundle.json`'s
`dependsOn` is empty) may not have it. If the gate concludes a second
opinion is needed but `architecture-advisor` is not among the available
skills, declare **"advisor pass: not applicable (architecture-advisor not
installed)"** instead of invoking it — same rule as the layered access
below for `mermaid-diagrams`.

## Diagrams (`mermaid-diagrams`, layered access)

When a finding or scenario is clearer with a diagram (e.g. showing the
sensitivity point's blast radius, or the flow a scalability scenario
stresses), use the same layered-access discipline `architecture-extraction`
applies to the same dependency (`skills/architecture-extraction/SKILL.md`,
Step 0b) — `mermaid-diagrams` is a registry skill, shipped on-signal in the
baseline `dev` bundle and guaranteed present in standard installations, but
it is still never treated as an unconditional dependency, since partial
installs may not carry it:

| Layer | Condition | Behavior |
|-------|-----------|----------|
| 1. `mermaid-diagrams` skill | Listed among available skills | Invoke it for the relevant diagram type (flowchart, sequence, C4). |
| 2. Inline fallback | Not installed (partial install without the `dev` bundle) | Use plain Mermaid `flowchart` syntax written directly in the report — no external reference needed. |

Diagrams are illustrative here, never a required deliverable — Phase 4's
findings table is the actual output; a diagram only supports a finding that
needs one.

## Cross-Cutting Rules

- **Assessment changes nothing.** No code, configuration, or document
  under review is ever edited, refactored, or "fixed along the way" by
  this skill. The only output is the report itself.
- **No accessible system, no invention.** If no repo, documentation, or
  description is available for a scenario, ask the user for the concrete
  input rather than filling the gap with a plausible-sounding guess about
  how the system probably works.
- **Scenarios are always concrete and measurable.** Reject and rebuild any
  scenario phrased as a vague aspiration ("should scale well", "should be
  secure") — every scenario states a stimulus, the environment it occurs
  in, and a response that can be checked as met or not met.
- **Calibrated certainty.** Every verdict in Phase 3 is backed by cited
  evidence (`file:line` or a named document/section) or explicitly marked
  `unknown` — never asserted with more confidence than the evidence
  supports.

## Termination

Deliver a single portable `.md` report carrying the same frontmatter
contract as every other product-layer artifact
(`skills/readiness-gate/references/brief-contract.md`, R5.3):

```yaml
---
awm: product-brief
schema: 1
title: <system name> — Architecture Assessment
mode: assessment
readiness: n/a
created: YYYY-MM-DD
updated: YYYY-MM-DD
open_decisions: []
project: <slug or null>
---
```

**On `readiness` and body structure.** See the contract's current text for
the full rule — in short, `mode: assessment` reports write `readiness: n/a`
(never a self-authored `draft`/`ready`), and the body is purpose-built for
assessment content (drivers, scenarios, findings, recommendations), not the
12 business-oriented sections a `mode: brief` document carries.

**On `open_decisions` — assessment findings are risks, not open
decisions, unless they gate a real brief.** A Phase 4 finding does not, by
itself, earn a `DA-#` — it lives in the findings table with its own
severity/evidence columns, which is where every finding is fully recorded
regardless of what happens next. Reserve `DA-#` (and a frontmatter
`open_decisions` entry) exclusively for a finding that, *if this assessment
flows into a `product-brief`*, would become that brief's actual blocking
open decision with a `blocks` column pointing at a real release or
requirement — not for a documented risk that has no downstream brief to
block. Do not invent a new ID prefix (no `F-#`/`R-#`) for the rest: a
finding either earns `DA-#` because it will genuinely gate something, or it
does not enter `open_decisions` at all.

- **If findings reveal nothing actionable:** deliver the report and stop —
  no chaining is owed when there's no follow-on work.
- **If findings derive into work worth doing:** offer — do not
  automatically invoke — to chain into `product-brief`
  (`skills/product-brief/SKILL.md`, "Use when a matured idea must be
  structured into a formal, portable product brief for handoff to
  development"), passing this report as verified context the brief's own
  non-assumption mandate can build on. This is conditional, phrased as an
  offer to the user, unlike a flow whose explicit goal was already to
  extend the system — assessment's goal is evaluation, so whether there's
  something to build is an open question until the findings say so.
- Never chain automatically and never chain to more than one skill at a
  time.
