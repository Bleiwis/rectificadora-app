---
applyTo: "**"
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** If working in an isolated worktree, it should have been created via the `using-git-worktrees` skill at execution time.

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`
> (recommended) or `executing-plans` to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

**Modo de ejecución:** interactivo

---
```

### Modo de ejecución

El campo `**Modo de ejecución:**` acepta `interactivo` (default) o `desatendido`. Escribe `desatendido` **solo si el usuario lo pidió explícitamente** para esta corrida. Si el campo queda ausente, los skills lectores asumen `interactivo`.

WHEN el modo es `desatendido`, incluye este blockquote canónico inmediatamente después de la línea del campo (texto literal, no lo parafrasees — es la única fuente del mandato):

```markdown
> Mandato de ejecución desatendida: ejecución completa sin pausas de check-in
> entre tareas, ni de confirmación entre fases (development-process rutea
> automáticamente y subagent-driven-development no pregunta si continuar con
> el cierre). harness-retro triagea con criterio propio del agente (solo valor
> real, recurrente o sistémico — descarta el resto sin preguntar).
> post-implementation-qa corrige TODOS los hallazgos que surjan, no solo algunos.
> finishing-a-development-branch crea el PR directamente (opción "push + PR"),
> sin presentar el menú de 4 opciones.
```

Los skills lectores (`development-process`, `subagent-driven-development`, `post-implementation-qa`, `harness-retro`, `finishing-a-development-branch`) parsean únicamente la línea del campo; el blockquote es para humanos y para robustez ante compactación de contexto. El modo desatendido quita pausas, no controles: todos los gates corren igual.

## Task Structure

````markdown
### Task N: [Component Name]

_Requirements: R1.1, R2.3_

**Track:** core            ← only for plans using Parallel track declaration below; single line, right after _Requirements:_ and before **Files:** (omit line if the plan is serial)

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Skills:** frontend-craft            ← skills the implementer MUST invoke; single line, comma-separated (add ui-ux-pro-max only for the standalone case below — omit line if none)
**Design artifacts:** .stitch/designs/login.html, .stitch/designs/login.png   ← single line, comma-separated (UI tasks only — omit line if not applicable)

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():  # verifies R1.1
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

