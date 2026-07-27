# AGENTS

## Scope
These instructions apply to any AI coding agent working in this repository (Copilot, Codex, Antigravity, and others).

## Product Direction
- The target is a desktop application with Electron and an offline-first architecture.
- Keep existing UI behavior unless the task explicitly requires a UX change.
- Prefer incremental migrations over large rewrites.

## Data Flow Rules
- The local database is the single source of truth.
- The renderer/UI must read and write through local repositories/use cases.
- The renderer must never call external APIs directly; remote sync runs via main-process services through typed IPC.

## Engineering Best Practices
- Use TypeScript with strict typing. Avoid `any` unless justified in a code comment.
- Keep modules small and cohesive. Prefer composition over inheritance.
- Avoid hidden side effects in UI components; move business logic to dedicated services/use cases.
- Do not add new dependencies without a clear reason and a short note in PR/task summary.
- Preserve existing code style and lint rules.

## Electron Architecture Rules
- Separate responsibilities:
  - `main`: app lifecycle, windows, native integrations.
  - `preload`: secure bridge only.
  - `renderer`: React UI only.
- Security baseline is mandatory:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true` when feasible
- Never access Node APIs directly from renderer.
- Use typed IPC contracts and validate payloads at boundaries.

## Storage Decision Guide
- Default choice: SQLite with `better-sqlite3` in the main process for relational or structured data.
- Alternative choice: `RxDB` or `PouchDB` only when a document model plus built-in replication is a hard requirement.
- Any storage choice must include schema migration strategy.

## Offline-First Rules
- Local database is the source of truth for reads and writes.
- Network sync must be asynchronous and resilient (retry with backoff).
- Model writes as queued operations (outbox pattern) with idempotent identifiers.
- Persist the outbox queue on disk so pending mutations survive app restarts/crashes.
- Track entity sync state (`pending`, `synced`, `failed`) when relevant.
- Define conflict resolution explicitly:
  - Default: version/timestamp-based policy.
  - Use CRDTs when the feature requires concurrent collaborative editing semantics.
- Connectivity checks must not rely only on `navigator.onLine`.
- Detect real connectivity in main process with periodic lightweight server heartbeat checks (Electron `net` or equivalent).
- Do not block core user flows because of missing connectivity.

## Testing Requirements
- Every non-trivial change must include tests or a clear explanation if tests are not feasible.
- Minimum expected test coverage by change type:
  - Business logic: unit tests.
  - IPC handlers and persistence adapters: integration tests.
  - Critical desktop flow (app boots and loads UI): smoke E2E.
- Offline/sync changes must include tests for reconnect behavior, outbox replay, and conflict resolution.
- Before finishing a task, run relevant checks:
  - `npm run lint`
  - `npm run test` (if present)
  - `npm run build`

## Design Patterns To Prefer
- Feature-oriented modules for UI and domain boundaries.
- Repository pattern for persistence access.
- Use-case/application service layer for business workflows.
- Adapter pattern for external integrations (filesystem, network, OS APIs).
- Dependency inversion for testable core logic.

## Working Agreement For Agents
- Start by reading current project scripts/config before editing.
- Provide a short plan for multi-step tasks, then execute.
- Make the smallest safe change that solves the task.
- Do not refactor unrelated code.
- Document any new command, script, or folder introduced.

## Regla Obligatoria de Consistencia UI
- Antes de agregar o modificar controles de interfaz (botones, inputs, selects, textareas, badges, modales, tablas), revisar primero los componentes existentes del layout/template en:
  - `src/components/ui/*`
  - `src/components/form/*`
  - `src/pages/UiElements/*` (referencia de uso)
- Prioridad de implementación: reutilizar componentes existentes del layout por encima de elementos HTML nativos estilizados ad-hoc.
- Solo se permite crear controles nuevos cuando no exista equivalente en el layout; en ese caso:
  - justificar por qué no aplica el componente existente,
  - mantener API/estilo alineados con el diseño del template,
  - documentar el nuevo componente y su caso de uso.
- En PR/tarea, dejar nota breve indicando qué componentes del layout se reutilizaron.

## Regla Obligatoria de Esquema SQL para Supabase
- Cada vez que se modifique la base de datos local (nuevas tablas, columnas, constraints, índices, cambios de tipos o de relaciones), se debe actualizar también el esquema remoto de Supabase.
- No generar únicamente parches parciales: generar siempre un archivo SQL de esquema completo e idempotente (full picture) con `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, y creación condicional de constraints/índices.
- En cada actualización, crear un archivo nuevo en `docs/` con timestamp en el nombre para identificar el más reciente. Formato requerido:
  - `supabase-sync-schema-YYYY-MM-DD-HHMM.sql`
  - Ejemplo: `supabase-sync-schema-2026-07-18-1245.sql`
- El archivo más reciente por timestamp se considera la versión canónica para ejecutar en Supabase.
- Mantener los archivos anteriores solo como histórico; no sobrescribirlos.

## Base de Datos Local y Sincronización (Implementación Realizada)

Se ha implementado una arquitectura offline-first real que reemplaza la simulación anterior con `localStorage`:

### 1. Persistencia Local (SQLite)
* **Archivo**: [db.js](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/electron/main/db.js)
* **Lógica**: Manejado a través de `better-sqlite3`. Inicializa las tablas `services`, `inventory`, `orders` y `sync_outbox`.
* **Cola Outbox**: Los cambios locales se guardan primero en SQLite y se inserta un registro en la tabla `sync_outbox` (`INSERT`, `UPDATE` o `DELETE`) para ser procesado asíncronamente en segundo plano.

### 2. Sincronización Asíncrona (Supabase)
* **Archivo**: [supabase-sync.js](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/electron/main/supabase-sync.js)
* **Políticas**:
  * Realiza una petición de diagnóstico (`GET /rest/v1/services?limit=1`) para verificar si la base de datos Supabase está activa.
  * Si la base de datos está inactiva o tardando en responder (Cold Start), aplica reintentos automáticos con retroceso exponencial (*exponential backoff*: 2s, 4s, 8s, 16s, 32s).
  * Una vez activa, recorre y procesa secuencialmente la cola de `sync_outbox` haciendo peticiones REST nativas (`fetch`) utilizando las credenciales cargadas desde el `.env`.

### 3. Comunicación IPC (Secure Preload Bridge)
* **Preload**: [preload/index.cjs](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/electron/preload/index.cjs) expone de forma segura y tipada el objeto `window.database`.
* **Mapeo**: Los métodos del frontend llaman de forma asíncrona a los canales del main process correspondientes (ej. `db:get-orders`, `db:save-order`, `db:delete-order`, `db:trigger-sync`).

### 4. Pruebas Unitarias
* **Suite**: [db.test.js](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/tests/db.test.js) ejecuta pruebas de repositorios usando `vitest` y mockea las llamadas de SQLite para evitar problemas con enlaces binarios cruzados en entornos de consola. Correr con `npm run test`.

---

## Sistema de Roles y Autenticación (Implementación Realizada)

### 5. Gestión de Usuarios y Roles

Se implementó un sistema de usuarios basado en SQLite (tabla `app_users`) con soporte para roles y ciclo de vida completo:

* **Roles disponibles**: `master` (super admin inicial), `administrador`, `caja`.
* **Auth Store**: [auth-store.js](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/electron/main/auth-store.js)
  - Contraseñas hasheadas con `scrypt` + salt aleatorio.
  - Nombre de usuario cifrado con AES-256-GCM para privacidad en disco.
  - Métodos: `setupMasterUser`, `signIn`, `createUser`, `listUsers`, `deactivateUser`, `restoreUser`, `flagPasswordReset`, `forceResetPassword`.
* **IPC Handlers**: [auth-ipc.js](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/electron/main/auth-ipc.js) — registra todos los canales de auth con validación de payload en los límites.
* **Canales compartidos**: [auth-channels.js](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/electron/shared/auth-channels.js).
* **Preload Bridge**: [preload/index.cjs](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/electron/preload/index.cjs) expone `window.desktopAuth` con todos los métodos de usuario.

### 6. Flujo de Reseteo de Contraseña Forzado

* El administrador puede marcar a un usuario con `flagPasswordReset = 1` desde la vista de Usuarios.
* Al iniciar sesión, si `requiresPasswordReset` es `true`, el frontend muestra `ResetPasswordScreen` en lugar de la app.
* El usuario no puede eludir este paso hasta cambiar su contraseña.
* Archivo: [ResetPasswordScreen.tsx](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/src/components/auth/ResetPasswordScreen.tsx).

### 7. Página de Administración de Usuarios

* **Ruta**: `/usuarios` — visible solo para roles `master` y `administrador` en el sidebar.
* **Archivo**: [Usuarios.tsx](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/src/pages/Usuarios.tsx)
* **Funciones**:
  - Listar todos los usuarios con estado y rol.
  - Crear nuevos operarios (rol `caja` o `administrador`) con contraseña inicial.
  - Dar de baja (desactivar) usuarios. Los usuarios dados de baja no pueden iniciar sesión.
  - Reactivar usuarios dados de baja.
  - Forzar cambio de contraseña en el próximo inicio de sesión.

### 8. Restricciones de UI por Rol

| Funcionalidad | master | administrador | caja |
|---|---|---|---|
| Dashboard / Ingreso / Pedidos | ✅ | ✅ | ✅ |
| Gestión de Servicios (solo lectura) | ✅ | ✅ | ✅ (solo ver) |
| Gestión de Servicios (crear/editar/eliminar) | ✅ | ✅ | ❌ |
| Inventario (solo lectura) | ✅ | ✅ | ✅ (solo ver) |
| Inventario (crear/editar/eliminar) | ✅ | ✅ | ❌ |
| Página Usuarios | ✅ | ✅ | ❌ (redirige a /) |
* Las restricciones de UI están implementadas en [GestionServicios.tsx](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/src/pages/GestionServicios.tsx), [Inventario.tsx](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/src/pages/Inventario.tsx) y [AppSidebar.tsx](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/src/layout/AppSidebar.tsx).

---

## Catálogo de Servicios y Formulario de Ingreso

### 9. Servicios sin Hardcode

* Los servicios se cargan **únicamente desde SQLite** mediante `window.database.getServices()`.
* Si no hay servicios creados, el checklist aparece vacío — no se muestran datos de ejemplo.
* El CRUD de servicios (crear, editar, eliminar) llama a `window.database.saveService()` y `window.database.deleteService()` respectivamente.
* Archivos: [GestionServicios.tsx](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/src/pages/GestionServicios.tsx), [Ingreso.tsx](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/src/pages/Ingreso.tsx).

### 10. Inventario Opcional en Órdenes

* En el formulario de alta ([Ingreso.tsx](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/src/pages/Ingreso.tsx)), hay una sección opcional "Repuestos del Inventario".
* Permite seleccionar artículos del inventario y especificar cantidad.
* Validaciones: artículos agotados (`quantity <= 0`) están deshabilitados y no pueden agregarse.
* Al registrar la orden, se descuentan las cantidades del inventario automáticamente vía `window.database.saveInventory()`.
* Los artículos seleccionados se incluyen en el comprobante/print de la orden.

---

## Sincronización Supabase: Comportamiento y Manejo de Errores

### 11. Mejoras al Sync

* **Advertencia de credenciales**: El warning `"Credenciales no configuradas"` se muestra **una sola vez** por sesión de proceso (variable `credentialsWarningShown`), no en cada ciclo de sincronización.
* **Error PGRST205 (tabla faltante)**: Si una tabla no existe en Supabase, el item del outbox es marcado como `failed` y el procesamiento **continúa** con el resto de la cola. Antes, este error detenía todo el outbox.
* Archivo: [supabase-sync.js](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/electron/main/supabase-sync.js).

---

## Pruebas Unitarias

### 12. Auth Test Suite

* **Archivo**: [tests/auth.test.js](file:///Users/lewisbernal/Documents/develop/personal/rectificadora-app/tests/auth.test.js)
* Cubre: creación de usuario master, creación de usuario caja, desactivación y bloqueo de login, y flagging de reseteo de contraseña.
* Mockea `better-sqlite3` y `node:crypto` para evitar problemas de binarios nativos en entornos de consola/CI.
* Correr con `npm run test` (usa `vitest`).

