---
applyTo: "**"
---

# Design Fidelity Gate

Verifies that an implemented screen matches its committed design artifacts. Evidence-based: screenshots and element inventories, never impressions.

**Announce at start:** "I'm using the design-fidelity skill to verify the implementation against the design."

## Preconditions

1. `.stitch/designs/<screen-slug>.html` (+ `.png` when available) exist for the screen(s) under review. If not → report "no design artifacts; design-fidelity does not apply" and stop.
2. The app must be able to run locally (dev server or built output). Two distinct, ordered scenarios apply when a full browser-based comparison isn't possible:
   - **App cannot run at all** → there is nothing to compare against. Verdict is `NOT_CERTIFIED`; the report states "implementation could not be started — no comparison possible." An inventory of the design alone (Step 2) with nothing on the other side is not a comparison — do not substitute it for one.
   - **App runs but no browser tool is available** → the Step 3/Step 4 source-code fallback applies: compare the design against the implementation's source code instead of a screenshot. Verdict is still `NOT_CERTIFIED` per the gate rule below, but WITH a real comparison attempted.

## Procedure (per screen)

### Step 1: Load the design
- Read `.stitch/designs/<screen-slug>.png` with the native file-reading mechanism — it is an image; look at it.
- Read `.stitch/designs/<screen-slug>.html`.

### Step 2: Build the element inventory
From the design HTML + PNG, list every major element with a stable number: regions (header, nav, sidebar, footer), interactive elements (search bar, buttons, filters), content blocks (cards, tables, stats, charts), and notable styling traits (typography scale, density, color accents). This inventory is the checklist — write it down before looking at the implementation.

For repeated elements (e.g., a list of cards, a grid of items), enumerate each visible instance as its own inventory row, not one grouped row — so a systematic loss (e.g., all cards replaced by bare numbers) shows as N findings, not 1.

### Step 3: Capture the implementation
Requires a browser tool (Playwright MCP):
1. Navigate to the implemented route.
2. Resize to the design's width (e.g. 1600 desktop / 390 mobile — infer from the PNG dimensions or the design doc's Device column; if they disagree, the PNG's actual pixel dimensions win — it's measured evidence — and the Device column is only a fallback when PNG metadata is unavailable).
3. Screenshot → `.stitch/verification/<screen-slug>-impl.png` (create the directory; it may be gitignored — that is fine, it is evidence, not a deliverable).

**No browser available?** Skip to Step 4 using the implementation's source code instead of a screenshot, and cap the verdict at `NOT_CERTIFIED`.

### Step 4: Compare element by element
Read BOTH images in the same turn (design PNG, implementation PNG) and walk the inventory. Classify each element:
- `present` — exists and visually matches (position, content type, prominence).
- `diverged` — exists but differs meaningfully (wrong position, missing content, wrong density/typography/color role).
- `missing` — not in the implementation at all.

**Source-code path (no browser/screenshot available):** classify against the implementation's source instead of a screenshot — search for matching text content, component names, or structural markup corresponding to each inventory row. `present` = a corresponding element/component is found in the source; `diverged` = it exists but with different structure/content than the design implies; `missing` = no corresponding code found.

**Severity rubric:**
- `high` = structurally missing content or a core interactive element (header, primary nav, main content block).
- `medium` = present but meaningfully wrong (wrong layout role, wrong density).
- `low` = cosmetic (spacing, minor color variance).

### Step 5: Report

```markdown
## Design Fidelity Report — <screen>
Design: .stitch/designs/<screen-slug>.png · Implementation: .stitch/verification/<screen-slug>-impl.png
**Fix cycle:** N/3

| # | Element (from design) | Status | Divergence | Severity |
|---|----------------------|--------|------------|----------|
| 1 | Header with search + avatar | missing | not implemented | high |
| 2 | Week calendar grid | diverged | cells show bare number chips instead of titled task cards | high |

**Verdict:** CONVERGED | DIVERGENT (N elements pending) | NOT_CERTIFIED (no browser evidence)
```

The `**Fix cycle:** N/3` line is the durable counter for Step 6 below — it is written into the report text itself, not held only in the agent's working memory. The first time Step 5 runs for a screen, N = 1. Every time the report is regenerated for that same screen (Step 6.2), increment N by 1 before re-emitting the report, so the report artifact itself always reflects how many fix-and-recheck cycles have run — recoverable even across a context compaction or a resumed session, since it is read off the last emitted report rather than counted from memory.

### Step 6: Fix loop
While the verdict is DIVERGENT:
1. For each `missing`/`diverged` element (highest severity first), implement the fix (or dispatch it to the executing skill/subagent that owns implementation).
2. Re-run Steps 3–5 for the affected screen, incrementing **Fix cycle** in the regenerated report (see Step 5).
3. An element may only leave the list by becoming `present` or by **explicit user waiver** (record "waived by user" in the report).
4. If **Fix cycle** reaches `3/3` in the report and the verdict is still DIVERGENT, stop looping and escalate to the user with the current report — do not retry indefinitely. Read the count from the report's own `**Fix cycle:**` line, not from memory of how many turns have passed.

The gate passes ONLY with verdict `CONVERGED` (all elements `present` or waived). `NOT_CERTIFIED` is never a pass — state it explicitly to whoever invoked the skill.

## Dual-mode report contract

**Standalone invocation:** produce the markdown report above (Step 5) for a human reader.

**As a post-implementation-qa lens:** this skill is registered as a conditional Track B QA lens (see `post-implementation-qa`'s lens table, its tier logic, and `deep-review-prompt.md`'s `lens` enum and Design Fidelity template block). The dispatching controller wraps Steps 1-4's comparison procedure with QA's standard JSON Output Format and ledger instructions. Each element with status `missing`/`diverged` becomes one finding: `"track": "B"`, `"lens": "design-fidelity"`, a stable id following the Track B convention (`B1`, `B2`, ...), severity mapped from this skill's high/medium/low scale to blocker/important/minor respectively, `"title"` the element name, `"detail"` the divergence description, `"evidence"` the file:line-equivalent (design artifact path + implementation screenshot path), `"reference"` the screen name. Elements marked `present` are not findings. A `CONVERGED` verdict with zero findings still emits the standard empty-case format.

## Red Flags

| Temptation | Reality |
|------------|---------|
| "It looks close enough" | Walk the inventory. Every element gets a status. |
| "No browser, but the code looks right" | That is `NOT_CERTIFIED`, not a pass. Say so. |
| "The design PNG is just a reference" | The PNG is the contract. Divergence needs a fix or an explicit user waiver. |
