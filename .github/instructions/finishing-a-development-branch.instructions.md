---
applyTo: "**"
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Present options → Execute choice → Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## Modo de ejecución (lectura del campo)

Al arrancar, localiza el plan activo (`docs/plans/*-plan.md` de la rama actual) y lee su línea `**Modo de ejecución:**`:

- Ausente o `interactivo` → modo interactivo (default): comportamiento estándar de este skill.
- `desatendido` → aplica la sección **Modo desatendido** de este skill.
- Cualquier otro valor → trátalo como `interactivo` y avisa al usuario: "Valor inválido en `Modo de ejecución`: `<valor>` — usando modo interactivo."

El modo desatendido quita pausas, no controles: los gates (sensor, ledger, reconciliation, anti-bias, drift plan-vs-código) corren idénticos en ambos modos.

### Modo desatendido

WHEN el modo es `desatendido` AND los tests del Step 1 pasan: omite el menú del Step 3 y ejecuta directamente la **Opción 2 (Push and Create PR/MR)**, que corre primero el Step 3.5 (detección de host) y luego el Step 4.0 (retiro de artefactos de diseño) automáticamente, sin prompt. IF los tests fallan, THEN detente y reporta los fallos sin pushear ni crear el PR/MR — igual que en modo interactivo; tests rojos son una pausa legítima que ningún modo salta. La **Opción 4 (Discard)** NUNCA está disponible en modo desatendido: descartar trabajo es una acción destructiva que siempre requiere a un humano.

**El push siempre corre; el PR/MR es best-effort.** Si `$HOST=unknown` (o el host es reconocido pero su CLI no está instalado), la Opción 2 degrada a "push + instrucciones para abrir el PR/MR a mano" — ese es un resultado **final y válido** del modo desatendido, no un fallo. El skill nunca debe: (a) bloquear/escalar porque no pudo crear el PR/MR, ni (b) terminar en silencio sin decir que el PR/MR no se creó. El reporte final del modo desatendido siempre debe indicar explícitamente si el PR/MR se creó o si quedó pendiente de creación manual.

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR/MR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 3: Present Options

**Modo desatendido:** no presentes el menú — ejecuta directamente la Opción 2 (Push and Create PR/MR) del Step 4 (que corre el Step 3.5 de detección de host y el Step 4.0 de retiro de artefactos primero) y continúa con el cleanup del Step 5. La Opción 4 (Discard) no existe en este modo. Recordá: si la creación del PR/MR degrada (host desconocido o CLI ausente), el push + instrucciones manuales sigue siendo un cierre válido de la Opción 2 — no un fallo que deba escalarse.

**Modo interactivo:** present exactly these 4 options:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a PR/MR
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Don't add explanation** - keep options concise.

### Step 3.5: Detect Git Host

**Runs before any git operation in Step 4** (both Option 1 and Option 2 potentially care which host is in play, though only Option 2 branches on it today).

```bash
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
case "$REMOTE_URL" in
  *github.com*) HOST=github ;;
  *gitlab*)     HOST=gitlab ;;
  *)            HOST=unknown ;;
esac
```

- `HOST=github` → use `gh` (GitHub CLI).
- `HOST=gitlab` → use `glab` (GitLab CLI), if installed.
- `HOST=unknown` → no host CLI applies, or the CLI isn't installed even when the host is recognized (e.g. `gitlab` but no `glab` binary): degrade honestly — see Option 2 below. This is never a hard failure.

### Step 4: Execute Choice

#### Step 4.0: Retire design artifacts (Options 1 & 2 only)

**Runs only on the integration paths (Option 1 Merge, Option 2 PR/MR), before the merge/push below. Skip entirely for Options 3 and 4.**

Reaching this skill means QA already passed — `development-process` gates `finishing` behind the `awm-qa-complete` + `awm-retro-complete` markers, so any screen marked `completed` in a design doc's `## UI Screens` table has already cleared the design-fidelity gate. Its `.stitch/designs/` artifacts (HTML + PNG) were consumed by implementation and QA and are dead weight in the merged history from here on. Stitch keeps the project (`> Stitch Project: projects/<id>` in the design doc) as the durable source of truth.

1. Detect applicability:

```bash
ls .stitch/designs/ 2>/dev/null || echo "no artifacts — skip retirement"
```

If `.stitch/designs/` does not exist, or no design doc has a `## UI Screens` table with at least one `Status: completed` row, **skip this step silently** (no prompt).

2. For each `## UI Screens` row with `Status: completed`, take its `<slug>` from the `Artifacts` cell paths and the project ref from the section's `> Stitch Project: projects/<id>` header.

3. **Interactive mode — offer once:**

```
These design artifacts already served implementation + QA and become dead weight after integrating:
  .stitch/designs/<slug>.html · .stitch/designs/<slug>.png   (<screen name>)
Remove them in a cleanup commit first? Stitch keeps the project (projects/<id>) as source of truth. [y/N]
```

**Unattended mode:** skip the prompt and perform the removal automatically.

4. On confirmation (or in unattended mode), for each `completed` screen:

```bash
git rm .stitch/designs/<slug>.html .stitch/designs/<slug>.png
```

Then rewrite that screen's `Artifacts` cell in the design doc from the path list to `retired post-merge · projects/<id>` (leave `Status: completed` and every other column unchanged). Commit the removals and the doc edit together:

