import assert from "node:assert/strict";
import { test } from "node:test";
import { createTypeScriptLoader } from "./helpers/loadTypeScript.mjs";

const load = createTypeScriptLoader();
const { adaptBodies, adaptMissions, isBodyId } = load("lib/api/adapters");
const { CELESTIAL_BODY_IDS } = load("features/solar-system/types/index");
const { celestialBodies, getBodyDetails } = load("features/solar-system/data/bodies");
const { ApiError, requestData } = load("lib/api/client");
const { fetchCelestialBodies } = load("lib/api/celestialBodies");
const { fetchMissionDefinitions } = load("lib/api/missions");
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
const supportedIds = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
const originalIds = ["sun", "earth", "mars"];
const addedIds = ["mercury", "venus", "jupiter", "saturn", "uranus", "neptune"];
// Synthetic API fixtures exercise identifier support independently of the local catalog contents.
const supportedBodyPayload = supportedIds.map(slug => ({
  ...bodyPayload.find(body => body.slug === "earth"), slug, type: slug === "sun" ? "star" : "planet",
}));

test("body identifiers accept exactly the nine stable lowercase IDs", () => {
  assert.deepEqual(CELESTIAL_BODY_IDS, supportedIds);
  for (const id of supportedIds) assert.equal(isBodyId(id), true, id);
  for (const value of ["pluto", "moon", "EARTH", "Earth", " earth", "earth ", "earth-2", "", "toString", "constructor", "__proto__", null, undefined, 0, true, {}, []]) {
    assert.equal(isBodyId(value), false, String(value));
  }
});

test("the local catalog holds exactly the nine supported bodies with unique complete records", () => {
  const ids = celestialBodies.map(body => body.id);
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, 9);
  assert.deepEqual([...ids].sort(), [...supportedIds].sort());
  for (const id of supportedIds) {
    const body = getBodyDetails(id);
    assert.ok(body, id);
    assert.equal(body.id, id);
    assert.equal(body.type, id === "sun" ? "star" : "planet");
    assert.match(body.color, /^#[0-9a-f]{6}$/i);
    assert.ok(body.shortDescription.trim() && body.fullDescription.trim(), id);
    assert.ok(body.interestingFacts.length > 0, id);
    assert.equal(body.numberOfPlanets, id === "sun" ? "8" : "—", id);
  }
  for (const body of celestialBodies) assert.equal(getBodyDetails(body.id), body);
  for (const id of ["pluto", "moon", "Earth", " earth", "earth ", "earth-2", "", "toString", "constructor", "__proto__", null, undefined]) {
    assert.equal(getBodyDetails(id), null, String(id));
  }
});

test("the original three records survive unchanged and the new planets are appended", () => {
  assert.deepEqual(celestialBodies.map(body => body.id), [...originalIds, ...addedIds]);
  const baseline = {
    sun: { type: "star", radius: 1.8, distanceFromSun: 0, color: "#ffb347", numberOfMoons: "—", numberOfPlanets: "8" },
    earth: { type: "planet", radius: 0.62, distanceFromSun: 5.4, color: "#4d9de0", numberOfMoons: "1", numberOfPlanets: "—" },
    mars: { type: "planet", radius: 0.48, distanceFromSun: 8.2, color: "#c9684b", numberOfMoons: "2", numberOfPlanets: "—" },
  };
  for (const [id, expected] of Object.entries(baseline)) {
    for (const [key, value] of Object.entries(expected)) assert.equal(getBodyDetails(id)[key], value, `${id}.${key}`);
  }
});

test("the six new planets round-trip through the API adapter and use illustrative scene values", () => {
  const payload = bodyPayload.filter(body => addedIds.includes(body.slug));
  assert.deepEqual(payload.map(body => body.slug), addedIds);
  assert.deepEqual(adaptBodies(payload), addedIds.map(id => getBodyDetails(id)));
  for (const id of addedIds) {
    const body = getBodyDetails(id);
    assert.ok(body.radius > 0 && body.radius <= 10, `${id}.radius`);
    assert.ok(body.distanceFromSun >= 0 && body.distanceFromSun <= 100, `${id}.distanceFromSun`);
    assert.equal(body.numberOfPlanets, "—", id);
    assert.ok(body.interestingFacts.length >= 1, id);
  }
  const orbits = supportedIds.map(id => getBodyDetails(id).distanceFromSun);
  assert.deepEqual(orbits, [...orbits].sort((a, b) => a - b), "scene orbits increase outward from the Sun");
});