**Requirement traceability tag.** The `_Requirements: R1.1, R2.3_` line names the requirement IDs (from the spec's `## Requirements` section) that the task satisfies, and each test comment names the ID it verifies (`# verifies R1.1`). This is what makes the traceability matrix and the analyze gate below mechanical rather than guesswork. **Tier:** omit the tag only for trivial single-file diffs whose spec intentionally has no `## Requirements` section.

**Skill & artifact propagation (UI tasks).** Any task that creates or modifies UI belonging to a designed screen MUST declare `**Skills:**` (at minimum `frontend-craft`) and `**Design artifacts:**` with the exact paths inherited from the design doc's `## UI Screens` Artifacts column (see `skills/ui-design/SKILL.md` Step 4 for the table format). The execution controller copies both into the subagent prompt — a UI task without them ships an implementer who has never seen the design. The design doc's table cell separates paths with `·` (e.g. `.stitch/designs/login.html · .stitch/designs/login.png`); when inheriting them into `**Design artifacts:**`, convert that `·`-separated cell into the comma-separated single-line format shown above (`.stitch/designs/login.html, .stitch/designs/login.png`) — comma-separated is what the execution controller mechanically copies into implementer prompts, so don't carry the `·` over. Inherit only real file paths: if a cell entry is a degradation token rather than a path (e.g. `n/a (offline, no browser)` when no PNG exists), do NOT carry it into the field — declare only the paths that exist (e.g. just the `.html`).

A task counts as touching a designed screen when its `**Files:**` list includes a route/component/page file that corresponds to a screen listed in the design doc's `## UI Screens` table — cross-check the Files list against that table's Screen column before deciding.

`frontend-craft` alone is normally sufficient — it consults `ui-ux-pro-max` internally when a color/typography/UX decision needs it. Only declare `ui-ux-pro-max` directly in `**Skills:**` if the task needs to invoke its search independent of frontend-craft (e.g. a task that's purely about generating/persisting a design system, with no frontend-craft escalation).

## Parallel track declaration (optional, fail-closed)

<!-- AWM-INTEGRATION: track-plan-contract -->

Use this only when two or more task groups have no overlap in files,
dependencies, declared resources, lockfiles, manifests, migrations, snapshots,
or generated outputs. If that claim cannot be made explicitly, omit all track
fields and keep the plan serial.

Add one `**Track:** <id>` line to every tracked task immediately after its
`_Requirements:_` line and before `**Files:**`. Add one plan-level block:

```markdown
## Tracks

**Integration argv:** ["npm","test","--","--runInBand"]
**Integration paths:** ["src/**","tests/**"]

| Track | Depends on | Shared resources |
|---|---|---|
| core | none | [] |
| docs | none | [] |
```

`Integration argv` and `Integration paths` are JSON string[] values, not shell
text. Derive argv from a command already verified in the repository; preserve
each token as a separate array element.

`Depends on` is `none` only when there is no dependency; any other value forces
serial execution. `Shared resources` must be explicit, including `[]`; omitted
means serial. Resource IDs use `<class>:<value>` such as `port:5432`, `db:dev`,
or `path:.cache/tool`.

A plan is never marked parallel because of how many tasks it has; whether it
can run in parallel is derived from analyzing Files/declared-resources overlap
(or the lack of it), and the design always preserves a serial fallback.

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Traceability matrix:** Build a table mapping each spec requirement ID to the task(s) and test(s) that cover it. Report both directions:
- **Forward gap** — a requirement ID with no task or no test. The requirement isn't built or isn't verified. Add the missing task/test.
- **Backward gap** — a task or test with no requirement ID. That's scope creep / orphan code — either it traces to a requirement you forgot to write, or it shouldn't be in the plan. Resolve it, don't leave it dangling.

```markdown
| Req  | Task(s) | Test(s) |
|------|---------|---------|
| R1.1 | T2      | test_specific_behavior |
```

*(Tier: the matrix applies to multi-task plans tied to a `## Requirements` spec. A trivial single-file diff with no requirements section skips it.)*

**Matrix precision (verification must match the claim, not just a shared marker):** the `Test(s)` column must cite a verification step that actually proves THAT requirement's specific claim — not a generic marker shared with other requirements. A `grep` for a broad, reused phrase (e.g. counting how many times "Modo desatendido" appears in a file) proves the phrase exists somewhere, not that a specific requirement's semantic claim holds (e.g. that BLOCKED escalation is never skipped, or that an invalid field value falls back safely). This was caught in a QA pass where several matrix rows cited generic-marker greps for requirements whose actual claim needed a phrase-specific check. When a requirement makes a specific behavioral claim, either grep for language that anchors that specific claim, or note explicitly that the check relies on manual reading rather than an automated proxy.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

**4. UI task propagation:** Does every task touching a designed screen declare `**Skills:**` and `**Design artifacts:**`? Do the declared artifact paths match the design doc's `## UI Screens` Artifacts column for that screen (not stale/mismatched)? A UI task without them, or with wrong paths, is a plan failure — fix it.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

## Analyze Gate (coverage, pre-handoff)

Before offering the execution choice, run this gate on the traceability matrix. It is the `analyze` step: a mechanical coverage check, not a judgment call.

- **Every requirement ID has ≥1 task AND ≥1 test.** A requirement with a task but no test is built-but-unverified — not done.
- **No task or test lacks a requirement ID.** Anything unanchored is orphan scope — resolve it before handoff.

Do not proceed to the execution handoff while the gate reports gaps. *(Tier: skipped for trivial single-file diffs with no `## Requirements` section.)*

## Harness Preflight Gate (pre-handoff) — BLOCKING

Everything past the execution handoff consumes `awm sensors run`: the implementer, both
reviewers, `post-implementation-qa`. **None of them verify the sensors can actually run.**
If the harness is not configured, or declares tools that are not installed, those phases
report on checks that never happened — and on an unattended run nobody finds out until a
bad change is already merged.

```bash
awm preflight
```

- **Exit 0 (`ready`)** — proceed to the Context Budget Gate.
- **Non-zero (`degraded` / `not_configured`)** — **stop. Do not offer the execution
  choice.** Show the report, walk the user through the remedy it prints (usually
  `awm sensors init`, installing a missing tool, or deliberately disabling a sensor), and
  re-run until it is green.

This is the one gate here that genuinely blocks, and the reason is the boundary itself: it
is the last point where a person can fix the harness. A misconfigured harness discovered
at 3 AM is not a slower run, it is a run whose entire quality apparatus was decorative.

**Do not route around it.** If the user asks to skip, the honest options are to fix the
config, or to opt out deliberately (`awm sensors init`, then set the sensors to
`"enabled": false`) so the decision is recorded in a committed file rather than implied by
silence. Never proceed by treating "not configured" as "no findings".

*(If `awm preflight` reports an unknown command, the project is on an older AWM CLI — say
so once and continue; do not improvise a substitute check.)*

## Context Budget Gate (pre-handoff)

**This is the last moment the human is guaranteed to be here.** Everything past the execution
handoff can run unattended — `development-process` only skips approval for post-plan phases, and
the phases before the plan exists are always interactive. So a check that needs a person must
happen here, not later.

Run it before offering the execution choice:

```bash
awm context-budget
```

*(Requires the AWM CLI that ships this command. If it reports an unknown command, the
project is on an older CLI — say so once and continue; do not improvise a substitute.)*

It measures the files injected into **every** session — `AGENTS.md`, `CONSTITUTION.md`,
`CLAUDE.md` — against the budget pinned in `.awm/context-budget.json`. Silence means within
budget; proceed. If it reports, present the three options and let the user pick:

1. **Prune now.** The cheapest moment there is: that context is already loaded, and the user is
   deciding what matters for the work about to start. Lessons already internalized, or superseded
   by a newer rule, are what should go.
2. **Raise `maxBytes`** in `.awm/context-budget.json` — a committed, reviewed decision to keep
   paying for that context in every future session.
3. **Proceed and note it** in the plan, if the growth is not worth interrupting for right now.

**Never let this block execution on its own.** Blocking here would strand exactly the overnight
runs it exists to protect — the user came back in the morning expecting a PR, not a stalled gate.
It is a decision point while someone is present, never a gate that fires when nobody is.

Note the one-session lag this design accepts: `harness-retro` grows these files at the *end* of a
run, so growth from this session surfaces at the *next* plan gate. That is deliberate. The
alternative — gating at retro time — is precisely what fires while nobody is watching.

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use `subagent-driven-development`
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use `executing-plans`
- Batch execution with checkpoints for review
