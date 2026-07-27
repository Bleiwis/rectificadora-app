import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GLOBAL_FLAG = "__rectificadoraRuntimeEnvLoaded";

function parseEnvText(content) {
  const parsed = {};

  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadEnvFromFile(filePath, lockedKeys) {
  if (!filePath || !fs.existsSync(filePath)) return;

  const parsed = parseEnvText(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    // Respect process-level variables passed by the OS/launcher.
    if (lockedKeys.has(key)) continue;
    process.env[key] = value;
  }
}

export function loadRuntimeEnv() {
  if (globalThis[GLOBAL_FLAG]) return;

  const currentModuleDir = path.dirname(fileURLToPath(import.meta.url));
  const appDataRoot = process.env.APPDATA || "";
  const lockedKeys = new Set(Object.keys(process.env));

  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(currentModuleDir, "runtime-env.generated"),
    appDataRoot ? path.join(appDataRoot, "Rectificadora App", "app.env") : "",
  ];

  for (const candidatePath of candidates) {
    try {
      loadEnvFromFile(candidatePath, lockedKeys);
    } catch (error) {
      console.warn("[runtime-env] failed to load", candidatePath, error?.message || error);
    }
  }

  globalThis[GLOBAL_FLAG] = true;
}

loadRuntimeEnv();
