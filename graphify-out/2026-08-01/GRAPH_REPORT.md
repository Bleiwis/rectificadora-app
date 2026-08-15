# Graph Report - rectificadora-app  (2026-07-31)

## Corpus Check
- 158 files · ~393,249 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 876 nodes · 1486 edges · 52 communities (42 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68074f4c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- InputField.tsx
- index.cjs
- dependencies
- AppLayout.tsx
- devDependencies
- pedidos/index.ts
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
- Pedidos.tsx
- SignInFormDesktop.tsx
- Videos.tsx
- FormElements.tsx
- Ajustes.tsx
- Images.tsx
- Ingreso.tsx
- Label.tsx
- Avatar.tsx
- desktop-auth.d.ts
- InputGroup.tsx
- build-windows.mjs
- SelectInputs.tsx
- ToggleSwitch.tsx
- StatisticsChart.tsx
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

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 29 edges
2. `PageMeta()` - 25 edges
3. `ComponentCard()` - 20 edges
4. `PageBreadcrumb()` - 19 edges
5. `registerDbIpcHandlers()` - 18 edges
6. `compilerOptions` - 18 edges
7. `AGENTS` - 18 edges
8. `Label()` - 16 edges
9. `compilerOptions` - 16 edges
10. `requestLanServer()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `RequireAuth()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/hooks/useAuth.ts
- `GuestOnly()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/hooks/useAuth.ts
- `SetupOnly()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/hooks/useAuth.ts
- `UserAddressCard()` --calls--> `useModal()`  [EXTRACTED]
  src/components/UserProfile/UserAddressCard.tsx → src/hooks/useModal.ts
- `UserInfoCard()` --calls--> `useModal()`  [EXTRACTED]
  src/components/UserProfile/UserInfoCard.tsx → src/hooks/useModal.ts

## Import Cycles
- None detected.

## Communities (52 total, 10 thin omitted)

### Community 0 - "InputField.tsx"
Cohesion: 0.24
Nodes (10): Input(), InputProps, Modal(), ModalProps, UserAddressCard(), UserInfoCard(), UserMetaCard(), useModal() (+2 more)

### Community 1 - "index.cjs"
Cohesion: 0.04
Nodes (4): AUTH_CHANNELS, { contextBridge, ipcRenderer }, DB_CHANNELS, LICENSE_CHANNELS

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (45): apexcharts, better-sqlite3, clsx, flatpickr, @fullcalendar/core, @fullcalendar/daygrid, @fullcalendar/interaction, @fullcalendar/list (+37 more)

### Community 3 - "AppLayout.tsx"
Cohesion: 0.09
Nodes (23): ThemeToggleButton(), CountryMap(), CountryMapProps, HeaderProps, NotificationDropdown(), NotificationItem, UserDropdown(), Dropdown() (+15 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (43): concurrently, cross-env, electron, electron-builder, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+35 more)

### Community 5 - "pedidos/index.ts"
Cohesion: 0.17
Nodes (12): ActionIconButton(), ActionIconButtonProps, OrderItem, OrderPartDeliveryRow, OrderPaymentRow, PartRow, PedidosPagination(), PedidosPaginationProps (+4 more)

### Community 6 - "App.tsx"
Cohesion: 0.12
Nodes (19): GuestOnly(), RequireAuth(), SetupOnly(), ResetPasswordScreen(), ScrollToTop(), useAuth(), GestionServicios(), ServiceItem (+11 more)

### Community 7 - "db.js"
Cohesion: 0.08
Nodes (41): bcvRateRepo, buildClientFromOrder(), clientsRepo, DEFAULT_LAN_CONFIG, deriveOrderCodePrefixFromInstallationId(), deriveOrderStatusFromParts(), derivePaymentSummary(), getDb() (+33 more)

### Community 8 - "ComponentCard.tsx"
Cohesion: 0.24
Nodes (8): BarChartOne(), LineChartOne(), ComponentCard(), ComponentCardProps, BreadcrumbProps, PageBreadcrumb(), BarChart(), LineChart()

### Community 9 - "BasicTableOne.tsx"
Cohesion: 0.11
Nodes (20): Product, tableData, BasicTableOne(), Order, tableData, Badge(), BadgeColor, BadgeProps (+12 more)

### Community 10 - "index.js"
Cohesion: 0.05
Nodes (77): registerAuthIpcHandlers(), toErrorMessage(), BCV_RATE_URLS, extractRateFromHtml(), fetchBestBcvRate(), fetchHtml(), getBcvUsdRateStatus(), getCaracasDateParts() (+69 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+15 more)

### Community 12 - "Changelog"
Cohesion: 0.06
Nodes (35): Breaking Changes, Changelog, Cloning the Repository, Components, Demos, Desktop (Electron) Mode, Enhancements, Enhancements (+27 more)

### Community 13 - "AuthContext.tsx"
Cohesion: 0.09
Nodes (22): App(), GridShape(), AppWrapper(), ThemeTogglerTwo(), AuthProvider(), clearSessionUserId(), Credentials, getDesktopAuthApi() (+14 more)

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
Cohesion: 0.15
Nodes (12): SetupMasterFormDesktop(), SignInFormDesktop(), SignUpFormDesktop(), PageMeta(), AuthLayout(), SetupMaster(), SignIn(), Blank() (+4 more)

### Community 20 - "scripts"
Cohesion: 0.04
Nodes (48): build, appId, asar, directories, linux, mac, nsis, productName (+40 more)

### Community 21 - "Pedidos.tsx"
Cohesion: 0.14
Nodes (12): TextAreaInput(), TextArea(), TextareaProps, Option, Select(), SelectProps, orderStatusFilterOptions, paymentFilterOptions (+4 more)

### Community 22 - "SignInFormDesktop.tsx"
Cohesion: 0.20
Nodes (7): DiscoveryFeedback, SignInStep, CheckboxComponents(), Checkbox(), CheckboxProps, Button(), ButtonProps

### Community 23 - "Videos.tsx"
Cohesion: 0.29
Nodes (5): FourIsToThree(), OneIsToOne(), SixteenIsToNine(), TwentyOneIsToNine(), Videos()

### Community 24 - "FormElements.tsx"
Cohesion: 0.16
Nodes (10): DefaultInputs(), DropzoneComponent(), FileInputExample(), InputStates(), RadioButtons(), FileInput(), FileInputProps, Radio() (+2 more)

### Community 25 - "Ajustes.tsx"
Cohesion: 0.22
Nodes (8): Ajustes(), DiscoveryFeedback, LanConfig, LanConnectedClient, LanDiscoveredServer, LanMode, LanStatus, LocalNetworkIp

### Community 26 - "Images.tsx"
Cohesion: 0.36
Nodes (4): ResponsiveImage(), ThreeColumnImageGrid(), TwoColumnImageGrid(), Images()

### Community 27 - "Ingreso.tsx"
Cohesion: 0.25
Nodes (7): BcvUsdRateSnapshot, ClientDocumentType, Ingreso(), LanStatusState, OrderItem, PartRow, ServiceSelection

### Community 28 - "Label.tsx"
Cohesion: 0.48
Nodes (4): DatePicker(), PropsType, Label(), LabelProps

### Community 29 - "Avatar.tsx"
Cohesion: 0.33
Nodes (5): Avatar(), AvatarProps, sizeClasses, statusColorClasses, statusSizeClasses

### Community 30 - "desktop-auth.d.ts"
Cohesion: 0.33
Nodes (5): DesktopAuthApi, DesktopAuthResponse, DesktopAuthUser, DesktopUsernameStateResponse, Window

### Community 31 - "InputGroup.tsx"
Cohesion: 0.40
Nodes (4): InputGroup(), CountryCode, PhoneInput(), PhoneInputProps

### Community 33 - "SelectInputs.tsx"
Cohesion: 0.40
Nodes (4): SelectInputs(), MultiSelect(), MultiSelectProps, Option

### Community 34 - "ToggleSwitch.tsx"
Cohesion: 0.50
Nodes (3): ToggleSwitch(), Switch(), SwitchProps

### Community 36 - "Pedidos Component Architecture"
Cohesion: 0.40
Nodes (4): Current Mapping, Entry Points, Layers, Pedidos Component Architecture

### Community 48 - "Alerts.tsx"
Cohesion: 0.50
Nodes (3): Alert(), AlertProps, Alerts()

## Knowledge Gaps
- **315 isolated node(s):** `BCV_RATE_URLS`, `MONTHS_ES`, `DEFAULT_LAN_CONFIG`, `__filename`, `__dirname` (+310 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron/**/*` connect `index.js` to `index.cjs`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `build` connect `scripts` to `index.js`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `files` connect `index.js` to `scripts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `BCV_RATE_URLS`, `MONTHS_ES`, `DEFAULT_LAN_CONFIG` to the rest of the system?**
  _315 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `AppLayout.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09291521486643438 - nodes in this community are weakly interconnected._