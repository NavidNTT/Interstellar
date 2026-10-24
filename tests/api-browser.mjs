// Use tests/run-browser.mjs for an isolated Laravel database and Chrome profile.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PerspectiveCamera, Vector3 } from "three";

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const apiBase = process.env.BROWSER_API_BASE || "http://localhost:8000/api";
const frontendUrl = process.env.MISSION_TEST_URL || "http://localhost:3010";
const debugBase = process.env.BROWSER_DEBUG_URL || "http://127.0.0.1:9338";
const target = await (await fetch(`${debugBase}/json/new?about:blank`, { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0, mode = "live", requestCount = 0;
const pending = new Map(), errors = [], tasks = new Set();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const requestedPaths = new Set();
const bodyResponse = await (await fetch(`${apiBase}/v1/celestial-bodies`)).json();
const missionResponse = await (await fetch(`${apiBase}/v1/missions`)).json();
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
  await send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: new URL(frontendUrl).origin }], body: Buffer.from(JSON.stringify(response)).toString("base64") });
}
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(message.error); else request.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map(arg => arg.value || arg.description).join(" "));
  if (message.method === "Network.requestWillBeSent" && message.params.request.url.startsWith(`${apiBase}/`)) {
    requestCount++; requestedPaths.add(message.params.request.url);
  }
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
  const point = await evaluate(`(() => {const r=${root};const b=Array.from(r.querySelectorAll('button')).find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Missing action: '+${JSON.stringify(label)});b.scrollIntoView({block:'center'});const box=b.getBoundingClientRect();const x=box.x+box.width/2,y=box.y+box.height/2;if(box.left<0||box.right>innerWidth||box.top<0||box.bottom>innerHeight||b.scrollWidth>b.clientWidth||!b.contains(document.elementFromPoint(x,y)))throw Error('Clipped or covered action: '+${JSON.stringify(label)});return {x,y}})()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 }); await pause(100);
}
async function navigate() {
  requestCount = 0;
  await send("Page.navigate", { url: frontendUrl });
  await wait("!!document.querySelector('canvas')");
}
const contains = text => `document.body.textContent.includes(${JSON.stringify(text)})`;
async function escape() {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await pause(100);
}
async function layout(label) {
  const failures = await evaluate(`(() => {
    const failures=[];
    if(document.documentElement.scrollWidth>innerWidth) failures.push('page overflow');
    const dialog=document.querySelector('dialog[open]:last-of-type');
    const roots=dialog?[dialog,dialog.lastElementChild]:[document.querySelector('aside')];
    for(const root of roots){const b=root.getBoundingClientRect();if(b.left<0||b.right>innerWidth||b.top<0||b.bottom>innerHeight||root.scrollWidth>root.clientWidth+1)failures.push('container clipping');}
    if(!dialog){const notice=document.querySelector('[aria-label="Catalog connection"]');notice.scrollIntoView({block:'center'});const text=notice.querySelector('p'),range=document.createRange();range.selectNodeContents(text);const b=text.getBoundingClientRect();for(const r of range.getClientRects())if(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)failures.push('notice text clipping');if(parseFloat(getComputedStyle(text).fontSize)<12)failures.push('notice font');}
    return failures;
  })()`);
  assert.deepEqual(failures, [], label);
}
async function screenshot(name) {
  const directory = process.env.BROWSER_SCREENSHOT_DIR || path.join(os.tmpdir(), "interstellar-browser-screenshots");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${name}.png`), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
}
async function responsiveFlow(title, width, state) {
  await layout(`${width} ${state} notice`);
  await click("BROWSE MISSIONS"); await layout(`${width} ${state} missions`);
  await click("START MISSION", title); await click("VIEW DESTINATION", title);
  assert.equal(await evaluate("document.querySelector('h1').textContent"), "Earth");
  await layout(`${width} ${state} selection`);
  await click("OPEN DETAILS"); await layout(`${width} ${state} details`);
  await screenshot(`${width}-${state}-details`);
  await click("VIEW ALL MISSIONS"); await layout(`${width} ${state} nested missions`);
  await escape(); assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 1);
  await escape(); assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 0);
  await click("TRAVEL TO EARTH"); await escape();
  assert.equal(await evaluate("document.querySelector('h1').textContent"), "Earth");
  await click("TRAVEL TO EARTH");
  await wait("document.querySelector('h1').textContent==='ARRIVED AT EARTH'");
  await layout(`${width} ${state} arrival`);
  await click("BACK TO OVERVIEW");
  await wait("document.querySelector('h1').textContent==='Awaiting selection'");
}
try {
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: `${apiBase}/*` }] });
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
  await screenshot("fallback-mobile");
  mode = "custom"; requestCount = 0; await click("RETRY CONNECTION"); await wait(contains("API catalog connected")); assert.equal(requestCount, 2);
  mode = "empty"; await navigate(); await wait(contains("No celestial bodies are published"));
  assert.ok(await evaluate("JSON.parse(localStorage.getItem('interstellar:mission-state:v1')).completedMissionIds.includes('api-contact')"));
  await click("BROWSE MISSIONS"); assert.equal(await evaluate("document.querySelectorAll('article').length"), 0); await escape();
  mode = "malformed"; await navigate(); await wait(contains("API unavailable"));
  assert.equal(requestCount, 2); assert.ok(await evaluate("!!document.querySelector('canvas')"));
  mode = "live"; await click("RETRY CONNECTION"); await wait(contains("API catalog connected"));
  await pause(400); assert.equal(requestCount, 4);
  for (const [width, height] of [[1440, 900], [768, 1024], [375, 812], [320, 568]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate("localStorage.removeItem('interstellar:mission-state:v1')");
    mode = "delayed"; await navigate(); await wait(contains("Loading exploration catalog"));
    await layout(`${width} loading`);
    await wait(contains("API catalog connected")); assert.equal(requestCount, 2);
    await responsiveFlow("API Contact Check", width, "connected");
    mode = "unavailable"; await navigate(); await wait(contains("API unavailable"));
    assert.equal(requestCount, 2); await screenshot(`${width}-fallback`);
    await responsiveFlow("First Contact", width, "fallback");
    const before = await evaluate("localStorage.getItem('interstellar:mission-state:v1')");
    mode = "delayed"; requestCount = 0; await click("RETRY CONNECTION");
    await wait(contains("Loading exploration catalog")); await layout(`${width} retry loading`);
    await wait(contains("API catalog connected")); assert.equal(requestCount, 2);
    await layout(`${width} recovered`);
    assert.equal(await evaluate("localStorage.getItem('interstellar:mission-state:v1')"), before);
    console.log(`PASS responsive ${width}x${height}: loading, connected/fallback missions, selection/details, nested Escape, travel cancel/arrival/overview, retry and retained progress; real pointer actions.`);
  }
  assert.deepEqual([...requestedPaths].sort(), [`${apiBase}/v1/celestial-bodies`, `${apiBase}/v1/missions`].sort());
  assert.deepEqual(errors, []);
  console.log("PASS: real Laravel API, exactly two catalog requests, delayed loading and canvas selection, API-only mission/scientific data, travel completion and reload persistence, connection failure, fallback, retry, empty/malformed data, mobile notices; no application console errors.");
} finally {
  await Promise.allSettled(tasks); await send("Fetch.disable"); socket.close();
  await fetch(`${debugBase}/json/close/${target.id}`);
}
