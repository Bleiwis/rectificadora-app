# Guía de Auto-Update con GitHub Releases (Rectificadora App)

Esta guía explica qué quedó configurado en el repositorio y qué debes hacer tú en GitHub para activar el flujo completo de actualización automática en Windows.

## 1. Qué ya quedó implementado

En este repositorio ya está listo:

1. Integración de `electron-updater` en proceso principal de Electron.
2. Canal IPC seguro para updater (`updater:*`) y bridge en preload (`window.updater`).
3. Configuración de publicación en `electron-builder` para GitHub Releases.
4. Workflow de release en GitHub Actions: [.github/workflows/release-windows.yml](.github/workflows/release-windows.yml).

## 2. Qué debes configurar tú en GitHub

## 2.1 Permisos de GitHub Actions

1. Ve a `Settings` del repositorio.
2. En `Actions` -> `General`:
   - `Workflow permissions`: selecciona **Read and write permissions**.
   - Activa: **Allow GitHub Actions to create and approve pull requests** (opcional, recomendado).
3. Guarda los cambios.

Sin este permiso, el workflow no podrá publicar releases/artefactos.

## 2.2 Secrets (opcionales pero recomendados para firma)

La app puede funcionar sin firma, pero en Windows tendrás más advertencias de SmartScreen. Para distribución profesional, agrega firma de código:

1. Ve a `Settings` -> `Secrets and variables` -> `Actions`.
2. Crea estos secrets (si tienes certificado):
   - `CSC_LINK`: certificado en base64 o URL segura al `.p12/.pfx`.
   - `CSC_KEY_PASSWORD`: contraseña del certificado.

Notas:
- Si no agregas firma, el build/release puede publicarse igual.
- Para entorno empresarial, se recomienda firma EV/OV.

## 2.3 Confirmar branch por defecto y política de tags

1. Verifica tu branch principal (`main` o el que uses).
2. Define convención de versión con tags: `vX.Y.Z`.

El workflow está configurado para dispararse con tags que empiecen por `v`.

## 3. Cómo publicar una versión con auto-update

## 3.1 Subir cambios pendientes

Asegúrate de que el código y CI estén en el remoto antes de crear el tag.

## 3.2 Crear y empujar tag de release

Ejemplo para versión `2.3.1`:

```bash
git tag v2.3.1
git push origin v2.3.1
```

Al subir ese tag:
1. GitHub Actions ejecuta el workflow.
2. Se compila la app para Windows.
3. `electron-builder` publica artefactos en GitHub Releases.
4. Se publica también metadata de actualización (`latest.yml`), usada por `electron-updater`.

## 3.3 Verificar release generado

En `Releases` del repo, valida que existan:
- Instalador `.exe`.
- Archivos de metadata de actualización (`latest.yml`, `*.blockmap`, etc.).

## 4. Validación real del auto-update

Haz una prueba controlada:

1. Instala versión anterior (por ejemplo `2.3.0`).
2. Publica `2.3.1` con el flujo de arriba.
3. Abre la app instalada de `2.3.0`.
4. Espera el chequeo automático (startup + delay de estabilización).
5. Confirma descarga/aplicación de update al cerrar o al invocar `quitAndInstall` desde UI si lo expones en pantalla.

## 5. Troubleshooting rápido

## 5.1 El workflow falla al publicar release

Revisa:
- Permisos de Actions en `Read and write`.
- Que el job tenga `permissions: contents: write` (ya está configurado).
- Que el tag sea `v*`.

## 5.2 La app no detecta actualización

Revisa:
- Que exista una release más nueva en GitHub.
- Que `latest.yml` esté presente en la release.
- Que la app esté empaquetada/instalada (en desarrollo local el updater está desactivado por diseño).

## 5.3 SmartScreen muestra advertencias

Esperado si no hay firma de código. Mitigación:
- Implementar firma de código con certificado confiable.

## 6. Recomendación operativa

Para evitar errores en lanzamientos:

1. Ejecuta localmente antes de taggear:
   - `npm run lint`
   - `npm run test`
   - `npm run build`
2. Taggea solo cuando esos checks estén verdes.
3. Mantén changelog por versión (`vX.Y.Z`) para soporte y trazabilidad.

## 7. Checklist de cierre

- [ ] Permissions de Actions en `Read and write`.
- [ ] (Opcional) Secrets de firma cargados.
- [ ] Tag `vX.Y.Z` publicado.
- [ ] Release con instalador y `latest.yml` visible.
- [ ] Prueba de actualización desde versión anterior validada.
