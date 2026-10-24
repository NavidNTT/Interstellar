import type { Vector3Tuple } from "three";
import { celestialBodies } from "./bodies";

export const TRAVEL_DURATION_MS = 1800;

/** Field of view shared by the overview camera and the framing solve below. */
export const OVERVIEW_FOV = 45;

export type SceneBody = {
  readonly id: string;
  readonly type: string;
  readonly radius: number;
  readonly distanceFromSun: number;
};

export type OverviewFraming = {
  position: Vector3Tuple;
  target: Vector3Tuple;
  minDistance: number;
  maxDistance: number;
};

export type PlanetOrbit = { id: string; radius: number };

type Vec3 = [number, number, number];

// The original overview looked from [10, 8, 15] toward [3, 0, 0]. Keeping that direction
// preserves the established viewing angle while the distance is solved from the catalog.
const VIEW_DIRECTION = normalize([7, 8, 15]);
const UP: Vec3 = [0, 1, 0];
/** Bodies are kept inside 92% of each half-axis, leaving room for their own radii. */
const FRAME_NDC_LIMIT = 0.92;
/** Aspect ratio the default (initial) framing is solved for. */
const REFERENCE_ASPECT = 1.6;
/** Below this aspect the outer system needs a manual zoom-out; see OVERVIEW_MAX_DISTANCE. */
const MIN_SUPPORTED_ASPECT = 1.0;
/** The zoom-out limit leaves headroom beyond the narrowest supported framing distance. */
const ZOOM_HEADROOM = 1.15;
/** Gap kept between the zoom-in limit and the closest travel arrival. */
const ARRIVAL_CLEARANCE = 0.5;

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Mirrors the offset TravelCamera applies when flying to a body, so the zoom-in limit can be
 * derived from the real arrival distance instead of being guessed.
 */
export function travelArrivalOffset(radius: number): Vec3 {
  return [Math.max(2.6, radius * 4.5), Math.max(1.8, radius * 2.8), Math.max(3.2, radius * 5.5)];
}

export function travelArrivalDistance(radius: number): number {
  const [x, y, z] = travelArrivalOffset(radius);
  return Math.hypot(x, y, z);
}

/** Every planet in the catalog, ordered by scene orbit radius. The Sun is excluded. */
export function planetaryOrbits(bodies: readonly SceneBody[]): PlanetOrbit[] {
  return bodies
    .filter((body) => body.type === "planet")
    .map((body) => ({ id: body.id, radius: body.distanceFromSun }))
    .sort((a, b) => a.radius - b.radius);
}

/** Worst-case normalised device coordinate across all bodies for a given framing distance. */
function frameNdc(
  bodies: readonly SceneBody[],
  target: Vec3,
  distance: number,
  aspect: number,
): number {
  const position: Vec3 = [
    target[0] + VIEW_DIRECTION[0] * distance,
    target[1] + VIEW_DIRECTION[1] * distance,
    target[2] + VIEW_DIRECTION[2] * distance,
  ];
  // Same basis three.js builds for a camera looking from `position` at `target`.
  const zAxis = VIEW_DIRECTION;
  const xAxis = normalize(cross(UP, zAxis));
  const yAxis = cross(zAxis, xAxis);
  const tanVertical = Math.tan((OVERVIEW_FOV * Math.PI) / 360);
  const tanHorizontal = tanVertical * aspect;
  let worst = 0;
  for (const body of bodies) {
    const offset: Vec3 = [body.distanceFromSun - position[0], -position[1], -position[2]];
    const depth = -dot(offset, zAxis);
    if (depth <= 0) return Number.POSITIVE_INFINITY;
    worst = Math.max(
      worst,
      Math.abs(dot(offset, xAxis) / depth / tanHorizontal),
      Math.abs(dot(offset, yAxis) / depth / tanVertical),
    );
  }
  return worst;
}

/** Smallest distance at which every body stays inside FRAME_NDC_LIMIT for the given aspect. */
function requiredDistance(bodies: readonly SceneBody[], target: Vec3, aspect: number): number {
  let near = 0.001;
  let far = 1000;
  for (let step = 0; step < 80; step += 1) {
    const middle = (near + far) / 2;
    if (frameNdc(bodies, target, middle, aspect) <= FRAME_NDC_LIMIT) far = middle;
    else near = middle;
  }
  return far;
}

/**
 * Solves overview framing from the catalog: the target is the midpoint of the occupied extent
 * (including each body's scene radius) and the distance is solved so every body is framed.
 */
export function overviewFraming(bodies: readonly SceneBody[]): OverviewFraming {
  if (bodies.length === 0) {
    return { position: [10, 8, 15], target: [3, 0, 0], minDistance: 5, maxDistance: 28 };
  }
  const near = Math.min(...bodies.map((body) => body.distanceFromSun - body.radius));
  const far = Math.max(...bodies.map((body) => body.distanceFromSun + body.radius));
  const target: Vec3 = [(near + far) / 2, 0, 0];
  const distance = requiredDistance(bodies, target, REFERENCE_ASPECT);
  const minDistance = Math.min(...bodies.map((body) => travelArrivalDistance(body.radius))) - ARRIVAL_CLEARANCE;
  const maxDistance = requiredDistance(bodies, target, MIN_SUPPORTED_ASPECT) * ZOOM_HEADROOM;
  return {
    position: [
      target[0] + VIEW_DIRECTION[0] * distance,
      target[1] + VIEW_DIRECTION[1] * distance,
      target[2] + VIEW_DIRECTION[2] * distance,
    ],
    target,
    minDistance,
    maxDistance: Math.max(maxDistance, minDistance * 2),
  };
}

/** Framing derived once from the shipped catalog; tests assert it is computed, not hardcoded. */
export const OVERVIEW_FRAMING = overviewFraming(celestialBodies);

export const OVERVIEW_CAMERA_POSITION: Vector3Tuple = OVERVIEW_FRAMING.position;
export const OVERVIEW_CAMERA_TARGET: Vector3Tuple = OVERVIEW_FRAMING.target;
export const OVERVIEW_MIN_DISTANCE = OVERVIEW_FRAMING.minDistance;
export const OVERVIEW_MAX_DISTANCE = OVERVIEW_FRAMING.maxDistance;
