import assert from "node:assert/strict";
import { test } from "node:test";
import { createTypeScriptLoader } from "./helpers/loadTypeScript.mjs";

const load = createTypeScriptLoader();
const { bodyStatistics } = load("features/solar-system/data/statistics");
const { celestialBodies } = load("features/solar-system/data/bodies");

test("Sun statistics show planets in system without irrelevant orbital period or moons", () => {
  const sun = celestialBodies.find(body => body.id === "sun");
  const rows = bodyStatistics(sun);
  assert.equal(rows.find(row => row.label === "Planets in system").value, sun.numberOfPlanets);
  assert.ok(!rows.some(row => row.label === "Moons" || row.label === "Orbital period"));
});

test("all eight planets show moons and orbital periods without a planets-in-system placeholder", () => {
  for (const body of celestialBodies.filter(body => body.type === "planet")) {
    const rows = bodyStatistics(body);
    assert.equal(rows.find(row => row.label === "Moons").value, body.numberOfMoons);
    assert.equal(rows.find(row => row.label === "Orbital period").value, body.orbitalPeriod);
    assert.ok(!rows.some(row => row.label === "Planets in system"));
    for (const row of rows) assert.equal(row.value, body[row.key]);
  }
});

test("statistics preserve API display strings, long values and input records exactly", () => {
  const body = { ...celestialBodies.find(body => body.id === "earth"), mass: "API mass: 5.972 × 10²⁴ kg", diameter: "LongValue".repeat(100) };
  const before = structuredClone(body);
  assert.equal(bodyStatistics(body).find(row => row.key === "mass").value, body.mass);
  assert.equal(bodyStatistics(body).find(row => row.key === "diameter").value, body.diameter);
  assert.deepEqual(body, before);
});
