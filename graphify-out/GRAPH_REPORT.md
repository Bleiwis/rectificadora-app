# Graph Report - rectificadora-app  (2026-08-01)

## Corpus Check
- 158 files · ~456,381 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 882 nodes · 1513 edges · 54 communities (45 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68074f4c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FormElements.tsx
- index.cjs
- dependencies
- AppLayout.tsx
- devDependencies
- Pedidos.tsx
- App.tsx
- db.js
- ComponentCard.tsx
- BasicTableOne.tsx
- index.js
- compilerOptions
- Changelog
- AuthContext.tsx
- AGENTS
- Electron Offline-First Migration Plan
- compilerOptions
- auth-store.js
- vite-env.d.ts
- PageMeta.tsx
- scripts
- bcv-rate-service.js
- license-service.js
- Videos.tsx
- lan-order-service.js
- Ajustes.tsx
- Images.tsx
- Ingreso.tsx
- supabase-sync.js
- Avatar.tsx
- desktop-auth.d.ts
- auth-ipc.js
- build-windows.mjs
- build
- mac
- win
- Pedidos Component Architecture
- Form.tsx
- RadioSm.tsx
- AspectRatioVideo.tsx
- tsconfig.json
- free-dev-port.mjs
- svg.d.ts
- Alerts.tsx
- rules/graphify.md
- workflows/graphify.md
- Home.tsx
- electron/**/*

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 29 edges
2. `PageMeta()` - 25 edges
3. `ComponentCard()` - 20 edges
4. `PageBreadcrumb()` - 19 edges
5. `registerDbIpcHandlers()` - 18 edges
6. `compilerOptions` - 18 edges
7. `AGENTS` - 18 edges
8. `requestLanServer()` - 16 edges
9. `Label()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `registerDbIpcHandlers()` --calls--> `getLatestBcvUsdRate()`  [EXTRACTED]
  electron/main/index.js → electron/main/bcv-rate-service.js
- `registerDbIpcHandlers()` --calls--> `setManualBcvUsdRate()`  [EXTRACTED]
  electron/main/index.js → electron/main/bcv-rate-service.js
- `registerDbIpcHandlers()` --calls--> `getBcvUsdRateStatus()`  [EXTRACTED]
  electron/main/index.js → electron/main/bcv-rate-service.js
- `registerDbIpcHandlers()` --calls--> `refreshBcvUsdRateSafe()`  [EXTRACTED]
  electron/main/index.js → electron/main/bcv-rate-service.js
- `ensureSchema()` --calls--> `getDb()`  [EXTRACTED]
  electron/main/license-service.js → electron/main/db.js

## Import Cycles
- None detected.

## Communities (54 total, 9 thin omitted)

### Community 0 - "FormElements.tsx"
Cohesion: 0.06
Nodes (42): DiscoveryFeedback, SignInStep, ChartTab(), DatePicker(), PropsType, CheckboxComponents(), DefaultInputs(), DropzoneComponent() (+34 more)

### Community 1 - "index.cjs"
Cohesion: 0.04
Nodes (4): AUTH_CHANNELS, { contextBridge, ipcRenderer }, DB_CHANNELS, LICENSE_CHANNELS

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (45): apexcharts, better-sqlite3, clsx, flatpickr, @fullcalendar/core, @fullcalendar/daygrid, @fullcalendar/interaction, @fullcalendar/list (+37 more)

### Community 3 - "AppLayout.tsx"
Cohesion: 0.09
Nodes (24): ThemeToggleButton(), CountryMap(), CountryMapProps, HeaderProps, NotificationDropdown(), NotificationItem, UserDropdown(), Dropdown() (+16 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (43): concurrently, cross-env, electron, electron-builder, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+35 more)

### Community 5 - "Pedidos.tsx"
Cohesion: 0.09
Nodes (25): SelectInputs(), MultiSelect(), MultiSelectProps, Option, Option, Select(), SelectProps, ActionIconButton() (+17 more)

### Community 6 - "App.tsx"
Cohesion: 0.12
Nodes (19): GuestOnly(), RequireAuth(), SetupOnly(), ResetPasswordScreen(), ScrollToTop(), useAuth(), GestionServicios(), ServiceItem (+11 more)

### Community 7 - "db.js"
Cohesion: 0.09
Nodes (24): bcvRateRepo, buildClientFromOrder(), clientsRepo, DEFAULT_LAN_CONFIG, deriveOrderCodePrefixFromInstallationId(), deriveOrderStatusFromParts(), derivePaymentSummary(), getDb() (+16 more)

### Community 8 - "ComponentCard.tsx"
Cohesion: 0.24
Nodes (8): BarChartOne(), LineChartOne(), ComponentCard(), ComponentCardProps, BreadcrumbProps, PageBreadcrumb(), BarChart(), LineChart()

### Community 9 - "BasicTableOne.tsx"
Cohesion: 0.11
Nodes (20): Product, tableData, BasicTableOne(), Order, tableData, Badge(), BadgeColor, BadgeProps (+12 more)

### Community 10 - "index.js"
Cohesion: 0.14
Nodes (27): createMainWindow(), createSystemTray(), __dirname, distPath, __filename, getEffectiveLanConfig(), getLocalNetworkIps(), getTrayIcon() (+19 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+15 more)

### Community 12 - "Changelog"
Cohesion: 0.06
Nodes (35): Breaking Changes, Changelog, Cloning the Repository, Components, Demos, Desktop (Electron) Mode, Enhancements, Enhancements (+27 more)

### Community 13 - "AuthContext.tsx"
Cohesion: 0.12
Nodes (18): App(), AppWrapper(), AuthProvider(), clearSessionUserId(), Credentials, getDesktopAuthApi(), SetupMasterPayload, writeSessionUserId() (+10 more)

### Community 14 - "AGENTS"
Cohesion: 0.06
Nodes (30): 10. Inventario Opcional en Órdenes, 11. Mejoras al Sync, 12. Auth Test Suite, 1. Persistencia Local (SQLite), 2. Sincronización Asíncrona (Supabase), 3. Comunicación IPC (Secure Preload Bridge), 4. Pruebas Unitarias, 5. Gestión de Usuarios y Roles (+22 more)

### Community 15 - "Electron Offline-First Migration Plan"
Cohesion: 0.08
Nodes (25): Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Current Baseline (Observed), Deliverables, Deliverables (+17 more)

### Community 16 - "compilerOptions"
Cohesion: 0.10
Nodes (19): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection (+11 more)

### Community 17 - "auth-store.js"
Cohesion: 0.15
Nodes (11): assertPasswordStrength(), createAuthStore(), createPasswordHash(), decryptText(), getOrCreateEncryptionKey(), hashUsername(), isValidUsername(), normalizeUsername() (+3 more)

### Community 18 - "vite-env.d.ts"
Cohesion: 0.12
Nodes (15): BcvUsdRateOperationResult, BcvUsdRateSnapshot, BcvUsdRateStatus, LanConfig, LanConnectedClient, LanDiscoveredServer, LanMode, LanStatus (+7 more)

### Community 19 - "PageMeta.tsx"
Cohesion: 0.16
Nodes (11): SetupMasterFormDesktop(), SignInFormDesktop(), SignUpFormDesktop(), GridShape(), PageMeta(), ThemeTogglerTwo(), AuthLayout(), SetupMaster() (+3 more)

### Community 20 - "scripts"
Cohesion: 0.07
Nodes (28): main, name, overrides, react-helmet-async, @react-jvectormap/core, @react-jvectormap/world, private, react (+20 more)

### Community 21 - "bcv-rate-service.js"
Cohesion: 0.17
Nodes (21): BCV_RATE_URLS, extractRateFromHtml(), fetchBestBcvRate(), fetchHtml(), getBcvUsdRateStatus(), getCaracasDateParts(), getDateLabelFromISO(), getEffectiveBusinessDateISOInCaracas() (+13 more)

### Community 22 - "license-service.js"
Cohesion: 0.25
Nodes (17): buildLicenseStatus(), ensureColumnExists(), ensureSchema(), fetchRemoteLicense(), getLicenseStatus(), getState(), getTrialWindow(), initializeLicenseService() (+9 more)

### Community 23 - "Videos.tsx"
Cohesion: 0.29
Nodes (5): FourIsToThree(), OneIsToOne(), SixteenIsToNine(), TwentyOneIsToNine(), Videos()

### Community 24 - "lan-order-service.js"
Cohesion: 0.33
Nodes (13): applyLanServerMode(), buildClientKey(), connectedClients, ensureAuthorized(), handleServerRequest(), incrementClientRequestCount(), markClientDisconnected(), normalizeRemoteAddress() (+5 more)

### Community 25 - "Ajustes.tsx"
Cohesion: 0.22
Nodes (8): Ajustes(), DiscoveryFeedback, LanConfig, LanConnectedClient, LanDiscoveredServer, LanMode, LanStatus, LocalNetworkIp

### Community 26 - "Images.tsx"
Cohesion: 0.36
Nodes (4): ResponsiveImage(), ThreeColumnImageGrid(), TwoColumnImageGrid(), Images()

### Community 27 - "Ingreso.tsx"
Cohesion: 0.25
Nodes (7): BcvUsdRateSnapshot, ClientDocumentType, Ingreso(), LanStatusState, OrderItem, PartRow, ServiceSelection

### Community 28 - "supabase-sync.js"
Cohesion: 0.26
Nodes (10): outboxRepo, loadEnvFromFile(), loadRuntimeEnv(), parseEnvText(), delay(), processOutbox(), startSyncInterval(), stopSyncInterval() (+2 more)

### Community 29 - "Avatar.tsx"
Cohesion: 0.33
Nodes (5): Avatar(), AvatarProps, sizeClasses, statusColorClasses, statusSizeClasses

### Community 30 - "desktop-auth.d.ts"
Cohesion: 0.33
Nodes (5): DesktopAuthApi, DesktopAuthResponse, DesktopAuthUser, DesktopUsernameStateResponse, Window

### Community 31 - "auth-ipc.js"
Cohesion: 0.31
Nodes (9): registerAuthIpcHandlers(), toErrorMessage(), checkUsernameFromLan(), forceResetPasswordFromLan(), getBootstrapStateFromLan(), getUserByIdFromLan(), setInitialPasswordFromLan(), signInFromLan() (+1 more)

### Community 33 - "build"
Cohesion: 0.18
Nodes (11): build, appId, asar, directories, linux, nsis, productName, output (+3 more)

### Community 34 - "mac"
Cohesion: 0.40
Nodes (5): mac, category, target, dmg, zip

### Community 35 - "win"
Cohesion: 0.40
Nodes (5): win, icon, target, nsis, portable

### Community 36 - "Pedidos Component Architecture"
Cohesion: 0.40
Nodes (4): Current Mapping, Entry Points, Layers, Pedidos Component Architecture

### Community 48 - "Alerts.tsx"
Cohesion: 0.50
Nodes (3): Alert(), AlertProps, Alerts()

### Community 52 - "Home.tsx"
Cohesion: 0.40
Nodes (4): Home(), InventoryItem, OrderItem, PartRow

### Community 53 - "electron/**/*"
Cohesion: 0.50
Nodes (3): files, dist/**/*, electron/**/*

## Knowledge Gaps
- **316 isolated node(s):** `BCV_RATE_URLS`, `MONTHS_ES`, `DEFAULT_LAN_CONFIG`, `__filename`, `__dirname` (+311 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron/**/*` connect `electron/**/*` to `index.cjs`, `index.js`, `bcv-rate-service.js`, `auth-ipc.js`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `build` connect `build` to `mac`, `win`, `scripts`, `electron/**/*`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `files` connect `electron/**/*` to `build`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `BCV_RATE_URLS`, `MONTHS_ES`, `DEFAULT_LAN_CONFIG` to the rest of the system?**
  _316 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FormElements.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05582603050957481 - nodes in this community are weakly interconnected._
- **Should `index.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._