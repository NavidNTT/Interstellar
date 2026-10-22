import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";

// Load the pure TypeScript domain code without adding a test runner dependency.
const root = path.resolve(import.meta.dirname, "..");
const cache = new Map();
function load(file) {
  const filename = file.endsWith(".ts") ? file : file + ".ts";
  if (cache.has(filename)) return cache.get(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule.exports);
  const localRequire = (id) => load(id.startsWith("@/") ? path.join(root, id.slice(2)) : path.resolve(path.dirname(filename), id));
  vm.runInThisContext("(function(require,loadedModule,exports){" + source + "\n})", { filename })(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { missionReducer: reduce, initialMissionState: initial, parseMissionState: parse, missionStatus } = load(path.join(root, "features/missions/utils/missionProgress"));
const { getMission, missions } = load(path.join(root, "features/missions/data/missions"));
const start = (state, missionId) => reduce(state, { type: "START_MISSION", missionId });
const visit = (state, bodyId, kind = "visit") => reduce(state, { type: "RECORD_OBJECTIVE", bodyId, kind });

test("every mission has an available destination and unique steps", () => {
  assert.equal(missions.length, 5);
  for (const mission of missions) {
    assert.equal(missionStatus(mission, initial), "available");
    assert.equal(new Set(mission.steps.map(s => s.id)).size, mission.steps.length);
    assert.equal(mission.destinationBodyId, mission.steps[0].bodyId);
  }
});
test("unknown IDs, repeated starts and competing missions preserve progress", () => {
  assert.equal(start(initial, "unknown"), initial);
  assert.equal(getMission("unknown"), null);
  const active = start(initial, "first-contact");
  assert.equal(start(active, "first-contact"), active);
  assert.equal(start(active, "red-planet"), active);
  assert.equal(visit(active, "unknown"), active);
  assert.equal(visit(active, "mars"), active);
  assert.equal(visit(active, "earth", "inspect"), active);
});
test("single arrival completes once and cannot be restarted", () => {
  const completed = visit(start(initial, "first-contact"), "earth");
  assert.deepEqual(completed.completedMissionIds, ["first-contact"]);
  assert.equal(completed.activeMissionId, null);
  assert.equal(visit(completed, "earth"), completed);
  assert.equal(start(completed, "first-contact"), completed);
});
test("ordered itinerary ignores future and repeated destinations and round-trips storage", () => {
  const active = start(initial, "inner-survey");
  assert.equal(visit(active, "mars"), active);
  const earth = visit(active, "earth");
  assert.deepEqual(earth.completedStepIds, ["survey-earth"]);
  assert.equal(visit(earth, "earth"), earth);
  assert.deepEqual(parse(JSON.stringify(earth)), earth);
  assert.deepEqual(visit(earth, "mars").completedMissionIds, ["inner-survey"]);
});
test("inspection objectives require details events in order", () => {
  let state = start(initial, "stellar-neighborhood");
  assert.equal(visit(state, "sun"), state);
  for (const body of ["sun", "earth", "mars"]) state = visit(state, body, "inspect");
  assert.deepEqual(state.completedMissionIds, ["stellar-neighborhood"]);
});
test("abandon clears active steps and retains completed missions", () => {
  let state = visit(start(initial, "first-contact"), "earth");
  state = visit(start(state, "inner-survey"), "earth");
  state = reduce(state, { type: "RESET_ACTIVE_MISSION" });
  assert.deepEqual(state, { ...initial, completedMissionIds: ["first-contact"] });
});
test("corrupted, unknown and inconsistent persisted state recovers cleanly", () => {
  const invalid = [null, "{broken", "null", "[]", JSON.stringify({}),
    JSON.stringify({ ...initial, activeMissionId: "unknown" }),
    JSON.stringify({ ...initial, completedMissionIds: ["first-contact", "first-contact"] }),
    JSON.stringify({ ...initial, completedMissionIds: [42] }),
    JSON.stringify({ ...initial, completedStepIds: ["survey-earth"] }),
    JSON.stringify({ ...initial, activeMissionId: "inner-survey", completedStepIds: ["survey-mars"] }),
    JSON.stringify({ ...initial, activeMissionId: "inner-survey", completedStepIds: ["survey-earth", "survey-mars"] }),
    JSON.stringify({ ...initial, activeMissionId: "first-contact", completedMissionIds: ["first-contact"] })];
  for (const raw of invalid) assert.deepEqual(parse(raw), initial);
});
