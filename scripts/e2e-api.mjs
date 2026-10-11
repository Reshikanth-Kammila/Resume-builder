import { spawn } from "node:child_process";
import path from "node:path";
const python = path.resolve(
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const proc = spawn(python, ["-m", "tests.e2e_fixture"], {
  stdio: "inherit",
  env: { ...process.env, AI_MODE: "disabled" },
});
proc.on("exit", (code) => process.exit(code || 0));
process.on("SIGINT", () => proc.kill());
process.on("SIGTERM", () => proc.kill());
