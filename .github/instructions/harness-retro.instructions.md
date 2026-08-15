---
applyTo: "**"
---

# Harness Retro

## Overview

`harness-retro` is the terminal learning phase of `development-process`. It reads the branch ledger accumulated during the session (populated by SDD reviewers, post-qa, sensors, and debugging phases), presents every item to the user interactively, and cures the approved ones into the remediation tree or existing delivered docs.

**Announce at start:** "I'm using the harness-retro skill to review this session's findings and cure them into the harness."

**Core principle:** Add the rule to the harness, not the fix to the symptom.

**Source of truth:** the per-branch ledger at `.awm/ledger/<branch>.jsonl`, populated during the session by the review/QA/sensor/debugging phases. harness-retro reads it; it does not ask you to remember prior occurrences.

## When to use

- Automatically: `development-process` routes here after `post-implementation-qa` completes and `awm-qa-complete` is present but `awm-retro-complete` is absent.
- Manually: the user invokes it directly ("do a retro on this session", "we keep seeing X, do a retro").

## When NOT to use

- The ledger is empty, there are no manual observations, **and the session genuinely produced zero findings** — exit fast and add the `awm-retro-complete` marker.

**Empty-ledger consistency check (mandatory before fast-exit):** an empty ledger is only legitimate if nothing was found during the cycle. Cross-check against the session evidence: did the spec/quality reviewers report issues? Did `post-implementation-qa` present findings (Track A/B in the plan or QA report)? If findings were reported anywhere but the ledger is empty, the learning pipeline is broken — **that IS the retro finding**. Do not fast-exit: trace where the `awm ledger add` instruction was dropped (inline prompt instead of template? missing gate?), cure the gap in the responsible skill, and log it. An empty ledger after a cycle with findings is contradictory evidence, never a clean bill.

## Modo de ejecución (lectura del campo)

Al arrancar, localiza el plan activo (`docs/plans/*-plan.md` de la rama actual) y lee su línea `**Modo de ejecución:**`:

- Ausente o `interactivo` → modo interactivo (default): comportamiento estándar de este skill.
- `desatendido` → aplica la sección **Modo desatendido** de este skill.
- Cualquier otro valor → trátalo como `interactivo` y avisa al usuario: "Valor inválido en `Modo de ejecución`: `<valor>` — usando modo interactivo."

El modo desatendido quita pausas, no controles: los gates (sensor, ledger, reconciliation, anti-bias, drift plan-vs-código) corren idénticos en ambos modos.

### Modo desatendido

WHEN el modo es `desatendido`, el paso 3 del checklist no presenta ítem por ítem. Unattended mode uses only existing triage rules; it records any recommendation that needs new authority instead of applying it.

- **Triage existing remedies only** for findings that are recurrent (`awm ledger recurring --min 2`), `blocker` severity, or systemic (the same pattern in ≥2 files/tasks).
- **Record** every proposed new remedy or unauthorized change in `docs/harness-retros.md` as a recommendation; do not apply it without authority.
- **Discard** the remainder without asking, documenting each dismissal and its reason in `docs/harness-retros.md` (section "Descartes").
- The remaining steps run identically: classify, draft only an authorized rule, cure (merge-and-prune), apply, **verify the rule fires**, commit, log, archive, and add the marker.

## Checklist

You MUST create a task for each item and complete them in order:

1. **Read the session ledger** — run `awm ledger list` and `awm ledger recurring --min 2`; summarize findings + wins for the user
2. **Read empirical coverage** — run `awm sensors coverage --json` after the ledger. Coverage is read-only: it reports outcomes and does not apply remedies or mutate the project.
3. **Present each item interactively** — present ledger findings, wins, and coverage outcomes; for each remedy, the human decides: structuralize, record as AGENTS.md lesson, or dismiss
4. **Classify each approved item** — structural / logic / process / security
5. **Draft the rule** — actual lint/test/constitution/semgrep/AGENTS.md text
6. **Cure, don't append raw** — when writing to CONSTITUTION.md or AGENTS.md: merge the new lesson into the relevant existing section and drop entries that no longer apply (merge-and-prune, never append raw)
7. **Apply the authorized rule** — edit the target file
8. **Verify the rule fires** (for sensor rules) — manufacture the failure, run the sensor, confirm it catches it
9. **Commit** the rules
10. **Log the retro** — append to `docs/harness-retros.md`
11. **Close the retro** — run `awm ledger archive` and add the `awm-retro-complete` marker

## The remediation tree

```
Session finding
├── structural / security / logic (sensor-catchable)
│   └── remediation tree: eslint.config.awm.mjs / .semgrep.awm.yml / tests/structural/
├── process (project rule)
│   └── CONSTITUTION.md
└── agent working-style + wins
    └── AGENTS.md
```

