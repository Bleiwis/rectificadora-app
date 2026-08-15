---
applyTo: "**"
---

# Product Discovery

## Overview

`product-discovery` is the entry point for the "raw idea" route: a user shows up with an intuition, a hunch about a module, or a problem they can feel but haven't articulated — no formed requirement, no brief to structure yet. This skill's job is to turn that intuition into a covered problem space: the problem itself, the job the user is hiring a solution to do, the catalog of business cases that job must handle, the constraints around it, and the alternatives worth weighing before committing to build anything.

This skill stays entirely on the WHAT/WHY side. It never designs, architects, or picks technology — that is explicitly out of bounds here (see Cross-Cutting Rules). When the five phases below are covered, this is a discovery session that concludes, and its findings crystallize into a `product-brief` (see `skills/product-brief/SKILL.md`) — this skill's own termination phase does that handoff explicitly, never leaving the user to figure out the next step.

Front-loading Phase 3 (Business cases) here matters beyond this skill's own scope: `readiness-gate`'s G4 criterion ("Business cases enumerated") fails a downstream brief that never collected this catalog. Insisting on it now is what lets the brief that follows pass G4 on the first try.

## Conversational Mechanics

Same discipline as `brainstorming` (see `skills/brainstorming/SKILL.md`), applied at the business level instead of the technical one:

- **One question per message.** Never stack multiple questions in a single turn.
- **Multiple choice when it fits.** Offer concrete options (A/B/C/"something else") whenever the question has a natural, enumerable answer space; open-ended is fine when it doesn't.
- **YAGNI at the problem level too.** Don't chase hypothetical problems the user hasn't actually confirmed they have.
- **Nothing is asserted without the user's confirmation.** Every framing of the problem, every candidate JTBD statement, every business case is proposed as a hypothesis and only kept once the user confirms it — this skill drafts hypotheses, the user is the source of truth on their own problem.

## Phase 1 — The Problem

Establish what actually hurts today, in the user's own words, before naming any solution.

Guide questions (ask one at a time):
- Who suffers this problem, specifically? (a role, a team, a type of customer — not "everyone")
- When does it show up — what triggers it, how often, at what point in their workflow?
- What does it cost today, concretely? Offer the shape of the answer as multiple choice: (a) time lost, (b) money lost or unrealized, (c) risk/compliance exposure, (d) quality or reputation damage, (e) something else?
- How is this handled right now — a workaround, a manual process, or is it just absorbed as pain?
- What happens if this is never fixed? What's the trajectory — does it get worse, stay flat, or is it tolerable indefinitely?

Do not move to Phase 2 until the who/when/cost/what-if-unresolved are each answered and confirmed back to the user.

## Phase 2 — Job to Be Done

Shift from the problem to the progress the user is trying to make — the "job" they'd "hire" a solution for. This is deliberately not about features.

Guide questions:
- When this problem shows up, what is the person actually trying to get done? (Finish the underlying task, not "use software.")
- What does "success" look like to them in that moment — what changes once the job is done?
- What are they using today to get this job done, even imperfectly — another tool, a spreadsheet, a person, nothing at all?
- What would make them fire whatever they use today and switch? What's the minimum bar to earn that switch?
- Is there a moment this job becomes urgent or unavoidable — a trigger event that pushes them to act?

Phrase the emerging JTBD back as a single sentence — "When [situation], I want to [motivation], so I can [expected outcome]" — and get explicit confirmation before moving on. Do not proceed on an unconfirmed JTBD statement.

## Phase 3 — Business Cases

Build the catalog of concrete cases, exceptions, rules, and variants this problem actually involves. This phase is deliberately exhaustive — this is the catalog that, if skipped, arrives too late in development (this is what G4 of `readiness-gate` checks for, and what a downstream brief needs to pass it).

Guide questions:
- Walk me through the most common case, start to finish — what happens step by step?
- What's a case that's rarer but still happens regularly? And another?
- Which exceptions or edge cases have actually happened before, even if rarely?
- Are there different rules depending on who's involved — role, tier, region, account type, timing?
- What else? Keep going until you can't think of another variant.
- Which edge case, if mishandled, would embarrass us in production? Walk me through that one specifically.

Do not settle for a first pass. After the user seems to run out of cases, ask explicitly: "What else? Is there an edge case we haven't covered?" — insist until the user confirms the catalog feels complete, not just until they stop offering more unprompted.

## Phase 4 — Constraints & Context

Surface what already exists and what boundaries the eventual solution must respect, before any alternative is weighed.

Guide questions:
- What already exists today that this has to work with or around — systems, data, processes that can't be ignored?
- Is there anything that absolutely cannot be touched or changed — a system, a contract, a dependency someone else owns?
- What's the budget or resourcing reality — is there a hard ceiling, or is it open-ended within reason?
- Are there privacy, compliance, or data-handling constraints that apply here (e.g. personal data, regulated information, NDA-bound context)?
- Is there a deadline or external trigger this needs to land before, or is timing flexible?

## Phase 5 — Alternatives

Before any commitment to build, lay out at least two real paths forward — always including the option of not building anything.

Guide questions:
- Beyond building something new, could a process change alone address this — different ownership, a new policy, a manual fix? (Always present "build nothing / process change" as one of the options, never skip it.)
- What's a second path — could an existing tool, a lighter-weight change, or reusing something already in place get most of the value?
- What's the path you'd actually reach for if this had to happen this quarter, and why?
- What would each alternative cost to *not* have — what value is left on the table by picking the smaller path over the larger one?

Present the alternatives back as a short list (at least two, one of which is always "build nothing / process change") with a one-line trade-off each, and get the user's confirmation on which direction resonates before closing discovery. Confirming a direction here is not a technical commitment — it stays a business-level choice between paths, not a design.

## Cross-Cutting Rules

- **Problem-space discipline.** This skill never proposes technical solutions, architectures, or stacks. If the conversation drifts to HOW, park it as a note for the brief and return to WHAT/WHY.
- **Nothing is asserted without user confirmation; one question at a time.** See Conversational Mechanics above — both rules apply throughout every phase, not just where first introduced.
- **Insist on completeness in Phase 3.** A thin business-case catalog is the single most common reason a downstream brief fails G4 later; do not let the user move on with only the happy path covered.

## Termination

**All five phases covered.** Once the problem, JTBD, business-case catalog, constraints, and alternatives all have confirmed answers, this is a discovery session that concludes: summarize the findings back to the user for a final confirmation, then hand off explicitly to `product-brief` (`skills/product-brief/SKILL.md`) so its findings crystallize into a structured brief. Say so explicitly — do not silently stop; name `product-brief` as the next skill and pass along everything gathered in Phases 1–5 as its input.

**User stops before all five phases are covered.** Do not force the remaining phases. Instead, deliver whatever was gathered as a partial `.md` summary conforming to the brief contract's frontmatter (`skills/readiness-gate/references/brief-contract.md`), using:

```yaml
---
awm: product-brief
schema: 1
title: <short name>
mode: discovery
readiness: draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
open_decisions: []
project: <slug or null>
---
```

Populate the body with whatever phases were actually completed (label incomplete ones explicitly as "not covered" rather than guessing), and note that `readiness` is left as `draft` — this skill never writes `ready` itself; only `readiness-gate` does. Tell the user the summary can be resumed later or handed to `product-brief` once the remaining phases are filled in.
