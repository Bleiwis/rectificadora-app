import { execSync } from "node:child_process";

const DEFAULT_PORT = 5173;
const portArg = process.argv[2];
const parsedPort = Number(portArg ?? DEFAULT_PORT);

if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
  console.error("Invalid port value.");
  process.exit(1);
}

try {
  const output = execSync(`lsof -ti tcp:${parsedPort}`, {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();

  if (!output) {
    process.exit(0);
  }

  const pids = output
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Ignore stale process ids.
    }
  }

  if (pids.length > 0) {
    console.log(`Freed tcp:${parsedPort} by stopping process(es): ${pids.join(", ")}`);
  }
} catch {
  // lsof exits with non-zero status when no process is using the port.
}
