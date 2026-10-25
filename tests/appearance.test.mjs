import assert from "node:assert/strict";
import { test } from "node:test";
import { createTypeScriptLoader } from "./helpers/loadTypeScript.mjs";

const load = createTypeScriptLoader();
const { surfaceProfiles, createSurfaceMap, sampleSurfaceColor, SURFACE_MAP_WIDTH, SURFACE_MAP_HEIGHT } = load("features/solar-system/data/appearance");
const { CELESTIAL_BODY_IDS } = load("features/solar-system/types/index");
const { celestialBodies } = load("features/solar-system/data/bodies");
const planets = celestialBodies.filter(body => body.type === "planet");
const { SATURN_RING_PROFILE, saturnRingRadii, selectionMarkerRadii, createSaturnRingMap,
  sampleSaturnRing, atmosphereProfiles, atmosphereRadius } = load("features/solar-system/data/appearance");

test("surface profiles cover exactly the eight supported planets without changing the catalog", () => {
  assert.deepEqual(Object.keys(surfaceProfiles).sort(), CELESTIAL_BODY_IDS.filter(id => id !== "sun").sort());
  assert.equal(surfaceProfiles.sun, undefined);
  for (const profile of Object.values(surfaceProfiles)) {
    assert.ok(profile.roughness >= 0 && profile.roughness <= 1);
    assert.ok(profile.contrast > 0 && profile.contrast <= 0.25);
  }
});

test("every planet produces deterministic, opaque, bounded and nonuniform surface pixels", () => {
  for (const body of planets) {
    const before = structuredClone(body);
    const first = createSurfaceMap(body.id, body.color);
    const second = createSurfaceMap(body.id, body.color);
    assert.deepEqual(first, second, body.id);
    assert.notEqual(first.data, second.data, "CPU maps have independent ownership");
    assert.deepEqual(body, before, "generation must not mutate catalog records");
    assert.equal(first.width, 256);
    assert.equal(first.height, 128);
    assert.equal(first.data.length, first.width * first.height * 4);
    const colors = new Set();
    for (let offset = 0; offset < first.data.length; offset += 4) {
      const color = Array.from(first.data.slice(offset, offset + 3));
      assert.ok(color.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255));
      assert.equal(first.data[offset + 3], 255);
      colors.add(color.join(","));
    }
    assert.ok(colors.size > 16, `${body.id} needs visible surface variation`);
  }
});

test("longitude wraps continuously and surface detail converges at both poles", () => {
  for (const body of planets) {
    for (const v of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const sample = u => sampleSurfaceColor(body.id, body.color, u, v);
      assert.deepEqual(sample(0), sample(1), body.id);
      assert.deepEqual(sample(0.125), sample(1.125), body.id);
      assert.deepEqual(sample(0.875), sample(-0.125), body.id);
      const left = sample(1 - 1e-7), right = sample(1e-7);
      assert.ok(left.every((channel, index) => Math.abs(channel - right[index]) <= 1), `${body.id} seam`);
    }
    for (const pole of [0, 1]) {
      assert.deepEqual(sampleSurfaceColor(body.id, body.color, 0, pole), sampleSurfaceColor(body.id, body.color, 0.5, pole), `${body.id} pole`);
    }
  }
});

test("maps sample texel centers and respond to catalog color changes", () => {
  for (const body of planets) {
    const map = createSurfaceMap(body.id, body.color);
    for (const [column, row] of [[0, 0], [255, 64], [128, 32], [255, 127]]) {
      const offset = (row * map.width + column) * 4;
      assert.deepEqual(Array.from(map.data.slice(offset, offset + 3)),
        Array.from(sampleSurfaceColor(body.id, body.color, (column + 0.5) / map.width, (row + 0.5) / map.height)));
    }
    assert.notDeepEqual(map.data, createSurfaceMap(body.id, "#aabbcc").data, body.id);
  }
});

test("eight surface maps leave texture memory headroom for Saturn's ring map", () => {
  // RGBA8 base levels plus the complete mip chains, including a future 256² ring map.
  function mipBytes(width, height) {
    let bytes = 0;
    while (true) {
      bytes += width * height * 4;
      if (width === 1 && height === 1) return bytes;
      width = Math.max(1, width >> 1);
      height = Math.max(1, height >> 1);
    }
  }
  const bytes = planets.length * mipBytes(SURFACE_MAP_WIDTH, SURFACE_MAP_HEIGHT) + mipBytes(SATURN_RING_PROFILE.mapSize, SATURN_RING_PROFILE.mapSize);
  assert.ok(bytes < 2 * 1024 * 1024, `${bytes} texture bytes exceed budget`);
});

test("Saturn ring dimensions follow catalog radius and leave clearance for the selection marker", () => {
  assert.equal(SATURN_RING_PROFILE.tilt, 27 * Math.PI / 180);
  for (const radius of [0.1, 1.32, 3]) {
    const ring = saturnRingRadii(radius);
    assert.equal(ring.inner, radius * 1.35);
    assert.equal(ring.outer, radius * 2.15);
    const marker = selectionMarkerRadii("saturn", radius);
    assert.ok(marker.inner > ring.outer * 1.16);
    assert.ok(marker.outer > marker.inner);
    assert.deepEqual(selectionMarkerRadii("earth", radius), { inner: radius * 1.3, outer: radius * 1.37 });
  }
});

test("ring texture is deterministic with radial bands, a transparent gap and transparent outside", () => {
  const first = createSaturnRingMap(), second = createSaturnRingMap();
  assert.deepEqual(first, second);
  assert.notEqual(first.data, second.data);
  assert.equal(first.data.length, first.width * first.height * 4);
  const atRadius = radius => sampleSaturnRing(0.5 + radius / (2 * SATURN_RING_PROFILE.outerRatio), 0.5);
  assert.equal(atRadius(0)[3], 0);
  assert.equal(atRadius(2.2)[3], 0);
  assert.equal(atRadius(1.89)[3], 0);
  assert.equal(atRadius(1.6)[3], 255);
  assert.equal(atRadius(2.05)[3], 255);
  assert.notDeepEqual(atRadius(1.6), atRadius(1.7));
  assert.deepEqual(sampleSaturnRing(0.8, 0.6), sampleSaturnRing(0.6, 0.8), "bands must be radial");
  const alphas = new Set(first.data.filter((_, index) => index % 4 === 3));
  assert.deepEqual([...alphas].sort((a, b) => a - b), [0, 255]);
});

test("atmospheres cover exactly the intended five planets with particularly faint Mars", () => {
  assert.deepEqual(Object.keys(atmosphereProfiles).sort(), [...CELESTIAL_BODY_IDS].sort());
  assert.deepEqual(Object.entries(atmosphereProfiles).filter(([, profile]) => profile).map(([id]) => id).sort(),
    ["earth", "venus", "mars", "uranus", "neptune"].sort());
  for (const [id, profile] of Object.entries(atmosphereProfiles)) {
    if (!profile) { assert.equal(atmosphereRadius(id, 1), null); continue; }
    assert.match(profile.color, /^#[a-f\d]{6}$/i);
    assert.ok(profile.opacity > 0 && profile.opacity <= 0.15);
    assert.ok(profile.radiusScale > 1 && profile.radiusScale <= 1.05);
    for (const radius of [0.1, 0.62, 2]) assert.equal(atmosphereRadius(id, radius), radius * profile.radiusScale);
    if (id !== "mars") assert.ok(atmosphereProfiles.mars.opacity < profile.opacity / 2);
  }
});
