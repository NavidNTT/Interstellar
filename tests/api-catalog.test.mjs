import assert from "node:assert/strict";
import { test } from "node:test";
import { createTypeScriptLoader } from "./helpers/loadTypeScript.mjs";

const load = createTypeScriptLoader();
const { adaptBodies, adaptMissions } = load("lib/api/adapters");
const { ApiError, requestData } = load("lib/api/client");
const { createCatalogStore, initialCatalog } = load("features/exploration/catalogStore");
const { missionReducer, initialMissionState, parseMissionState } = load("features/missions/utils/missionProgress");
const snake = key => key.replace(/[A-Z]/g, char => "_" + char.toLowerCase());
const bodyKeys = { id: "slug", radius: "scene_radius", distanceFromSun: "scene_orbit_radius", distanceFromSunDisplay: "distance_from_sun" };
const bodyPayload = initialCatalog.bodies.map(body => Object.fromEntries(Object.entries(body).map(([key, value]) => [bodyKeys[key] ?? snake(key), value])));
const missionPayload = initialCatalog.missions.map(mission => ({
  slug: mission.id, title: mission.title, description: mission.description, objective: mission.objective, category: mission.category,
  difficulty: mission.difficulty, estimated_duration: mission.estimatedDuration, completion_label: mission.completionLabel,
  destinations: mission.steps.map((step, index) => ({ slug: step.id, body_slug: step.bodyId, sequence: index + 1, kind: step.kind, objective: step.label })),
}));
const settle = () => new Promise(resolve => setImmediate(resolve));

test("API adapters reproduce Phase 4 domain data and preserve stable IDs", () => {
  assert.deepEqual(adaptBodies(bodyPayload), initialCatalog.bodies);
  assert.deepEqual(adaptMissions(missionPayload, initialCatalog.bodies), initialCatalog.missions);
  assert.deepEqual(adaptBodies([]), []);
  assert.deepEqual(adaptMissions([], []), []);
});
test("unknown bodies are ignored and malformed catalogs or broken itineraries fail safely", () => {
  assert.equal(adaptBodies([...bodyPayload, { slug: "jupiter" }]).length, 3);
  for (const payload of [null, {}, [{ slug: "sun" }], [{ ...bodyPayload[0], scene_radius: NaN }], [bodyPayload[0], bodyPayload[0]]]) {
    assert.throws(() => adaptBodies(payload), ApiError);
  }
  assert.throws(() => adaptMissions([{ ...missionPayload[0], destinations: [] }], initialCatalog.bodies), ApiError);
  assert.throws(() => adaptMissions(missionPayload, []), ApiError);
  assert.throws(() => adaptMissions([{ ...missionPayload[0], destinations: [{ ...missionPayload[0].destinations[0], sequence: 3 }] }], initialCatalog.bodies), ApiError);
});
test("API-provided missions use the reducer and survive persisted progress", () => {
  const definitions = adaptMissions([{ ...missionPayload[0], slug: "api-only-mission" }], initialCatalog.bodies);
  const active = missionReducer(initialMissionState, { type: "START_MISSION", missionId: "api-only-mission" }, definitions);
  assert.equal(active.activeMissionId, "api-only-mission");
  assert.deepEqual(parseMissionState(JSON.stringify(active), definitions), active);
  const completed = missionReducer(active, { type: "RECORD_OBJECTIVE", bodyId: "earth", kind: "visit" }, definitions);
  assert.deepEqual(completed.completedMissionIds, ["api-only-mission"]);
  assert.deepEqual(parseMissionState(JSON.stringify(completed), [], [], true), completed);
  assert.deepEqual(parseMissionState(JSON.stringify(active), [], [], true), active);
});
test("a refreshed itinerary cannot incorrectly complete older partial progress", () => {
  const state = { activeMissionId: "inner-survey", completedMissionIds: ["first-contact"], completedStepIds: ["survey-earth"] };
  const changed = initialCatalog.missions.map(mission => mission.id === "inner-survey" ? { ...mission, steps: [...mission.steps].reverse() } : mission);
  assert.equal(missionReducer(state, { type: "RECORD_OBJECTIVE", bodyId: "earth", kind: "visit" }, changed), state);
  assert.deepEqual(parseMissionState(JSON.stringify(state), changed, initialCatalog.bodies, true), {
    activeMissionId: null, completedStepIds: [], completedMissionIds: ["first-contact"],
  });
});
test("catalog failures use local data and retry recovers without request loops", async () => {
  let calls = 0;
  const store = createCatalogStore(async () => { if (++calls === 1) throw new ApiError("http", 503); return { bodies: initialCatalog.bodies, missions: initialCatalog.missions }; });
  const unsubscribe = store.subscribe(() => {});
  await settle();
  assert.equal(store.getSnapshot().status, "fallback");
  assert.equal(store.getSnapshot().bodies, initialCatalog.bodies);
  store.retry(); await settle();
  assert.equal(store.getSnapshot().status, "api");
  assert.equal(calls, 2);
  unsubscribe();
});
test("successful empty catalogs remain empty instead of silently falling back", async () => {
  const store = createCatalogStore(async () => ({ bodies: [], missions: [] }));
  const unsubscribe = store.subscribe(() => {}); await settle();
  assert.equal(store.getSnapshot().status, "empty");
  assert.deepEqual(store.getSnapshot().bodies, []);
  unsubscribe();
});
test("Strict Mode subscriptions share requests and unmount cancels pending loads", async () => {
  let calls = 0, requestSignal;
  const store = createCatalogStore(signal => { calls++; requestSignal = signal; return new Promise(() => {}); });
  const first = store.subscribe(() => {}); first();
  const second = store.subscribe(() => {}); await settle();
  assert.equal(calls, 1); assert.equal(requestSignal.aborted, false);
  second(); await settle(); assert.equal(requestSignal.aborted, true);
  const third = store.subscribe(() => {}); assert.equal(calls, 2); third(); await settle();
});
test("HTTP client handles configuration, non-2xx, invalid JSON, abort and timeout", async () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const previousFetch = globalThis.fetch;
  const previousTimer = globalThis.setTimeout;
  const controller = new AbortController();
  try {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    await assert.rejects(requestData("missions", controller.signal), error => error.code === "unconfigured");
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8000/api";
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
    assert.deepEqual(await requestData("missions", controller.signal), []);
    globalThis.fetch = async () => new Response("private details", { status: 503 });
    await assert.rejects(requestData("missions", controller.signal), error => error.code === "http" && error.status === 503 && !error.message.includes("private"));
    globalThis.fetch = async () => new Response("{broken", { status: 200 });
    await assert.rejects(requestData("missions", controller.signal), error => error.code === "invalid");
    globalThis.fetch = async () => { throw new TypeError("connection details"); };
    await assert.rejects(requestData("missions", controller.signal), error => error.code === "network");
    globalThis.fetch = async (url, { signal }) => new Promise((resolve, reject) => { signal.addEventListener("abort", () => reject(signal.reason), { once: true }); });
    globalThis.setTimeout = (callback) => previousTimer(callback, 1);
    await assert.rejects(requestData("missions", controller.signal), error => error.code === "timeout");
    const promise = requestData("missions", controller.signal); controller.abort();
    await assert.rejects(promise, error => error.name === "AbortError");
  } finally {
    globalThis.fetch = previousFetch; globalThis.setTimeout = previousTimer;
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
  }
});
