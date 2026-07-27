# Electron Offline-First Migration Plan

## Current Baseline (Observed)
- Frontend stack: React 19 + TypeScript + Tailwind CSS + Vite.
- Routing: `BrowserRouter` in `src/App.tsx`.
- Build/lint scripts exist (`dev`, `build`, `lint`), but no test scripts yet.
- No Electron process structure (`main`, `preload`) exists.
- No offline persistence layer exists beyond theme in `localStorage`.

## Goal
Convert this project into a desktop Electron app with offline-first behavior and a maintainable architecture.

## Phase 1: Desktop Shell Foundation
### Deliverables
- Add Electron runtime and packaging toolchain.
- Create process separation:
  - `electron/main/` for app lifecycle and window management.
  - `electron/preload/` for secure IPC bridge.
  - Keep React app in `src/` as renderer.
- Add scripts for desktop development and packaging.

### Suggested Tasks
1. Install dependencies for Electron and build orchestration.
2. Add `electron/main/index.ts` and `electron/preload/index.ts`.
3. Update scripts:
   - `dev:web` (vite)
   - `dev:desktop` (vite + electron)
   - `build:web`
   - `build:desktop`
4. Switch router to `HashRouter` for packaged desktop compatibility.
5. Add base Electron builder config.

### Acceptance Criteria
- `npm run dev:desktop` opens Electron window with current UI.
- `npm run build:desktop` produces installable artifact.

## Phase 2: Local Data Layer (Offline Source of Truth)
### Deliverables
- Local database adapter in main process.
- Typed repository interfaces consumed by renderer via IPC.
- Initial domain entities and CRUD flows persisted locally.

### Suggested Tasks
1. Choose local DB strategy:
   - Default: SQLite + `better-sqlite3` in main process.
   - Alternative: `RxDB`/`PouchDB` only if document-model replication is a hard requirement.
2. Define schema migrations for core entities.
3. Implement repository pattern:
   - Domain interfaces in shared module.
   - DB adapters in main process.
   - IPC handlers + preload typed bridge.
4. Replace in-memory/mock data in selected screens with local persistence.

### Acceptance Criteria
- Data persists between app restarts.
- Core workflow works with no network.

## Phase 3: Sync Engine (When Backend Is Available)
### Deliverables
- Outbox queue for pending mutations.
- Sync worker with retry and backoff.
- Sync status tracking per entity/operation.
- Explicit conflict resolution policy.
- Real connectivity monitor in main process.

### Suggested Tasks
1. Add outbox table and operation model persisted on disk.
2. Write mutation events to outbox first.
3. Implement background sync worker triggered by connectivity and intervals.
4. Implement main-process connectivity heartbeat checks (Electron `net` or equivalent).
5. Handle conflict policy:
   - Default: version/timestamp-based resolution.
   - Advanced: CRDTs for collaborative/concurrent editing domains.
6. Show sync status in UI where it matters.

### Acceptance Criteria
- Offline writes are queued and later synchronized.
- Failed sync retries without blocking user flow.
- Connectivity state is based on real server reachability, not only browser hints.

## Phase 4: Testing and Quality Gates
### Deliverables
- Unit tests for domain/use-case layer.
- Integration tests for IPC and persistence adapters.
- Smoke E2E for desktop boot and primary flow.

### Suggested Tasks
1. Add test stack (Vitest + React Testing Library).
2. Add Electron E2E smoke test (Playwright Electron mode or equivalent).
3. Add scripts:
   - `test`
   - `test:unit`
   - `test:integration`
   - `test:e2e` (optional in CI first pass)
4. Add CI checks for lint, tests, and build.

### Acceptance Criteria
- PRs run lint + unit/integration tests.
- Desktop smoke test validates app boot and first route render.

## Phase 5: Security, Packaging, and Release
### Deliverables
- Hardened Electron security settings.
- Platform packaging for macOS/Windows.
- Optional auto-update strategy.

### Suggested Tasks
1. Enforce:
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - `sandbox: true` when possible.
2. Validate/whitelist IPC channels.
3. Configure icons, app metadata, and targets in builder config.
4. Add release checklist and versioning workflow.

### Acceptance Criteria
- Signed/releasable desktop builds.
- Security baseline documented and verified.

## Proposed Initial Milestone (Sprint 1)
- Complete Phase 1 end-to-end.
- Implement one real persisted module in Phase 2 (for example, tasks or orders).
- Add minimum test setup with at least unit tests for new domain logic.

## Risks and Mitigations
- Native module friction in Electron builds:
  - Prefer well-supported DB drivers and lock tool versions.
- BrowserRouter incompatibility in packaged desktop:
  - Migrate to `HashRouter` early.
- Over-coupled renderer with persistence:
  - Keep persistence and Node APIs behind typed preload/IPC boundary.
