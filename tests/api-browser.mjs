// Requires the Next.js production server, Laravel on port 8000, and isolated Chrome on port 9338.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const target = await (await fetch("http://127.0.0.1:9338/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0, mode = "live", requestCount = 0;
const pending = new Map(), errors = [], tasks = new Set();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const bodyResponse = await (await fetch("http://localhost:8000/api/celestial-bodies")).json();
const missionResponse = await (await fetch("http://localhost:8000/api/missions")).json();
async function respond(event) {
  const bodyRequest = event.request.url.includes("celestial-bodies");
  if (mode === "live") { await send("Fetch.continueRequest", { requestId: event.requestId }); return; }
  if (mode === "delayed") await pause(2500);
  let response = structuredClone(bodyRequest ? bodyResponse : missionResponse);
  if (mode === "empty") response = { data: [] };
  else if (mode === "malformed") response = { data: [{ slug: "unknown-body" }] };
  else if (mode === "unavailable") {
    await send("Fetch.failRequest", { requestId: event.requestId, errorReason: "ConnectionRefused" }); return;
  } else {
    if (bodyRequest) response.data.find(body => body.slug === "earth").full_description = "API scientific profile integration check.";
    else {
      const mission = response.data[0]; mission.slug = "api-contact"; mission.title = "API Contact Check";
      mission.destinations[0].slug = "api-arrive-earth";
    }
  }
  await send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "http://localhost:3010" }], body: Buffer.from(JSON.stringify(response)).toString("base64") });
}
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(message.error); else request.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map(arg => arg.value || arg.description).join(" "));
  if (message.method === "Network.requestWillBeSent" && message.params.request.url.includes(":8000/api/")) requestCount++;
  if (message.method === "Fetch.requestPaused") {
    const task = respond(message.params).catch(error => errors.push(error.message));
    tasks.add(task); task.finally(() => tasks.delete(task));
  }
});
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
}
async function wait(expression) {
  for (let attempt = 0; attempt < 150; attempt++) { if (await evaluate(expression)) return; await pause(100); }
  throw Error("Timed out: " + expression);
}
async function click(label, title) {
  const root = title ? `Array.from(document.querySelectorAll('article')).find(x=>x.getAttribute('aria-label')===${JSON.stringify(title)})` : "document.querySelector('dialog[open]:last-of-type') || document";
  await evaluate(`(() => {const r=${root};const b=Array.from(r.querySelectorAll('button')).find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Missing action: '+${JSON.stringify(label)});b.click()})()`); await pause(100);
}
async function navigate() {
  requestCount = 0;
  await send("Page.navigate", { url: process.env.MISSION_TEST_URL || "http://localhost:3010" });
  await wait("!!document.querySelector('canvas')");
}
const contains = text => `document.body.textContent.includes(${JSON.stringify(text)})`;
async function escape() {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await pause(100);
}
try {
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*://localhost:8000/api/*" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate(); await wait(contains("API catalog connected"));
  assert.equal(requestCount, 2);
  await evaluate("localStorage.removeItem('interstellar:mission-state:v1')");
  mode = "delayed"; await navigate(); await wait(contains("Loading exploration catalog"));
  await pause(700);
  // A real canvas click verifies selection remains available during loading.
  const camera = new PerspectiveCamera(45, 1440 / 900, 0.1, 1000);
  camera.position.set(10, 8, 15); camera.lookAt(3, 0, 0); camera.updateMatrixWorld();
  const sun = new Vector3(0, 0, 0).project(camera);
  const x = (sun.x + 1) * 720, y = (1 - sun.y) * 450;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await wait("document.querySelector('h1').textContent==='Sun'");
  const travelStarted = Date.now();
  await click("TRAVEL TO SUN");
  await wait(contains("API catalog connected")); assert.equal(requestCount, 2);
  await wait("document.querySelector('h1').textContent==='ARRIVED AT SUN'");
  assert.ok(Date.now() - travelStarted < 2800, "Catalog hydration must not restart the in-flight camera animation");
  const previousHeading = await evaluate("document.querySelector('h1').textContent");
  await click("BROWSE MISSIONS"); await click("START MISSION", "API Contact Check");
  assert.equal(await evaluate("document.querySelector('h1').textContent"), previousHeading);
  await click("VIEW DESTINATION", "API Contact Check"); await click("TRAVEL TO EARTH");
  await wait("document.querySelector('h1').textContent.includes('ARRIVED')");
  assert.ok(await evaluate("JSON.parse(localStorage.getItem('interstellar:mission-state:v1')).completedMissionIds.includes('api-contact')"));
  await click("OPEN DETAILS"); assert.ok(await evaluate(contains("API scientific profile integration check.")));
  await escape(); await navigate(); await wait(contains("API catalog connected"));
  assert.ok(await evaluate("JSON.parse(localStorage.getItem('interstellar:mission-state:v1')).completedMissionIds.includes('api-contact')"));
  mode = "unavailable"; await navigate(); await wait(contains("API unavailable"));
  assert.equal(requestCount, 2); await click("BROWSE MISSIONS");
  assert.equal(await evaluate("document.querySelectorAll('article').length"), 5);
  await escape();
  for (const [width, height] of [[768, 1024], [375, 812], [320, 568]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    assert.ok(await evaluate(`document.documentElement.scrollWidth<=${width}`));
    assert.ok(await evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='RETRY CONNECTION'&&!b.disabled)"));
  }
  fs.mkdirSync(".phase5/screenshots", { recursive: true });
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(".phase5/screenshots/fallback-mobile.png", Buffer.from(screenshot.data, "base64"));
  mode = "custom"; requestCount = 0; await click("RETRY CONNECTION"); await wait(contains("API catalog connected")); assert.equal(requestCount, 2);
  mode = "empty"; await navigate(); await wait(contains("No celestial bodies are published"));
  assert.ok(await evaluate("JSON.parse(localStorage.getItem('interstellar:mission-state:v1')).completedMissionIds.includes('api-contact')"));
  await click("BROWSE MISSIONS"); assert.equal(await evaluate("document.querySelectorAll('article').length"), 0); await escape();
  mode = "malformed"; await navigate(); await wait(contains("API unavailable"));
  assert.equal(requestCount, 2); assert.ok(await evaluate("!!document.querySelector('canvas')"));
  mode = "live"; await click("RETRY CONNECTION"); await wait(contains("API catalog connected"));
  await pause(400); assert.equal(requestCount, 4); assert.deepEqual(errors, []);
  console.log("PASS: real Laravel API, exactly two catalog requests, delayed loading and canvas selection, API-only mission/scientific data, travel completion and reload persistence, connection failure, fallback, retry, empty/malformed data, mobile notices; no application console errors.");
} finally {
  await Promise.allSettled(tasks); await send("Fetch.disable"); socket.close();
}
