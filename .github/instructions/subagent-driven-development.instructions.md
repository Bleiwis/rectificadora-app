---
applyTo: "**"
---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each: spec compliance review first, then code quality review.

**Why subagents:** You delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused and succeed at their task. They should never inherit your session's context or history — you construct exactly what they need. This also preserves your own context for coordination work.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration

**Continuous execution:** Do not pause to check in with your human partner between tasks. Execute all tasks from the plan without stopping. The only reasons to stop are: BLOCKED status you cannot resolve, ambiguity that genuinely prevents progress, or all tasks complete. "Should I continue?" prompts and progress summaries waste their time — they asked you to execute the plan, so execute it.

## Modo de ejecución (lectura del campo)

Al arrancar, localiza el plan activo (`docs/plans/*-plan.md` de la rama actual) y lee su línea `**Modo de ejecución:**`:

- Ausente o `interactivo` → modo interactivo (default): comportamiento estándar de este skill.
- `desatendido` → aplica la sección **Modo desatendido** de este skill.
- Cualquier otro valor → trátalo como `interactivo` y avisa al usuario: "Valor inválido en `Modo de ejecución`: `<valor>` — usando modo interactivo."

El modo desatendido quita pausas, no controles: los gates (sensor, ledger, reconciliation, anti-bias, drift plan-vs-código) corren idénticos en ambos modos.

### Modo desatendido

La ejecución continua entre tareas es el comportamiento default en AMBOS modos (no cambia). WHEN el modo es `desatendido`, lo único que cambia es la TERMINATION_PHASE: no preguntes al usuario si continuar con el cierre — devuelve el control al orquestador, que rutea la fase siguiente automáticamente. IF un subagente reporta BLOCKED irresoluble o hay ambigüedad que impide el progreso, THEN detente y escala al usuario igual que en modo interactivo — BLOCKED nunca se salta.

## Modo journal-first (continuidad durable — opt-in)

<!-- AWM-INTEGRATION: subagent-journal-gate -->

WHEN el proyecto tiene journal inicializado (`<repo>/.awm/journal/<rama>/state.json`
existe — se crea con `awm watch --init`), el controlador opera journal-first.
IF el journal NO está inicializado, THEN este modo entero NO aplica: el skill se
comporta exactamente como está descrito en el resto del documento, sin cambios
(el flujo default de Claude Code es intocable).

Con journal inicializado:

1. **Apertura de turno:** correr `awm job reconcile` y leer `next_action` del
   journal ANTES de cualquier otra cosa. El journal es la autoridad del punto
   de continuación — nunca la memoria conversacional.
2. **Registro antes de acción:** cada tarea/despacho/ReviewObligation se
   registra vía `awm job register --generation <token> --entity <kind> --json
   <payload>` ANTES de ejecutarse (el token de generación lo entrega el
   supervisor en el prompt de lanzamiento). El plan de ciclo se registra con
   `--entity cycle-plan`. El Verdict se registra con `awm job verdict` al
   RECIBIRSE el reporte del revisor — nunca antes.
3. **Heartbeat:** emitir `awm job controller-heartbeat --generation <token>` al
   completar cada paso del protocolo (despacho enviado, reporte recibido, task
   marcada). Importante: el silencio de heartbeat + inactividad de proceso
   NUNCA autorizan el relevo por si solos — el supervisor solo releva cuando
   además su adapter emite la señal POSITIVA `safeToReplace`; sin esa señal el
   ciclo queda BLOCKED en custodia, sin matar nada.
4. **Verificaciones mecánicas:** pedirlas con
   `awm job request --generation <token> --satisfies <itemId> -- <comando>` —
   NUNCA ejecutarlas inline en providers donde el proceso muere con el turno.
   El supervisor las corre vía exec-wrapper (claim durable) y el resultado
   aparece en el journal (`awm job ps`).
