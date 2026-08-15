import fs from "node:fs";
import path from "node:path";

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatVersionStamp(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}.${month}.${day}-${hour}${minute}`;
}

const now = new Date();
const buildVersion = `build-${formatVersionStamp(now)}`;
const builtAtIso = now.toISOString();

const outputPath = path.join(process.cwd(), "src", "generated", "build-info.ts");
const outputContent = `// Auto-generated at build time. Do not edit manually.\nexport const BUILD_VERSION = ${JSON.stringify(buildVersion)};\nexport const BUILD_BUILT_AT_ISO = ${JSON.stringify(builtAtIso)};\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, outputContent, "utf8");
console.log(`[build-version] ${buildVersion}`);
