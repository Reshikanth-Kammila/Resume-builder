import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const isWindows = process.platform === "win32";
const python = path.resolve(
  ".venv",
  isWindows ? "Scripts/python.exe" : "bin/python",
);
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!existsSync(python))
  run(isWindows ? "python" : "python3", ["-m", "venv", ".venv"]);
run(python, ["-m", "pip", "install", "-r", "requirements.lock"]);
run(python, ["-m", "playwright", "install", "chromium"]);
console.log(
  "Backend ready. Run npm install and npm run studio. Import your resume on first launch.",
);