5. **Cierre:** `awm job gate` es el interlock — exit != 0 significa que hay
   trabajo pendiente, obligaciones sin verdict `pass`, evidencia con
   fingerprint no vigente, fixes abiertos o corrupción: NO se cierra el ciclo.
   Solo con gate verde se declara COMPLETE.

## Track mode (authenticated worktree only)

<!-- AWM-INTEGRATION: track-mode -->

WHEN `<repo>/.awm/track.json` exists, first authenticate it through
`awm track status`. If authentication fails, stop; never infer track mode from
the directory name. Read assignment only from the local journal's
`trackContext.taskIds`; do not derive it again from the plan and do not read
dynamic state from sibling tracks.

Before acting on a task, verify its id belongs to `trackContext.taskIds` and
the current plan digest equals `trackContext.planDigest`. A mismatch is
BLOCKED. In track mode use `computeTrackGate` through `awm job gate`; it covers
local tasks, reviews, fixes, and declared local verification only.

In track mode:

- DO NOT modify the plan: no checkboxes, reconciliation edits, QA markers, or
  retro markers.
- DO NOT invoke `post-implementation-qa`; global QA belongs to the plan
  supervisor after every track is `MERGED_UNVERIFIED`.
- Commit all owned changes and leave worktree/index clean before requesting
  `awm track join <trackId>`.
- A join request freezes the track. After requesting it, do not dispatch or
  mutate until the plan supervisor reports the result.

## When to Use

```dot
digraph when_to_use {
    "Have implementation plan?" [shape=diamond];
    "Tasks mostly independent?" [shape=diamond];
    "Stay in this session?" [shape=diamond];
    "subagent-driven-development" [shape=box];
    "executing-plans" [shape=box];
    "Manual execution or brainstorm first" [shape=box];

    "Have implementation plan?" -> "Tasks mostly independent?" [label="yes"];
    "Have implementation plan?" -> "Manual execution or brainstorm first" [label="no"];
    "Tasks mostly independent?" -> "Stay in this session?" [label="yes"];
    "Tasks mostly independent?" -> "Manual execution or brainstorm first" [label="no - tightly coupled"];
    "Stay in this session?" -> "subagent-driven-development" [label="yes"];
    "Stay in this session?" -> "executing-plans" [label="no - parallel session"];
}
```

**vs. Executing Plans (parallel session):**
- Same session (no context switch)
- Fresh subagent per task (no context pollution)
- Two-stage review after each task: spec compliance first, then code quality
- Faster iteration (no human-in-loop between tasks)

## The Process

```dot
digraph process {
    rankdir=TB;

    subgraph cluster_per_task {
        label="Per Task";
        "Dispatch implementer subagent (./implementer-prompt.md)" [shape=box];
        "Implementer subagent asks questions?" [shape=diamond];
        "Answer questions, provide context" [shape=box];
        "Implementer subagent implements, tests, commits, self-reviews" [shape=box];
        "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)" [shape=box];
        "Spec reviewer subagent confirms code matches spec?" [shape=diamond];
        "Implementer subagent fixes spec gaps" [shape=box];
        "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" [shape=box];
        "Code quality reviewer subagent approves?" [shape=diamond];
        "Implementer subagent fixes quality issues" [shape=box];
        "Mark the matching task-plan item complete" [shape=box];
    }

    "Read plan, extract all tasks with full text, note context, create the task plan" [shape=box];
    "More tasks remain?" [shape=diamond];
    "Dispatch final code reviewer subagent for entire implementation" [shape=box];
    "STOP: Return control to orchestrator" [shape=doublecircle];

    "Read plan, extract all tasks with full text, note context, create the task plan" -> "Dispatch implementer subagent (./implementer-prompt.md)";
    "Dispatch implementer subagent (./implementer-prompt.md)" -> "Implementer subagent asks questions?";
    "Implementer subagent asks questions?" -> "Answer questions, provide context" [label="yes"];
    "Answer questions, provide context" -> "Dispatch implementer subagent (./implementer-prompt.md)";
    "Implementer subagent asks questions?" -> "Implementer subagent implements, tests, commits, self-reviews" [label="no"];
    "Implementer subagent implements, tests, commits, self-reviews" -> "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)";
    "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)" -> "Spec reviewer subagent confirms code matches spec?";
    "Spec reviewer subagent confirms code matches spec?" -> "Implementer subagent fixes spec gaps" [label="no"];
    "Implementer subagent fixes spec gaps" -> "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)" [label="re-review"];
    "Spec reviewer subagent confirms code matches spec?" -> "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" [label="yes"];
    "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" -> "Code quality reviewer subagent approves?";
    "Code quality reviewer subagent approves?" -> "Implementer subagent fixes quality issues" [label="no"];
    "Implementer subagent fixes quality issues" -> "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" [label="re-review"];
    "Code quality reviewer subagent approves?" -> "Mark the matching task-plan item complete" [label="yes"];
    "Mark the matching task-plan item complete" -> "More tasks remain?";
    "More tasks remain?" -> "Dispatch implementer subagent (./implementer-prompt.md)" [label="yes"];
    "More tasks remain?" -> "Dispatch final code reviewer subagent for entire implementation" [label="no"];
    "Dispatch final code reviewer subagent for entire implementation" -> "STOP: Return control to orchestrator";
}
```

