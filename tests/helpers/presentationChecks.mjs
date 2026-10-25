import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { createTypeScriptLoader } from "./loadTypeScript.mjs";

const load = createTypeScriptLoader();
const cameraData = load("features/solar-system/data/camera");
const { SATURN_RING_PROFILE } = load("features/solar-system/data/appearance");
const { bodyStatistics } = load("features/solar-system/data/statistics");
const { adaptBodies } = load("lib/api/adapters");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Test-profile instrumentation only; no production hooks or application globals.
export function installResourceCounters() {
  const active = { textures: new Set(), buffers: new Set() };
  for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Context) continue;
    for (const [name, suffix] of [["textures", "Texture"], ["buffers", "Buffer"]]) {
      const create = Context.prototype[`create${suffix}`];
      const remove = Context.prototype[`delete${suffix}`];
      Context.prototype[`create${suffix}`] = function (...args) {
        const resource = create.apply(this, args);
        if (resource) active[name].add(resource);
        return resource;
      };
      Context.prototype[`delete${suffix}`] = function (resource) {
        active[name].delete(resource);
        return remove.call(this, resource);
      };
    }
  }
  window.__interstellarTestResources = () => ({ textures: active.textures.size, buffers: active.buffers.size });
}

export async function presentationChecks({ send, evaluate, wait, click, escape, layout, screenshot, bodies: records }) {
  const bodies = adaptBodies(records);
  // A wide desktop viewport keeps the established left panel clear of inner-body clicks.
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const camera = new PerspectiveCamera(cameraData.OVERVIEW_FOV, 1920 / 1080, 0.1, 1000);
  camera.position.set(...cameraData.OVERVIEW_CAMERA_POSITION);
  camera.lookAt(new Vector3(...cameraData.OVERVIEW_CAMERA_TARGET));
  camera.updateMatrixWorld();
  const point = (body, offset = new Vector3()) => {
    const projected = offset.clone().add(new Vector3(body.distanceFromSun, 0, 0)).project(camera);
    return { x: (projected.x + 1) * 960, y: (1 - projected.y) * 540 };
  };
  async function select(body, offset) {
    const coords = point(body, offset);
    assert.ok(coords.x > 0 && coords.x < 1920 && coords.y > 0 && coords.y < 1080, `${body.id} pointer in viewport`);
    assert.equal(await evaluate(`document.elementFromPoint(${coords.x},${coords.y})?.tagName`), "CANVAS", `${body.id} pointer must reach canvas`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...coords });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", ...coords, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...coords, button: "left", clickCount: 1 });
    await wait(`document.querySelector('h1').textContent===${JSON.stringify(body.name)}`);
  }
  const details = () => evaluate(`(() => {
    const d=document.querySelector('dialog[open]');
    return {title:d.querySelector('h2').textContent, content:d.textContent,
      headings:Array.from(d.querySelectorAll('h3')).map(x=>x.textContent),
      stats:Array.from(d.querySelector('#body-statistics-heading').parentElement.querySelectorAll('dt')).map(x=>x.textContent)};
  })()`);
  await pause(750);
  for (const body of bodies) {
    // Includes real surface clicks through every atmosphere shell.
    await select(body);
    await click("OPEN DETAILS");
    const info = await details();
    assert.equal(info.title, body.name);
    for (const value of [body.shortDescription, body.fullDescription, body.atmosphere, body.composition]) assert.ok(info.content.includes(value), `${body.id} catalog content`);
    assert.deepEqual(info.headings.slice(0, 5), ["Scientific description", "Key statistics", "Atmosphere & composition", "Interesting facts", "Related missions"]);
    assert.deepEqual(info.stats, bodyStatistics(body).map(row => row.label));
    await escape();
    assert.equal(await evaluate("document.activeElement.textContent.trim()"), "OPEN DETAILS");
  }
  const saturn = bodies.find(body => body.id === "saturn");
  await escape(); // Clear selection before testing an unscaled annulus point.
  await select(saturn, new Vector3(0, -saturn.radius * 1.65, 0).applyAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2 + SATURN_RING_PROFILE.tilt));
  await click("TRAVEL TO SATURN");
  await wait("document.querySelector('h1').textContent==='ARRIVED AT SATURN'");
  await screenshot("presentation-saturn-arrival");
  await click("BACK TO OVERVIEW");
  await wait("document.querySelector('h1').textContent==='Awaiting selection'");
  await screenshot("presentation-overview");

  // Inspection advances only through the explicit details action, including after reload.
  await click("BROWSE MISSIONS"); await click("START MISSION", "Stellar Neighborhood");
  await click("VIEW DESTINATION", "Stellar Neighborhood");
  const steps = () => evaluate("JSON.parse(localStorage.getItem('interstellar:mission-state:v1')).completedStepIds");
  assert.deepEqual(await steps(), []);
  await send("Page.reload"); await wait("!!document.querySelector('canvas')");
  await wait("document.querySelector('[aria-label=\"Catalog connection\"]')?.textContent.includes('API catalog connected')");
  assert.deepEqual(await steps(), []);
  await pause(750); await select(bodies.find(body => body.id === "sun"));
  assert.deepEqual(await steps(), []);
  await click("OPEN DETAILS"); assert.deepEqual(await steps(), ["inspect-sun"]);
  await click("VIEW ALL MISSIONS"); await escape();
  assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 1);
  assert.equal(await evaluate("document.activeElement.textContent.trim()"), "VIEW ALL MISSIONS");
  await escape();
  const earth = bodies.find(body => body.id === "earth");
  await select(earth); assert.deepEqual(await steps(), ["inspect-sun"]);
  await click("OPEN DETAILS"); assert.deepEqual(await steps(), ["inspect-sun", "inspect-earth"]);
  await escape();

  // Warm both selected states, then compare live WebGL object counts at the same endpoint.
  const cycle = async () => {
    await select(saturn); await select(earth); await click("OPEN DETAILS"); await escape(); await pause(350);
  };
  await cycle();
  const baseline = await evaluate("window.__interstellarTestResources?.()");
  if (baseline && baseline.textures > 0 && baseline.buffers > 0) {
    const samples = [];
    for (let index = 0; index < 10; index++) {
      await cycle();
      const resources = await evaluate("window.__interstellarTestResources()");
      samples.push(resources);
      assert.deepEqual(resources, baseline, `WebGL resource growth in cycle ${index + 1}`);
    }
    console.log("PASS live WebGL allocation counters across ten selection/details cycles:", JSON.stringify({ baseline, samples }));
  } else console.log("UNVERIFIED live GPU resources: WebGL allocation counters unavailable.");
  await click("OPEN DETAILS"); await layout("presentation dialog"); await escape(); await escape();
  await evaluate("localStorage.removeItem('interstellar:mission-state:v1')");
  await send("Page.reload"); await wait("document.querySelector('[aria-label=\"Catalog connection\"]')?.textContent.includes('API catalog connected')");
  console.log("PASS presentation interactions: nine body profiles, atmosphere pointer pass-through, Saturn surface/ring selection and round trip, explicit inspection semantics, nested Escape/focus restoration.");
}