```bash
git add docs/plans/<design-doc>.md
git commit -m "chore: retire Stitch design artifacts post-QA before integrating"
```

Only `completed` screens are retired — `pending`/in-progress screens keep their artifacts. Never remove `design-system/` tokens or `.stitch/verification/` evidence.

Then continue with the chosen option's merge/push below.

#### Option 1: Merge Locally

**First, run Step 4.0 (retire design artifacts).**

```bash
# Switch to base branch
git checkout <base-branch>

# Pull latest
git pull

# Merge feature branch
git merge <feature-branch>

# Verify tests on merged result
<test command>

# If tests pass
git branch -d <feature-branch>
```

Then: Cleanup worktree (Step 5)

#### Option 2: Push and Create PR/MR

**First, run Step 4.0 (retire design artifacts).**

The push always happens first and never depends on `gh`/`glab`. What differs by `$HOST` (from Step 3.5) is only how — or whether — a PR/MR gets opened after.

```bash
# Push branch (always — independent of host/CLI)
git push -u origin <feature-branch>
```

**`HOST=github` → use `gh`, if installed:**

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

If `gh` isn't installed (or not on PATH), treat this the same as the degraded path below.

**`HOST=gitlab` → use `glab`, if installed:**

`glab mr create` is the MR equivalent of `gh pr create` — open it with a title and a description covering the summary and test plan (e.g. `glab mr create --title "<title>" --description "..."`, though verify the exact flags against `glab --help` at the time — CLI surfaces drift, and asserting an untested flag with false confidence is worse than checking). If `glab` isn't installed, treat this the same as the degraded path below.

**`HOST=unknown` (unrecognized remote domain, or the host's CLI isn't installed) → honest degradation, not a failure:**

The push already succeeded. Report exactly that, plus what's left to do manually:

```
Pushed to <feature-branch>. Could not create a PR/MR automatically — no gh/glab detected or unrecognized git host.

Open one manually:
- If the remote is GitHub-shaped: <remote-url-without-.git>/compare/<base-branch>...<feature-branch>
- Otherwise: push is done — open a merge/pull request for <feature-branch> against <base-branch> from your host's web UI.
```

This IS a valid, complete outcome of Option 2 — the branch is pushed and the operator has a clear, unambiguous next action. It is never treated as an error or a reason to escalate.

Then: Cleanup worktree (Step 5)

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then: Cleanup worktree (Step 5)

### Step 5: Cleanup Worktree

**For Options 1, 2, 4:**

Check if in worktree:
```bash
git worktree list | grep $(git branch --show-current)
```

If yes:
```bash
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.

## Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch | Retire artifacts |
|--------|-------|------|---------------|----------------|------------------|
| 1. Merge locally | ✓ | - | - | ✓ | ✓ (if any) |
| 2. Create PR/MR | - | ✓ | ✓ | - | ✓ (if any) |
| 3. Keep as-is | - | - | ✓ | - | - |
| 4. Discard | - | - | - | ✓ (force) | - |

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR/MR
- **Fix:** Always verify tests before offering options

**Open-ended questions**
- **Problem:** "What should I do next?" → ambiguous
- **Fix:** Present exactly 4 structured options (modo desatendido es la excepción documentada: no presenta el menú, ejecuta directo la Opción 2 — ver sección "Modo desatendido")

**Automatic worktree cleanup**
- **Problem:** Remove worktree when might need it (Option 2, 3)
- **Fix:** Only cleanup for Options 1 and 4

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

**Retiring artifacts on keep/discard**
- **Problem:** Removing `.stitch/designs/` on Option 3 or 4 deletes design refs when the work isn't being integrated
- **Fix:** Step 4.0 runs only on Options 1 & 2, and only for `completed` screens

**Treating a degraded PR/MR as a failure**
- **Problem:** `$HOST=unknown` (no `gh`/`glab`, or unrecognized remote) is mistaken for an error and the skill blocks, escalates, or refuses to finish
- **Fix:** The push already succeeded and never depended on the CLI — report the degraded PR/MR step and stop there; that's a complete Option 2 outcome, in both interactive and unattended mode

**Silently skipping PR/MR creation**
- **Problem:** Push succeeds, `gh`/`glab` isn't available, and the skill ends without telling the operator a PR/MR was NOT created
- **Fix:** Always state explicitly whether a PR/MR was created or is pending manual creation, with the compare/MR URL or instructions

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request
- Retire design artifacts on Option 3/4, or for non-`completed` screens
- Treat a degraded PR/MR (no `gh`/`glab`, or unrecognized host) as a blocking failure
- Finish Option 2 without stating whether a PR/MR was actually created

**Always:**
- Verify tests before offering options
- Present exactly 4 options (modo desatendido exceptuado: ver sección "Modo desatendido")
- Get typed confirmation for Option 4
- Clean up worktree for Options 1 & 4 only
- Retire `completed`-screen `.stitch/designs/` artifacts before integrating (Options 1 & 2, via Step 4.0)
- Detect the git host (Step 3.5) before any Option 2 git-host operation

## Integration

**Called by:**
- **subagent-driven-development** (Step 7) - After all tasks complete
- **executing-plans** (Step 5) - After all batches complete

**Pairs with:**
- **using-git-worktrees** - Cleans up worktree created by that skill