## Model Selection

Use the least powerful model that can handle each role to conserve cost and increase speed.

**Mechanical implementation tasks** (isolated functions, clear specs, 1-2 files): use a fast, cheap model. Most implementation tasks are mechanical when the plan is well-specified.

**Integration and judgment tasks** (multi-file coordination, pattern matching, debugging): use a standard model.

**Architecture, design, and review tasks**: use the most capable available model.

**Task complexity signals:**
- Touches 1-2 files with a complete spec → cheap model
- Touches multiple files with integration concerns → standard model
- Requires design judgment or broad codebase understanding → most capable model

**Reviewer model/role separation (anti-bias, tier).** Fresh context attenuates but does not neutralize self-preference bias — it lives in the weights and survives blinding. For critical-correction review tasks, dispatch the reviewer in a *different model family* from the implementer when the harness can; otherwise at least give it a distinct role/prompt and withhold the implementer's chain-of-thought. Where model separation isn't available, lean harder on the deterministic gate (`awm sensors run`, tests) — the only defense that neutralizes the bias rather than just attenuating it. Do NOT turn this into same-model debate: at equal compute it does not beat self-consistency.

## Handling Implementer Status

Implementer subagents report one of four statuses. Handle each appropriately:

**DONE:** Proceed to spec compliance review.

**DONE_WITH_CONCERNS:** The implementer completed the work but flagged doubts. Read the concerns before proceeding. If the concerns are about correctness or scope, address them before review. If they're observations (e.g., "this file is getting large"), note them and proceed to review.

**NEEDS_CONTEXT:** The implementer needs information that wasn't provided. Provide the missing context and re-dispatch.

**BLOCKED:** The implementer cannot complete the task. Assess the blocker:
1. If it's a context problem, provide more context and re-dispatch with the same model
2. If the task requires more reasoning, re-dispatch with a more capable model
3. If the task is too large, break it into smaller pieces
4. If the plan itself is wrong, escalate to the human

**Never** ignore an escalation or force the same model to retry without changes. If the implementer said it's stuck, something needs to change.

## Sensor Gate (AWM)

<!-- AWM-INTEGRATION: subagent-sensor-gate -->

If the repo has `.awm/sensors.json`, a task is **not complete** until sensors pass — `typecheck`/`test`/`build` alone are not sufficient. Subagents run in isolated context and only do what their prompt says, so the gate must be enforced at two points:

1. **In the implementer prompt:** the implementer runs `awm sensors run` (no flag — all sensors) before reporting DONE and fixes any **new** findings (`newCount`). The implementer prompt template already includes this step.
2. **At the controller, before marking the task complete:** after the code quality review approves, confirm sensor evidence exists. If the implementer's report doesn't show a clean `awm sensors run`, do not mark complete — send it back. Trust-but-verify: `awm sensors run` is cheap and authoritative.

