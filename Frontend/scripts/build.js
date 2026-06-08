const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const cwd = fs.realpathSync(process.cwd());
const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  cwd,
  env: { ...process.env, NODE_ENV: "production" },
});
process.exit(result.status ?? 1);
