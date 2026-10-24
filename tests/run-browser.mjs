// Builds the frontend, then runs both existing CDP suites with disposable backend data.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.resolve(process.env.BROWSER_BACKEND_DIR || path.join(frontend, "../interstellar-api"));
const chrome = process.env.BROWSER_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const apiPort = Number(process.env.BROWSER_API_PORT || 8016);
const frontendPort = Number(process.env.BROWSER_FRONTEND_PORT || 3010);
const debugPort = Number(process.env.BROWSER_DEBUG_PORT || 9338);
const frontendUrl = `http://localhost:${frontendPort}`;
const apiBase = `http://localhost:${apiPort}/api`;
const debugBase = `http://127.0.0.1:${debugPort}`;
const children = [];
let temporary;

async function freePort(port) {
  assert.ok(Number.isInteger(port) && port > 1024 && port < 65536, "Invalid test port");
  for (const host of ["127.0.0.1", "::1"]) {
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(port, host, () => server.close(resolve));
    });
  }
}
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  child.stdout.on("data", chunk => process.stdout.write(chunk));
  child.stderr.on("data", chunk => process.stderr.write(chunk));
  child.completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(Error(`${command} exited ${code}`)));
  });
  child.completion.catch(() => {});
  return child;
}
async function run(command, args, cwd, env) {
  console.log(`RUN ${command} ${args.join(" ")}`);
  await start(command, args, cwd, env).completion;
}
async function ready(url, child) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw Error(`Server exited before ${url}`);
    try { if ((await fetch(url)).ok) return; } catch { /* server starting */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error(`Server did not become ready: ${url}`);
}
async function stop(child) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    await new Promise(resolve => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.once("exit", resolve); killer.once("error", resolve);
    });
  } else child.kill("SIGTERM");
  await child.completion.catch(() => {});
}

try {
  assert.ok(fs.existsSync(path.join(backend, "artisan")), "Backend directory must contain artisan");
  assert.ok(fs.existsSync(chrome), "Set BROWSER_CHROME_PATH to a Chrome executable");
  assert.equal(new Set([apiPort, frontendPort, debugPort]).size, 3);
  for (const port of [apiPort, frontendPort, debugPort]) await freePort(port);
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "interstellar-phase6-"));
  const database = path.join(temporary, "browser.sqlite");
  fs.writeFileSync(database, "", { flag: "wx" });
  assert.equal(path.dirname(database), temporary);
  const backendEnv = {
    ...process.env, APP_ENV: "testing", APP_DEBUG: "false", DB_CONNECTION: "sqlite", DB_DATABASE: database,
    DB_URL: "", CACHE_STORE: "array", SESSION_DRIVER: "array", LOG_CHANNEL: "stderr",
    FRONTEND_ORIGINS: frontendUrl, APP_CONFIG_CACHE: path.join(temporary, "config.php"),
    APP_ROUTES_CACHE: path.join(temporary, "routes.php"),
  };
  console.log(`ISOLATED DATABASE: sqlite ${database}`);
  await run("php", ["artisan", "config:show", "database.default"], backend, backendEnv);
  await run("php", ["artisan", "config:show", "database.connections.sqlite"], backend, backendEnv);
  await run("php", ["artisan", "migrate", "--seed", "--no-interaction"], backend, backendEnv);
  const frontendEnv = { ...process.env, NEXT_PUBLIC_API_BASE_URL: apiBase };
  await run(process.execPath, ["node_modules/next/dist/bin/next", "build"], frontend, frontendEnv);
  const api = start("php", ["-S", `localhost:${apiPort}`, path.join(backend, "vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php")], path.join(backend, "public"), backendEnv);
  const app = start(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", String(frontendPort)], frontend, frontendEnv);
  const browser = start(chrome, ["--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(temporary, "chrome")}`, "about:blank"], frontend, process.env);
  await Promise.all([ready(`${apiBase}/v1/celestial-bodies`, api), ready(frontendUrl, app), ready(`${debugBase}/json/version`, browser)]);
  const browserEnv = {
    ...process.env, MISSION_TEST_URL: frontendUrl, BROWSER_API_BASE: apiBase, BROWSER_DEBUG_URL: debugBase,
    BROWSER_SCREENSHOT_DIR: process.env.BROWSER_SCREENSHOT_DIR || path.join(temporary, "screenshots"),
  };
  await run(process.execPath, ["tests/api-browser.mjs"], frontend, browserEnv);
  await run(process.execPath, ["tests/mission-browser.mjs"], frontend, browserEnv);
  await stop(api);
  await assert.rejects(fetch(`${apiBase}/v1/celestial-bodies`));
  console.log("API stopped: verifying mission suite against actual connection refusal.");
  await run(process.execPath, ["tests/mission-browser.mjs"], frontend, browserEnv);
  console.log(`PASS all browser suites. Screenshots: ${browserEnv.BROWSER_SCREENSHOT_DIR}`);
} finally {
  for (const child of [...children].reverse()) await stop(child);
  // Preserve screenshots for explicit review; the profile/database are disposable.
  if (temporary) {
    for (const name of ["chrome", "browser.sqlite", "browser.sqlite-wal", "browser.sqlite-shm"]) {
      const target = path.resolve(temporary, name);
      assert.equal(path.dirname(target), temporary, "Cleanup must stay inside the owned temporary directory");
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    console.log(`Stopped owned processes; removed disposable database and Chrome profile: ${temporary}`);
  }
}
