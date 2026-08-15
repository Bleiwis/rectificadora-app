# Graph Report - .  (2026-07-31)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 766 nodes · 1366 edges · 49 communities (39 shown, 10 thin omitted)
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
- PageMeta.tsx
- BasicTableOne.tsx
- lan-order-service.js
- compilerOptions
- bcv-rate-service.js
- AuthContext.tsx
- index.js
- license-service.js
- compilerOptions
- auth-store.js
- vite-env.d.ts
- AuthPageLayout.tsx
- scripts
- supabase-sync.js
- build
- Videos.tsx
- overrides
- Ajustes.tsx
- Images.tsx
- Ingreso.tsx
- package.json
- Avatar.tsx
- desktop-auth.d.ts
- mac
- build-windows.mjs
- Home.tsx
- target
- StatisticsChart.tsx
- files
- Form.tsx
- RadioSm.tsx
- AspectRatioVideo.tsx
- tsconfig.json
- free-dev-port.mjs
- svg.d.ts
- BarChart.tsx

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 29 edges
2. `PageMeta()` - 25 edges
3. `ComponentCard()` - 20 edges
4. `PageBreadcrumb()` - 19 edges
5. `registerDbIpcHandlers()` - 18 edges
6. `compilerOptions` - 18 edges
7. `Label()` - 16 edges
8. `compilerOptions` - 16 edges
9. `scripts` - 14 edges
10. `Input()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `registerDbIpcHandlers()` --calls--> `getLatestBcvUsdRate()`  [EXTRACTED]
  electron/main/index.js → electron/main/bcv-rate-service.js
- `registerDbIpcHandlers()` --calls--> `setManualBcvUsdRate()`  [EXTRACTED]
  electron/main/index.js → electron/main/bcv-rate-service.js
- `registerDbIpcHandlers()` --calls--> `getBcvUsdRateStatus()`  [EXTRACTED]
  electron/main/index.js → electron/main/bcv-rate-service.js
- `registerDbIpcHandlers()` --calls--> `refreshBcvUsdRateSafe()`  [EXTRACTED]
  electron/main/index.js → electron/main/bcv-rate-service.js
- `registerDbIpcHandlers()` --calls--> `processOutbox()`  [EXTRACTED]
  electron/main/index.js → electron/main/supabase-sync.js

## Import Cycles
- None detected.

## Communities (49 total, 10 thin omitted)

### Community 0 - "FormElements.tsx"
Cohesion: 0.06
Nodes (43): SetupMasterFormDesktop(), DiscoveryFeedback, SignInStep, DatePicker(), PropsType, CheckboxComponents(), DefaultInputs(), DropzoneComponent() (+35 more)

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
Nodes (42): concurrently, cross-env, electron-builder, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+34 more)

### Community 5 - "Pedidos.tsx"
Cohesion: 0.09
Nodes (25): SelectInputs(), MultiSelect(), MultiSelectProps, Option, Option, Select(), SelectProps, ActionIconButton() (+17 more)

### Community 6 - "App.tsx"
Cohesion: 0.13
Nodes (18): GuestOnly(), RequireAuth(), SetupOnly(), ResetPasswordScreen(), ScrollToTop(), useAuth(), Blank(), GestionServicios() (+10 more)

### Community 7 - "db.js"
Cohesion: 0.11
Nodes (20): buildClientFromOrder(), clientsRepo, DEFAULT_LAN_CONFIG, deriveOrderCodePrefixFromInstallationId(), deriveOrderStatusFromParts(), derivePaymentSummary(), getDeliveredByPartIndex(), initDatabase() (+12 more)

### Community 8 - "PageMeta.tsx"
Cohesion: 0.20
Nodes (12): LineChartOne(), ComponentCard(), ComponentCardProps, BreadcrumbProps, PageBreadcrumb(), PageMeta(), Alert(), AlertProps (+4 more)

### Community 9 - "BasicTableOne.tsx"
Cohesion: 0.11
Nodes (20): Product, tableData, BasicTableOne(), Order, tableData, Badge(), BadgeColor, BadgeProps (+12 more)

### Community 10 - "lan-order-service.js"
Cohesion: 0.18
Nodes (25): applyLanServerMode(), registerDbIpcHandlers(), resolveClientLanConfig(), buildClientKey(), connectedClients, createOrderThroughLan(), discoverLanServers(), ensureAuthorized() (+17 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+15 more)

### Community 12 - "bcv-rate-service.js"
Cohesion: 0.16
Nodes (22): BCV_RATE_URLS, extractRateFromHtml(), fetchBestBcvRate(), fetchHtml(), getBcvUsdRateStatus(), getCaracasDateParts(), getDateLabelFromISO(), getEffectiveBusinessDateISOInCaracas() (+14 more)

### Community 13 - "AuthContext.tsx"
Cohesion: 0.12
Nodes (18): App(), AppWrapper(), AuthProvider(), clearSessionUserId(), Credentials, getDesktopAuthApi(), SetupMasterPayload, writeSessionUserId() (+10 more)

### Community 14 - "index.js"
Cohesion: 0.13
Nodes (14): electron, registerAuthIpcHandlers(), toErrorMessage(), orderPaymentsRepo, usersRepo, __dirname, distPath, __filename (+6 more)

### Community 15 - "license-service.js"
Cohesion: 0.24
Nodes (19): getDb(), registerLicenseIpcHandlers(), buildLicenseStatus(), ensureColumnExists(), ensureSchema(), fetchRemoteLicense(), getLicenseStatus(), getState() (+11 more)

### Community 16 - "compilerOptions"
Cohesion: 0.10
Nodes (19): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection (+11 more)

### Community 17 - "auth-store.js"
Cohesion: 0.15
Nodes (11): assertPasswordStrength(), createAuthStore(), createPasswordHash(), decryptText(), getOrCreateEncryptionKey(), hashUsername(), isValidUsername(), normalizeUsername() (+3 more)

### Community 18 - "vite-env.d.ts"
Cohesion: 0.12
Nodes (15): BcvUsdRateOperationResult, BcvUsdRateSnapshot, BcvUsdRateStatus, LanConfig, LanConnectedClient, LanDiscoveredServer, LanMode, LanStatus (+7 more)

### Community 19 - "AuthPageLayout.tsx"
Cohesion: 0.19
Nodes (7): SignInFormDesktop(), SignUpFormDesktop(), GridShape(), ThemeTogglerTwo(), AuthLayout(), SignIn(), NotFound()

### Community 20 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, build:desktop, build:web, build:windows, dev, dev:desktop, dev:desktop:electron (+6 more)

### Community 21 - "supabase-sync.js"
Cohesion: 0.26
Nodes (10): outboxRepo, loadEnvFromFile(), loadRuntimeEnv(), parseEnvText(), delay(), processOutbox(), startSyncInterval(), stopSyncInterval() (+2 more)

### Community 22 - "build"
Cohesion: 0.18
Nodes (11): build, appId, asar, directories, linux, nsis, productName, output (+3 more)

### Community 23 - "Videos.tsx"
Cohesion: 0.29
Nodes (5): FourIsToThree(), OneIsToOne(), SixteenIsToNine(), TwentyOneIsToNine(), Videos()

### Community 24 - "overrides"
Cohesion: 0.22
Nodes (9): overrides, react-helmet-async, @react-jvectormap/core, @react-jvectormap/world, react, react, react-dom, react (+1 more)

### Community 25 - "Ajustes.tsx"
Cohesion: 0.22
Nodes (8): Ajustes(), DiscoveryFeedback, LanConfig, LanConnectedClient, LanDiscoveredServer, LanMode, LanStatus, LocalNetworkIp

### Community 26 - "Images.tsx"
Cohesion: 0.36
Nodes (4): ResponsiveImage(), ThreeColumnImageGrid(), TwoColumnImageGrid(), Images()

### Community 27 - "Ingreso.tsx"
Cohesion: 0.25
Nodes (7): BcvUsdRateSnapshot, ClientDocumentType, Ingreso(), LanStatusState, OrderItem, PartRow, ServiceSelection

### Community 28 - "package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 29 - "Avatar.tsx"
Cohesion: 0.33
Nodes (5): Avatar(), AvatarProps, sizeClasses, statusColorClasses, statusSizeClasses

### Community 30 - "desktop-auth.d.ts"
Cohesion: 0.33
Nodes (5): DesktopAuthApi, DesktopAuthResponse, DesktopAuthUser, DesktopUsernameStateResponse, Window

### Community 31 - "mac"
Cohesion: 0.40
Nodes (5): mac, category, target, dmg, zip

### Community 33 - "Home.tsx"
Cohesion: 0.40
Nodes (4): Home(), InventoryItem, OrderItem, PartRow

### Community 34 - "target"
Cohesion: 0.50
Nodes (4): win, target, nsis, portable

## Knowledge Gaps
- **241 isolated node(s):** `BCV_RATE_URLS`, `MONTHS_ES`, `DEFAULT_LAN_CONFIG`, `__filename`, `__dirname` (+236 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `index.js` to `index.cjs`, `bcv-rate-service.js`, `devDependencies`, `files`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `electron` connect `devDependencies` to `index.js`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `BCV_RATE_URLS`, `MONTHS_ES`, `DEFAULT_LAN_CONFIG` to the rest of the system?**
  _241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FormElements.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.056943056943056944 - nodes in this community are weakly interconnected._
- **Should `index.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._