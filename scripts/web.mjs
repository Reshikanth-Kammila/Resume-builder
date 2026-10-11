import { spawn } from "node:child_process";
import path from "node:path";
const mode = process.argv[2] || "dev";
const args = [path.resolve("node_modules/next/dist/bin/next"), mode];
if (mode === "dev" || mode === "start") args.push("--hostname", "127.0.0.1");
const proc = spawn(process.execPath, args, {
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
proc.on("exit", (code) => process.exit(code || 0));
process.on("SIGINT", () => proc.kill());
process.on("SIGTERM", () => proc.kill());
