import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { createTypeScriptLoader } from "./helpers/loadTypeScript.mjs";

const load = createTypeScriptLoader();
const camera = load("features/solar-system/data/camera");
const lighting = load("features/solar-system/data/lighting");
const { celestialBodies } = load("features/solar-system/data/bodies");

const direction = new THREE.Vector3(...camera.OVERVIEW_CAMERA_POSITION)
  .sub(new THREE.Vector3(...camera.OVERVIEW_CAMERA_TARGET))
  .normalize();

/** Projects every catalog body through a real camera at the given position and aspect. */
function projectBodies(position, aspect) {
  const renderCamera = new THREE.PerspectiveCamera(camera.OVERVIEW_FOV, aspect, 0.1, 1000);
  renderCamera.position.set(position[0], position[1], position[2]);
  renderCamera.lookAt(new THREE.Vector3(...camera.OVERVIEW_CAMERA_TARGET));
  renderCamera.updateMatrixWorld(true);
  renderCamera.updateProjectionMatrix();
  return celestialBodies.map((body) => {
    const point = new THREE.Vector3(body.distanceFromSun, 0, 0).project(renderCamera);
    return { id: body.id, x: point.x, y: point.y, z: point.z };
  });
}

test("overview framing keeps all nine bodies inside the frame at the reference aspect and wider", () => {
  for (const aspect of [1.6, 1.7, 1.78, 2.0, 2.25, 2.5, 3.0]) {
    const projected = projectBodies(camera.OVERVIEW_CAMERA_POSITION, aspect);
    assert.equal(projected.length, 9);
    for (const point of projected) {
      assert.ok(Math.abs(point.x) <= 0.95, `${point.id} x=${point.x.toFixed(3)} at aspect ${aspect}`);
      assert.ok(Math.abs(point.y) <= 0.95, `${point.id} y=${point.y.toFixed(3)} at aspect ${aspect}`);
      assert.ok(point.z < 1, `${point.id} z=${point.z.toFixed(3)} at aspect ${aspect}`);
    }
  }
});

test("every body is reachable inside the zoom range down to the narrowest supported aspect", () => {
  for (const aspect of [1.0, 1.2, 1.4, 1.6, 2.0]) {
    const position = new THREE.Vector3(...camera.OVERVIEW_CAMERA_TARGET)
      .addScaledVector(direction, camera.OVERVIEW_MAX_DISTANCE)
      .toArray();
    for (const point of projectBodies(position, aspect)) {
      assert.ok(Math.abs(point.x) <= 1, `${point.id} x=${point.x.toFixed(3)} at aspect ${aspect}`);
      assert.ok(Math.abs(point.y) <= 1, `${point.id} y=${point.y.toFixed(3)} at aspect ${aspect}`);
      assert.ok(point.z < 1, `${point.id} z=${point.z.toFixed(3)} at aspect ${aspect}`);
    }
  }
  assert.ok(camera.OVERVIEW_MAX_DISTANCE > 0);
  assert.ok(camera.OVERVIEW_MIN_DISTANCE > 0);
  assert.ok(camera.OVERVIEW_MIN_DISTANCE < camera.OVERVIEW_MAX_DISTANCE);
});

test("narrower viewports need a manual zoom-out rather than automatic reframing", () => {
  // Documentation honesty check: framing is not responsive, so below the reference aspect the
  // outer system is intentionally outside the default view until the user zooms out.
  const projected = projectBodies(camera.OVERVIEW_CAMERA_POSITION, 1.0);
  assert.ok(
    projected.some((point) => Math.abs(point.x) > 1),
    "expected the default framing not to be aspect-responsive",
  );
});