test("the five missions, eight ordered steps, and their destinations remain intact", () => {
  const missionIds = initialCatalog.missions.map(mission => mission.id);
  assert.deepEqual(missionIds, ["first-contact", "red-planet", "solar-observation", "inner-survey", "stellar-neighborhood"]);
  assert.deepEqual(
    initialCatalog.missions.flatMap(mission => mission.steps.map(step => step.id)),
    ["earth-visit", "mars-visit", "sun-visit", "survey-earth", "survey-mars", "inspect-sun", "inspect-earth", "inspect-mars"],
  );
  for (const mission of initialCatalog.missions) {
    assert.equal(mission.destinationBodyId, mission.steps[0].bodyId, mission.id);
    for (const step of mission.steps) assert.ok(getBodyDetails(step.bodyId), `${mission.id}:${step.id}`);
  }
  assert.deepEqual(adaptMissions(missionPayload, initialCatalog.bodies).map(mission => mission.id), missionIds);
  const partial = { activeMissionId: "inner-survey", completedMissionIds: ["first-contact"], completedStepIds: ["survey-earth"] };
  assert.deepEqual(parseMissionState(JSON.stringify(partial), initialCatalog.missions, initialCatalog.bodies, true), partial);
  const started = missionReducer(initialMissionState, { type: "START_MISSION", missionId: "red-planet" }, initialCatalog.missions, initialCatalog.bodies);
  assert.equal(started.activeMissionId, "red-planet");
});

test("body adapters accept complete records for all nine supported IDs", () => {
  const bodies = adaptBodies(supportedBodyPayload);
  assert.deepEqual(bodies.map(body => body.id), supportedIds);
  assert.deepEqual(adaptBodies([...supportedBodyPayload, { slug: "pluto" }]), bodies);
});

test("every supported body requires a complete valid record and unique ID", () => {
  for (const body of supportedBodyPayload) {
    for (const invalid of [{ slug: body.slug }, { ...body, scene_radius: NaN }, { ...body, color: "blue" }, { ...body, type: "dwarf-planet" }]) {
      assert.throws(() => adaptBodies([invalid]), ApiError, body.slug);
    }
    assert.throws(() => adaptBodies([body, body]), ApiError, body.slug);
  }
});

test("mission adapters accept supported destinations only when present in the API catalog", () => {
  const bodies = adaptBodies(supportedBodyPayload);
  const definition = body_slug => ({
    ...missionPayload[0], destinations: [{ ...missionPayload[0].destinations[0], body_slug }],
  });
  for (const id of supportedIds) {
    const [mission] = adaptMissions([definition(id)], bodies);
    assert.equal(mission.destinationBodyId, id);
    assert.equal(mission.steps[0].bodyId, id);
    assert.throws(() => adaptMissions([definition(id)], bodies.filter(body => body.id !== id)), ApiError, id);
  }
  for (const id of ["pluto", "Earth", "", null]) {
    assert.throws(() => adaptMissions([definition(id)], bodies), ApiError);
  }
});

test("catalog clients use v1 beneath the configured API base and omit credentials", async () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const previousFetch = globalThis.fetch;
  const requests = [];
  try {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://catalog.example.test/api/";
    globalThis.fetch = async (url, options) => {
      requests.push({ url, credentials: options.credentials, accept: options.headers.Accept });
      return new Response(JSON.stringify({ data: [] }));
    };
    const signal = new AbortController().signal;
    assert.deepEqual(await fetchCelestialBodies(signal), []);
    assert.deepEqual(await fetchMissionDefinitions(signal), []);
    assert.deepEqual(requests, ["celestial-bodies", "missions"].map(resource => ({
      url: `https://catalog.example.test/api/v1/${resource}`, credentials: "omit", accept: "application/json",
    })));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
  }
});

test("API adapters reproduce Phase 4 domain data and preserve stable IDs", () => {
  assert.deepEqual(adaptBodies(bodyPayload), initialCatalog.bodies);
  assert.deepEqual(adaptMissions(missionPayload, initialCatalog.bodies), initialCatalog.missions);
  assert.deepEqual(adaptBodies([]), []);
  assert.deepEqual(adaptMissions([], []), []);
});
test("unknown bodies are ignored and malformed catalogs or broken itineraries fail safely", () => {
  assert.deepEqual(adaptBodies([...bodyPayload, { slug: "pluto" }]), initialCatalog.bodies);
  for (const payload of [null, {}, [{ slug: "pluto" }], [{ slug: "sun" }], [{ ...bodyPayload[0], scene_radius: NaN }], [bodyPayload[0], bodyPayload[0]]]) {
    assert.throws(() => adaptBodies(payload), ApiError);
  }
  for (const slug of ["Earth", " earth", "earth ", "", null, 7]) {
    assert.throws(() => adaptBodies([...bodyPayload, { slug }]), ApiError);
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
