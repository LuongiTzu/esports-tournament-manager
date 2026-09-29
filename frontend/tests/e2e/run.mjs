import { execFileSync } from "node:child_process";
import path from "node:path";

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "E2E_DATABASE_URL is required and must point to an isolated e2e/test database.",
  );
}

const frontendDirectory = path.resolve(import.meta.dirname, "../..");
const backendDirectory = path.resolve(frontendDirectory, "../backend");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const playwright = path.join(
  frontendDirectory,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "playwright.cmd" : "playwright",
);
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  E2E_DATABASE_URL: databaseUrl,
  RUN_UI_E2E: "true",
};

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

run(npm, ["run", "prisma:migrate:deploy"], backendDirectory);
run(npm, ["run", "prisma:ui-smoke:seed"], backendDirectory);
run(playwright, ["test", ...process.argv.slice(2)], frontendDirectory);
