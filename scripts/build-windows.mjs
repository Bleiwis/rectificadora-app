import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function loadEnvFile(filePath) {
  const loaded = {};
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
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

    process.env[key] = value;
    loaded[key] = value;
  }

  return loaded;
}

function writeRuntimeEnvBundle(filePath, envMap) {
  const entries = Object.entries(envMap || {}).filter(([, value]) => String(value || "").trim() !== "");

  if (entries.length === 0) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  const lines = [
    "# Auto-generated at build time. Do not edit manually.",
    "# This file is bundled with the installer for runtime config on target devices.",
  ];

  for (const [key, value] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${key}=${String(value)}`);
  }

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const workspaceRoot = process.cwd();
const loadedEnv = loadEnvFile(path.join(workspaceRoot, ".env")) || {};
writeRuntimeEnvBundle(path.join(workspaceRoot, "electron/main/runtime-env.generated"), loadedEnv);

runCommand("npm", ["run", "build:web"]);
runCommand("npm", ["exec", "electron-builder", "--", "--win"]);