**Pitfall — do not use `awm sensors run --slow` as the gate.** `--slow` runs only `semgrep`/`mutation` and skips `lint`/`typecheck`, where most new findings surface. The completion gate is the full run (no flag).

**Recurring sensor failure** (same `name` + `rule` as a prior session) → invoke `harness-retro` instead of just fixing it.

## Ledger Gate (AWM)

<!-- AWM-INTEGRATION: subagent-ledger-gate -->

The per-branch ledger (`awm ledger`) is what `harness-retro` learns from. Reviewer subagents emit `awm ledger add` per finding and per win — but only if their prompt tells them to. Subagents run in isolated context and only do what their prompt says, so the gate must be enforced at two points:

1. **In the reviewer prompts:** the `awm ledger add` instruction lives in `./spec-reviewer-prompt.md` and `./code-quality-reviewer-prompt.md`. Dispatch prompts MUST be constructed from these templates — read the template file and inject the task-specific context into it. An inline prompt written from memory silently drops the ledger instruction (this happened: a full SDD+QA cycle produced findings but a 0-entry ledger, and the retro had nothing to learn from).
2. **At the controller, before marking the task complete:** if a reviewer reported findings or wins, run `awm ledger list` and confirm the ledger grew accordingly. If the reviewer's report shows issues but the ledger has no matching entries, send the reviewer back to emit them. Trust-but-verify: `awm ledger list` is cheap and authoritative.

A clean review with genuinely zero findings and zero wins is the only case where no ledger growth is acceptable.

**Typed defect classes:** reviewer templates may append `--defect-class <exact-catalog-id>` only when the finding maps to an exact class in the active sensor-pack coverage catalog. Omit the flag when the class is not known; a reviewer must never infer one from prose, signatures, or a nearby category.

## Design Fidelity Propagation Gate (AWM)

<!-- AWM-INTEGRATION: subagent-design-gate -->

If the plan task declared `**Skills:**` or `**Design artifacts:**`, this is not complete until the implementer's report shows real engagement with both — matching the pattern of the Sensor and Ledger gates above.

1. **In the implementer prompt:** the Required Skills and Design Artifacts sections already instruct the implementer to invoke declared skills and confirm design elements before reporting DONE, populating the report's new `design:` field.
2. **At the controller, before marking the task complete:**
   - **Design artifacts:** if the task declared `**Design artifacts:**` and the report's `design:` field is missing, or blank, or contradicts the diff (e.g. says "3/3 confirmed" but the diff shows no corresponding UI changes), do not mark the task complete — send it back.
   - **Skills:** if the task declared `**Skills:**`, check `concerns` for either failure mode the implementer prompt instructs it to report: (a) the native skill-loading mechanism being unavailable in its harness, or (b) a declared skill not being installed. If neither is flagged, but the diff shows no evidence any declared skill's guidance was actually followed (e.g. a `frontend-craft` requirement with no sign of anti-slop/typography/color rules applied in the diff), do not mark the task complete — send it back for the implementer to confirm which skills were invoked and how.

## Reconciliation Gate (AWM)

<!-- AWM-INTEGRATION: subagent-reconciliation-gate -->

**Every subagent return is a compaction boundary for the controller.** You do not see the subagent's context — only its summary report. A summary can silently omit what the subagent skipped, misread, or left open, exactly the way a context compaction drops state. So treat the return like a post-compaction event: reconcile against the durable, file-derived truth before marking the task complete.

Before marking a task complete, the controller reconciles the subagent's report against:
1. The task's requirement IDs in the plan — is each one actually implemented and tested in the diff, not just claimed in the report?
2. Open `- [ ]` items in the active plan — did the report close what it claimed?
3. `awm ledger list` — do the findings/wins the report mentions actually exist as entries?
4. The task's `**Skills:**` / `**Design artifacts:**` declarations — does the report's `design:` field and diff satisfy the Design Fidelity Propagation Gate above?