**Two-tier curation targets:**

| Class | Cured target (existing, delivered) |
|---|---|
| structural / security / logic (sensor-catchable) | remediation tree: `eslint.config.awm.mjs` / `.semgrep.awm.yml` / `tests/structural/` |
| process (project rule) | `CONSTITUTION.md` |
| agent working-style + **wins** | `AGENTS.md` |

Wins (`polarity: win`) are reinforced as short "what works here" notes in `AGENTS.md`. Agent-style lessons land in `AGENTS.md` (agnostic — every agent reads it), never `CLAUDE.md`.

### Classification heuristics

| Symptom | Class | Why |
|---|---|---|
| Type/shape error caught by reading the code | structural | The compiler/linter should reject it without running tests |
| Logic error only caught when code runs | logic | Behavioral; needs a test that exercises the path |
| "We always forget to do X before Y" | process | Human discipline; rule belongs in CONSTITUTION.md |
| Pattern that creates a vulnerability (eval, unsanitized SQL, etc.) | security | Semgrep / dataflow rule |
| Agent working-style lesson or win | agent | Notes in AGENTS.md |

If the bug straddles two classes, pick the one that fails *earliest* in the loop — earlier = cheaper.

## The Process

### 1. Read the session ledger

Run these two commands:

```bash
awm ledger list
awm ledger recurring --min 2
```

`awm ledger list` shows all findings and wins recorded during the session.
`awm ledger recurring --min 2` groups by `signature` and shows clusters where the same issue appeared ≥2 times — this is a **signal** to weigh when deciding whether to structuralize, not a hard gate. You may structuralize a single high-impact finding (`count: 1`), or defer a recurring trivial one. The user decides per item.

Summarize for the user: total findings, total wins, recurring clusters (if any).

### 2. Read empirical coverage

Run the coverage command exactly once, after reading the active ledger and before triage or archive. Treat its static and empirical outcomes as evidence for the retrospective; it is read-only and never grants authority to apply a remedy.

### 3. Present each item interactively

Present every ledger item — findings AND wins — grouped by signature with its recurrence count. For each, wait for an explicit user decision:

- **Structuralize** → which target (remediation tree / CONSTITUTION.md / AGENTS.md)?
- **Record as AGENTS.md lesson/win** → reinforcing working patterns
- **Dismiss** → note the reason and move on

**Modo interactivo:** the human decides each remedy after seeing the coverage outcomes. Do not apply anything without explicit user approval per item. Do not batch-apply.

**Modo desatendido:** aplica el triage con criterio propio definido en la sección "Modo desatendido" — sin aprobación por ítem, con descartes documentados.

### 4. Classify

Apply the heuristics from the table above. State the classification out loud:

> "Classifying as `logic` because the bug only surfaced when the function ran against an empty input — a static check wouldn't have caught it."

### 5. Draft the rule

Write the actual rule, not a description. Examples by class:

**structural (ESLint):**
```js
// eslint.config.awm.mjs — added rule
{
  rules: {
    'no-restricted-syntax': ['error', {
      selector: "CallExpression[callee.name='setTimeout'][arguments.length=1]",
      message: 'setTimeout requires an explicit delay argument.',
    }],
  },
}
```

**logic (structural test):**
```ts
// tests/structural/no-implicit-any-fallback.test.ts
import { parseConfig } from '../../src/config';

test('parseConfig returns explicit error on empty input', () => {
  expect(() => parseConfig('')).toThrow(/empty config/);
});
```

**process (CONSTITUTION.md):**
```markdown
## Process
- Before invoking a destructive Bash command (rm, drop, truncate), MUST confirm with the user when not in CI.
```

**security (Semgrep):**
```yaml
# .semgrep.awm.yml — added rule
- id: no-eval-on-user-input
  pattern: eval($USER_INPUT)
  message: eval() on user input — use a parser/validator instead.
  severity: ERROR
  languages: [javascript, typescript]
```

**agent lesson/win (AGENTS.md):**
```markdown
## What works here
- Staging files individually (not `git add -A`) prevents accidental secret inclusion — confirmed pattern across multiple sessions.
```

### 6. Cure, don't append raw

When writing to `CONSTITUTION.md` or `AGENTS.md`, **merge and prune**: fold the new lesson into the relevant existing section and drop entries that no longer apply. These docs are delivered every session — keep them a curated index, not an append-only log, so context never saturates.

**On its own this instruction does not hold.** Measured on a real repo, `AGENTS.md` went 73KB → 141KB
across **45 revisions and never shrank once**, while this exact rule was already in force. Curing is an
append; pruning is a judgement call nobody is forced to make, so the append wins every time. Treat the
rule as necessary but not sufficient.

