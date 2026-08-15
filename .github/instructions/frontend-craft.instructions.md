---
applyTo: "**"
---

# Frontend Craft

The single orchestrator for frontend craft during development. It exists because LLM-built UI defaults to generic, templated output. This skill injects taste and rules, and decides how deep to go.

**Announce at start:** "I'm using the frontend-craft skill to apply frontend craft."

## Knowledge base

This skill draws on two bundled references and one queryable skill. Read/query the relevant one before acting:
- `reference/design-taste-frontend.md` — Design Read (infer the brief), dials, anti-slop tells, layout/typography/color hard-rules. Read FIRST for any new surface.
- `reference/emil-design-eng.md` — animation decision framework, springs, easing, micro-interactions, component polish. Read when motion/interaction quality matters.
- `ui-ux-pro-max` (skill) — searchable design database (styles, palettes, font pairings, UX guidelines, stack rules). Query it via its search script for any color/typography/UX decision not answered by the Design Direction.

## When invoked

1. **Ground truth first.** Look up the surface you are building in the design doc's `## UI Screens` table and check its `Artifacts` column (see `skills/ui-design/SKILL.md` Step 4 for the table format) for the exact `.stitch/designs/<slug>.html` / `.png` paths — don't freehand-match "the surface" to a filename. If the table lists artifacts for that screen, they are the visual ground truth: Read the PNG (it is an image — look at it) and the HTML BEFORE any inference. Match them.
2. **Read the Design Direction.** If the design doc has a `## Design Direction` section (from brainstorming), treat it as the brief. If absent, infer it using `reference/design-taste-frontend.md` §0 (Read the Room) before writing UI.
3. **Apply the always-on rules** from the references: typography scale, color calibration, spacing rhythm, responsive hard-rules, and the anti-slop / AI-tells checklist. These are mandatory for every UI task.
4. **Consult ui-ux-pro-max before escalating.** For color/typography/UX decisions the Design Direction does not answer, query ui-ux-pro-max (`--domain color|typography|ux`) and use the results. Include them in the escalation contract when handing off to impeccable. If ui-ux-pro-max's search also returns no match, fall back to the always-on hard-rules from step 3 (typography/color/spacing/responsive) rather than blocking.
5. **Decide depth:**
   - **Minor change** (button, copy, single component tweak) → apply the rules directly, no escalation.
   - **UI-centric work** (a landing, a dashboard, a full page or redesign) → escalate to the `impeccable` engine: invoke its matching sub-command (`craft`/`shape` to build, `polish`/`audit`/`critique` to refine) per its routing rules.
6. **Self-check** against the anti-slop checklist before declaring the UI task done.

## Escalation contract

When escalating, hand impeccable:
- the surface/target
- the Design Direction
- any ground-truth artifact paths found in step 1 (`.stitch/designs/<slug>.html` / `.png`)
- any ui-ux-pro-max query results from step 4

impeccable's brief (whether the compact bullet form or the full structured form) has no dedicated slot for the last two — fold artifact paths and ui-ux-pro-max results into wherever the brief accommodates visual direction (e.g. the Design Direction section in the full form) so they aren't dropped. impeccable owns its own flow from there; return to the calling execution skill when it finishes.

## Boundaries

- Does NOT design screens from scratch in a tool — that is `ui-design` (Stitch), which runs earlier in the pipeline.
- Does NOT do backend/API/CLI work.
- Only READS existing `.stitch/designs/` artifacts produced earlier by `ui-design` — never generates, regenerates, or modifies them.