If the report and the file-derived state disagree, the **files win** — send the task back, do not mark complete on the strength of the summary alone. (This is the per-subagent counterpart of the deterministic SessionStart re-anchor that recovers the main agent's state after a compaction.)

## Prompt Templates

Dispatch prompts are **built from these templates, not written from memory** — read the template file and inject context into its structure. The templates carry mandatory instructions (sensor gate, ledger emission) that inline prompts silently lose.

- `./implementer-prompt.md` - Dispatch implementer subagent
- `./spec-reviewer-prompt.md` - Dispatch spec compliance reviewer subagent
- `./code-quality-reviewer-prompt.md` - Dispatch code quality reviewer subagent

When the plan task declares `**Skills:**` or `**Design artifacts:**`, copy both fields verbatim into the corresponding template sections (Required Skills / Design Artifacts). Omit the sections for tasks that do not declare them.

## Example Workflow

```
You: I'm using Subagent-Driven Development to execute this plan.

[Read plan file once: docs/plans/feature-plan.md]
[Extract all 5 tasks with full text and context]
[Create the task plan with one item per task]

Task 1: Hook installation script

[Get Task 1 text and context (already extracted)]
[Dispatch implementation subagent with full task text + context]

Implementer: "Before I begin - should the hook be installed at user or system level?"

You: "User level (~/.config/superpowers/hooks/)"

Implementer: "Got it. Implementing now..."
[Later] Implementer:
  - Implemented install-hook command
  - Added tests, 5/5 passing
  - Self-review: Found I missed --force flag, added it
  - Committed

[Dispatch spec compliance reviewer]
Spec reviewer: ✅ Spec compliant - all requirements met, nothing extra

[Get git SHAs, dispatch code quality reviewer]
Code reviewer: Strengths: Good test coverage, clean. Issues: None. Approved.

[Mark Task 1 complete]

Task 2: Recovery modes

[Get Task 2 text and context (already extracted)]
[Dispatch implementation subagent with full task text + context]

Implementer: [No questions, proceeds]
Implementer:
  - Added verify/repair modes
  - 8/8 tests passing
  - Self-review: All good
  - Committed

[Dispatch spec compliance reviewer]
Spec reviewer: ❌ Issues:
  - Missing: Progress reporting (spec says "report every 100 items")
  - Extra: Added --json flag (not requested)

[Implementer fixes issues]
Implementer: Removed --json flag, added progress reporting

[Spec reviewer reviews again]
Spec reviewer: ✅ Spec compliant now

[Dispatch code quality reviewer]
Code reviewer: Strengths: Solid. Issues (Important): Magic number (100)

[Implementer fixes]
Implementer: Extracted PROGRESS_INTERVAL constant

[Code reviewer reviews again]
Code reviewer: ✅ Approved

[Mark Task 2 complete]

...

[After all tasks]
[Dispatch final code-reviewer]
Final reviewer: All requirements met, ready to merge
```

## <TERMINATION_PHASE>

**Track mode exception:** if this run is in an authenticated track worktree
(per the "Track mode" section above — `.awm/track.json` exists and was
authenticated via `awm track status`), do NOT invoke `post-implementation-qa`
here; that section already governs termination for this case (commit, clean
worktree, request `awm track join <trackId>`, then stop and wait for the plan
supervisor). Everything below applies to the non-track-mode case only.

Once all tasks are complete and the final code review is approved, you have **one mandatory step before stopping**: invoke `post-implementation-qa`.

> **Why not skip it:** The final code reviewer within this skill checks code quality. `post-implementation-qa` checks Track A fidelity (plan-vs-implementation, ID-driven) and Track B quality (robustness/logic/tests lenses) — a different review class that this skill's code reviewer does not perform. Skipping it means the branch reaches `finishing-a-development-branch` without a plan-vs-implementation audit.

Your sequence — execute steps 1-2 in order, then branch by mode at step 3:
1. **Invoke `post-implementation-qa`** with the active platform's native skill-loading mechanism. It runs inline in this session: it reads the plan, diffs the branch, dispatches its own review subagent, runs the fix loop if needed, and adds `<!-- awm-qa-complete -->` to the plan. Let it complete fully before continuing.
2. After QA completes, report a summary of all implemented tasks and the QA verdict.
3. Then, depending on the plan's `**Modo de ejecución:**` field (mutually exclusive — apply only the one that matches):
   - **Modo interactivo:** Ask the user: *"Do you want to continue with the branch-closing phase? If you use `development-process`, the orchestrator will evaluate the project state and propose the next step."* Wait for confirmation.
   - **Modo desatendido** (el plan declara `**Modo de ejecución:** desatendido`): omite la pregunta — anuncia que la ejecución terminó y devuelve el control al orquestador (`development-process`), que rutea automáticamente.
4. In both modes: do NOT invoke `finishing-a-development-branch` directly from this skill.

## Advantages

**vs. Manual execution:**
- Subagents follow TDD naturally
- Fresh context per task (no confusion)
- Parallel-safe (subagents don't interfere)
- Subagent can ask questions (before AND during work)

**vs. Executing Plans:**
- Same session (no handoff)
- Continuous progress (no waiting)
- Review checkpoints automatic

**Efficiency gains:**
- No file reading overhead (controller provides full text)
- Controller curates exactly what context is needed
- Subagent gets complete information upfront
- Questions surfaced before work begins (not after)

**Quality gates:**
- Self-review catches issues before handoff
- Two-stage review: spec compliance, then code quality
- Review loops ensure fixes actually work
- Spec compliance prevents over/under-building
- Code quality ensures implementation is well-built

**Cost:**
- More subagent invocations (implementer + 2 reviewers per task)
- Controller does more prep work (extracting all tasks upfront)
- Review loops add iterations
- But catches issues early (cheaper than debugging later)

## Red Flags

**Never:**
- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text instead)
- Dispatch an implementer or reviewer with an inline prompt written from memory (build it from the prompt template — inline prompts drop the sensor/ledger instructions)
- Mark a task complete when the reviewer reported findings/wins but `awm ledger list` shows no matching entries
- Skip scene-setting context (subagent needs to understand where task fits)
- Ignore subagent questions (answer before letting them proceed)
- Accept "close enough" on spec compliance (spec reviewer found issues = not done)
- Skip review loops (reviewer found issues = implementer fixes = review again)
- Let implementer self-review replace actual review (both are needed)
- **Start code quality review before spec compliance is ✅** (wrong order)
- Move to next task while either review has open issues

**If subagent asks questions:**
- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**
- Implementer (same subagent) fixes them
- Reviewer reviews again
- Repeat until approved
- Don't skip the re-review

**If subagent fails task:**
- Dispatch fix subagent with specific instructions
- Don't try to fix manually (context pollution)

## Integration

**Required workflow skills:**
- **using-git-worktrees** - Ensures isolated workspace (creates one or verifies existing)
- **writing-plans** - Creates the plan this skill executes
- **requesting-code-review** - Code review template for reviewer subagents
- **verification-before-completion** - Defines what "done" requires, including the AWM sensor gate (`awm sensors run`). The controller applies this before marking each task — and the whole plan — complete. <!-- AWM-INTEGRATION: subagent-sensor-gate -->
- **finishing-a-development-branch** - Invoked by the orchestrator (`development-process`) in the next phase, NOT automatically by this skill

**Subagents should use:**
- **test-driven-development** - Subagents follow TDD for each task
- **verification-before-completion** - Run `awm sensors run` (when `.awm/sensors.json` exists) before reporting DONE

**Alternative workflow:**
- **executing-plans** - Use for parallel session instead of same-session execution
