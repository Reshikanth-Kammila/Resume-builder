import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const python = path.resolve(
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
if (!existsSync(python)) {
  console.error("Run npm run setup first.");
  process.exit(1);
}
const api = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "backend.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
  ],
  { stdio: "inherit", shell: false },
);
const web = spawn(
  process.execPath,
  [
    path.resolve("node_modules/next/dist/bin/next"),
    process.argv.includes("--production") ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  api.kill();
  web.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", stop);
web.on("exit", stop);
console.log(
  "Reshi Resume Studio: http://127.0.0.1:3000 — private, on this device.",
);