test("travel arrivals stay within the zoom limits", () => {
  const closest = Math.min(...celestialBodies.map((body) => camera.travelArrivalDistance(body.radius)));
  const farthest = Math.max(...celestialBodies.map((body) => camera.travelArrivalDistance(body.radius)));
  assert.ok(closest > camera.OVERVIEW_MIN_DISTANCE, `arrival ${closest} at or below minDistance`);
  assert.ok(farthest < camera.OVERVIEW_MAX_DISTANCE, `arrival ${farthest} at or above maxDistance`);
  for (const body of celestialBodies) {
    const offset = camera.travelArrivalOffset(body.radius);
    const distance = camera.travelArrivalDistance(body.radius);
    assert.ok(Math.abs(Math.hypot(offset[0], offset[1], offset[2]) - distance) < 1e-9, body.id);
    assert.ok(distance >= camera.OVERVIEW_MIN_DISTANCE, body.id);
    assert.ok(distance <= camera.OVERVIEW_MAX_DISTANCE, body.id);
  }
});

test("orbit rings cover exactly the eight planets with catalog radii", () => {
  const orbits = camera.planetaryOrbits(celestialBodies);
  assert.equal(orbits.length, 8);
  assert.equal(new Set(orbits.map((orbit) => orbit.id)).size, 8);
  assert.equal(orbits.some((orbit) => orbit.id === "sun"), false);
  for (const orbit of orbits) {
    const body = celestialBodies.find((entry) => entry.id === orbit.id);
    assert.equal(body.type, "planet");
    assert.equal(orbit.radius, body.distanceFromSun);
  }
  const radii = orbits.map((orbit) => orbit.radius);
  assert.deepEqual(radii, [...radii].sort((a, b) => a - b));
});

test("lighting constants keep directional shading without blowing out the inner system", () => {
  const fill = lighting.fillIrradiance();
  assert.ok(fill >= 0.45 && fill <= 0.55, `fill ${fill}`);
  assert.ok(lighting.KEY_LIGHT_INTENSITY >= 1.3 && lighting.KEY_LIGHT_INTENSITY <= 1.6);
  // Contrast does not depend on distance, so it holds for the outermost body too.
  assert.ok(lighting.contrastRatio() >= 3, `contrast ${lighting.contrastRatio()}`);
  assert.equal(lighting.contrastRatio(), (lighting.KEY_LIGHT_INTENSITY + fill) / fill);
  for (const body of celestialBodies) {
    const accent = lighting.pointLightIrradiance(body.distanceFromSun);
    assert.ok(Number.isFinite(accent), body.id);
    if (body.distanceFromSun >= 14) {
      assert.ok(accent <= 0.35 * lighting.KEY_LIGHT_INTENSITY, `${body.id} accent ${accent}`);
    }
  }
  const mercury = celestialBodies.find((body) => body.id === "mercury");
  const mercuryAccent = lighting.pointLightIrradiance(mercury.distanceFromSun);
  assert.ok(mercuryAccent > 0, "the accent must actually illuminate the inner system");
  assert.ok(mercuryAccent <= 1.5 * lighting.KEY_LIGHT_INTENSITY, `mercury accent ${mercuryAccent}`);
});

test("overview framing is derived from the catalog rather than hardcoded", () => {
  const base = camera.overviewFraming(celestialBodies);
  assert.deepEqual(base.position, camera.OVERVIEW_CAMERA_POSITION);
  assert.deepEqual(base.target, camera.OVERVIEW_CAMERA_TARGET);
  const near = Math.min(...celestialBodies.map((body) => body.distanceFromSun - body.radius));
  const far = Math.max(...celestialBodies.map((body) => body.distanceFromSun + body.radius));
  assert.ok(Math.abs(base.target[0] - (near + far) / 2) < 1e-9);

  const perturbed = celestialBodies.map((body) =>
    body.id === "neptune" ? { ...body, distanceFromSun: 40 } : body,
  );
  const wider = camera.overviewFraming(perturbed);
  assert.notDeepEqual(wider.position, base.position);
  assert.ok(wider.target[0] > base.target[0], "a wider catalog moves the framing target outward");
  assert.ok(wider.maxDistance > base.maxDistance, "a wider catalog needs a larger zoom-out");
});
