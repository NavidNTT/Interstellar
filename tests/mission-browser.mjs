// Run against an isolated Chrome profile with remote debugging on port 9338.
import assert from "node:assert/strict";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tabs = await (await fetch("http://127.0.0.1:9338/json")).json();
const socket = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(message.params.args.map((arg) => arg.value || arg.description).join(" "));
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await pause(150);
  }
  throw Error("Timed out: " + expression);
}
async function click(label, title) {
  const root = title ? `Array.from(document.querySelectorAll('article')).find(x=>x.getAttribute('aria-label')===${JSON.stringify(title)})` : "document.querySelector('dialog[open]:last-of-type') || document";
  await evaluate(`(() => {const root=${root}; const b=Array.from(root.querySelectorAll('button')).find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b || b.disabled)throw Error('Missing button: '+${JSON.stringify(label)});b.click()})()`);
  await pause(120);
}
async function key(name, code) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name, windowsVirtualKeyCode: code });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name, windowsVirtualKeyCode: code });
  await pause(120);
}
const escape = () => key("Escape", 27);
const progress = () => evaluate("JSON.parse(localStorage.getItem('interstellar:mission-state:v1'))");
const arrived = () => wait("document.querySelector('h1').textContent.includes('ARRIVED')");
const reload = async () => {
  await send("Page.reload");
  await wait("!!document.querySelector('canvas')");
  await pause(600);
};
try {
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: process.env.MISSION_TEST_URL || "http://localhost:3010" });
  await wait("!!document.querySelector('canvas')"); await pause(1000);
  await evaluate("localStorage.removeItem('interstellar:mission-state:v1')"); await reload();
  await click("BROWSE MISSIONS"); assert.equal(await evaluate("document.querySelectorAll('article').length"), 5);
  await evaluate("(() => {const s=document.querySelector('select');s.value='sun';s.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await wait("document.querySelectorAll('article').length===2");
  await evaluate("(() => {const s=document.querySelector('select');s.value='all';s.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await wait("document.querySelectorAll('article').length===5");
  await click("START MISSION", "First Contact"); await click("VIEW DESTINATION", "First Contact");
  assert.equal(await evaluate("document.querySelector('h1').textContent"), "Earth");
  await click("TRAVEL TO EARTH"); await escape();
  assert.equal((await progress()).activeMissionId, "first-contact");
  assert.deepEqual((await progress()).completedMissionIds, []);
  await click("TRAVEL TO EARTH"); await arrived();
  assert.deepEqual((await progress()).completedMissionIds, ["first-contact"]);
  await click("OPEN DETAILS"); assert.equal(await evaluate("document.querySelectorAll('article').length"), 3);
  for (let i = 0; i < 15; i++) { await key("Tab", 9); assert.ok(await evaluate("!!document.activeElement.closest('dialog')")); }
  await click("VIEW ALL MISSIONS"); await escape();
  assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 1);
  await escape(); await click("BACK TO OVERVIEW");
  await wait("document.querySelector('h1').textContent==='Awaiting selection'");
  await click("BROWSE MISSIONS"); await click("START MISSION", "Inner System Survey");
  await click("VIEW DESTINATION", "Inner System Survey"); await click("TRAVEL TO EARTH"); await arrived();
  assert.deepEqual((await progress()).completedStepIds, ["survey-earth"]); await reload();
  assert.equal((await progress()).activeMissionId, "inner-survey");
  await click("BROWSE MISSIONS"); await click("VIEW DESTINATION", "Inner System Survey");
  await click("TRAVEL TO MARS"); await arrived(); assert.ok((await progress()).completedMissionIds.includes("inner-survey"));
  await click("BROWSE MISSIONS"); await click("START MISSION", "Stellar Neighborhood");
  for (const body of ["sun", "earth", "mars"]) {
    await click("VIEW DESTINATION", "Stellar Neighborhood"); await click("OPEN DETAILS"); await escape();
    if (body !== "mars") await click("BROWSE MISSIONS");
  }
  assert.ok((await progress()).completedMissionIds.includes("stellar-neighborhood"));
  await click("BROWSE MISSIONS");
  for (const [width, height] of [[1440, 900], [768, 1024], [375, 812], [320, 568]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    const metrics = await evaluate("(() => {const d=document.querySelector('dialog[open]'),s=d.lastElementChild;return {page:document.documentElement.scrollWidth,dialog:d.getBoundingClientRect().width,overflow:s.scrollWidth>s.clientWidth,scroll:s.scrollHeight>s.clientHeight}})()");
    assert.ok(metrics.page <= width && metrics.dialog <= width && !metrics.overflow && metrics.scroll);
    console.log("Responsive layout passed:", width);
  }
  await escape(); await click("OPEN DETAILS");
  assert.ok(await evaluate("document.querySelector('dialog').lastElementChild.scrollHeight>document.querySelector('dialog').lastElementChild.clientHeight"));
  await escape();
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await pause(250);
  const before = (await send("Page.captureScreenshot", { format: "png" })).data;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 1000, y: 600, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1100, y: 650, button: "left", buttons: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1100, y: 650, button: "left", clickCount: 1 });
  await pause(250);
  assert.notEqual((await send("Page.captureScreenshot", { format: "png" })).data, before);
  await evaluate("localStorage.setItem('interstellar:mission-state:v1','{broken')"); await reload();
  assert.equal((await progress()).activeMissionId, null);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "Object.defineProperty(window,'localStorage',{get(){throw Error('Unavailable storage')}})" });
  await reload(); await click("BROWSE MISSIONS"); await click("START MISSION", "First Contact");
  await click("VIEW DESTINATION", "First Contact"); await click("TRAVEL TO EARTH"); await arrived();
  assert.deepEqual(errors, []);
  console.log("PASS: mission flows, cancellation, focus, Escape, persistence, storage failures, scene drag, responsive layouts; no console errors.");
} finally {
  socket.close();
}