**Report the growth here. Do not gate on it here.** This skill is the terminal phase of the run, and
that run is often unattended — the user is asleep and expects a finished PR in the morning. A budget
check that fails at this point strands exactly that: nobody is present to prune, and the work stops one
step from done. The enforcement point is the **Context Budget Gate at the end of `writing-plans`**, the
last moment a human is guaranteed to be there.

So after applying a lesson, measure and record — never block:

```bash
awm context-budget --json    # read the numbers; do NOT treat exit 1 as a stop here
```

Put the delta in the retro log entry (step 9): what these files weighed before, what they weigh now, and
which entries you dropped. That is what makes the growth visible at the next plan gate, where someone can
act on it. A retro that added 3KB and pruned nothing is not a failure — it is a line in the log that the
next `writing-plans` will surface while the user is present.

### 7. Apply

Use the native file-editing mechanism to add the rule to the target file. If the file doesn't exist (e.g. `tests/structural/` is new), create it and any required scaffolding.

### 8. Verify the rule fires

For sensor-catchable rules (structural, logic, security), manufacture the original failure and confirm the sensor catches it:

```bash
awm sensors run    # for tsc/eslint rules
npm test -- tests/structural   # for structural tests
```

Expected: the sensor fails on the manufactured case. Then revert and re-run — sensors should pass cleanly.

### 9. Commit

```bash
git add <changed-files>
git commit -m "harness-retro: <class> rule for <issue summary>"
```

### 10. Log the retro

Append (or create) `docs/harness-retros.md`:

```markdown
## YYYY-MM-DD — <one-line issue>

- **Class:** structural | logic | process | security | agent
- **Occurrences (ledger count):** N
- **Rule:** path:line of the new rule
- **Sensor:** which sensor catches it (typecheck | lint | security | structural-test | constitution | agents-md)
- **Descartes (modo desatendido):** <signature — razón> | ninguno
```

### 11. Close the retro

Run `awm ledger archive` to rotate this branch's ledger out of the active flow (it stays on disk under `.awm/ledger/archive/` for audit; the next plan starts fresh):

```bash
awm ledger archive
```

Then add the `awm-retro-complete` marker to the active plan (first line after the `#` header), so `development-process` routes to `finishing-a-development-branch`:

```markdown
<!-- awm-retro-complete: YYYY-MM-DD -->
```

## Anti-patterns

- **Asking "where did this fail before?" instead of reading the ledger.** The ledger has the answer — use `awm ledger list` and `awm ledger recurring`.
- **Treating recurrence count as a hard gate.** Count is a signal to weigh, not a threshold to pass. A single high-severity finding may be worth structuralizing. (Modo desatendido usa recurrencia/severidad/sistemicidad como criterio mecánico de triage por diseño — ver sección "Modo desatendido" — pero eso no lo convierte en gate único: cualquiera de los tres es suficiente, y `blocker` o sistémico solos también curan.)
- **Drafting a "philosophical" rule instead of an enforceable one.** "Code should be readable" is a wish, not a rule.
- **Replacing the regression test with the harness rule.** Both should exist — the test asserts the specific case is fixed, the rule prevents the class of cases from returning.
- **Letting AI write the logic structural test.** The skill drafts, the human owns approval. (Modo desatendido es la excepción documentada: el agente aplica sin aprobación por ítem — ver sección "Modo desatendido" — pero conserva el paso de verificación que la regla dispara antes de comitear.)
- **Appending raw entries to CONSTITUTION.md / AGENTS.md** without merging/pruning — these docs are delivered every session and must stay bounded.
- **Curating agent-style lessons into CLAUDE.md.** Agent lessons and wins go to `AGENTS.md` (every agent reads it), never `CLAUDE.md` (Claude-specific).
- **Skipping the `awm ledger archive` step.** The next session should start with a clean ledger; always archive before closing.
- **Fast-exiting on an empty ledger without the consistency check.** If reviewers or QA reported findings during the cycle, an empty ledger means the emission pipeline broke — trace and cure it; don't declare "nothing to learn".

## Integration with other skills

| Skill | How it feeds harness-retro |
|---|---|
| `subagent-driven-development` spec-reviewer | Emits `awm ledger add --polarity finding|win` per spec gap / win |
| `subagent-driven-development` code-quality-reviewer | Emits `awm ledger add` per quality issue / win |
| `post-implementation-qa` deep-review | Emits `awm ledger add` per Track A (`class: proceso`) / Track B (`class: seguridad\|logica\|tests`) finding / win |
| `verification-before-completion` | Emits `awm ledger add` on recurring sensor failure |
| `systematic-debugging` | Emits `awm ledger add` on confirmed root cause |
| `development-process` | Routes to harness-retro after QA; requires `awm-retro-complete` to proceed to finishing |
