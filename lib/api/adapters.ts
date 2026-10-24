import { ApiError } from "./client";
import type { CelestialBodyDetails, CelestialBodyId } from "@/features/solar-system/types";
import type { Mission, MissionStep } from "@/features/missions/types/mission";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("invalid");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 20000) throw new ApiError("invalid");
  return value;
}
function slug(value: unknown): string {
  const result = text(value);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result.length > 255) throw new ApiError("invalid");
  return result;
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new ApiError("invalid");
  return value;
}
export function isBodyId(value: unknown): value is CelestialBodyId {
  return value === "sun" || value === "earth" || value === "mars";
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 500) throw new ApiError("invalid");
  return value;
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new ApiError("invalid");
}

export function adaptBodies(payload: unknown): CelestialBodyDetails[] {
  const entries = list(payload);
  const result: CelestialBodyDetails[] = [];
  for (const entry of entries) {
    const body = object(entry);
    const id = slug(body.slug);
    // Phase 5 keeps the three-body scene's public identifier contract.
    if (!isBodyId(id)) continue;
    if (body.type !== "star" && body.type !== "planet") throw new ApiError("invalid");
    const color = text(body.color);
    if (!/^#[a-f\d]{6}$/i.test(color)) throw new ApiError("invalid");
    result.push({
      id, type: body.type, name: text(body.name), color,
      radius: number(body.scene_radius, 0.01, 10), distanceFromSun: number(body.scene_orbit_radius, 0, 100),
      shortDescription: text(body.short_description), fullDescription: text(body.full_description),
      diameter: text(body.diameter), mass: text(body.mass), gravity: text(body.gravity),
      averageTemperature: text(body.average_temperature), distanceFromSunDisplay: text(body.distance_from_sun),
      orbitalPeriod: text(body.orbital_period), rotationPeriod: text(body.rotation_period),
      numberOfMoons: text(body.number_of_moons), numberOfPlanets: text(body.number_of_planets),
      atmosphere: text(body.atmosphere), composition: text(body.composition), interestingFacts: list(body.interesting_facts).map(text),
    });
  }
  unique(result.map(body => body.id));
  if (entries.length > 0 && result.length === 0) throw new ApiError("invalid");
  return result;
}

export function adaptMissions(payload: unknown, bodies: readonly CelestialBodyDetails[]): Mission[] {
  const result = list(payload).map(entry => {
    const mission = object(entry);
    if (mission.category !== "observation" && mission.category !== "travel" && mission.category !== "science") throw new ApiError("invalid");
    if (mission.difficulty !== "introductory" && mission.difficulty !== "standard") throw new ApiError("invalid");
    const steps: MissionStep[] = list(mission.destinations).map((value, index) => {
      const step = object(value);
      if (!isBodyId(step.body_slug) || !bodies.some(body => body.id === step.body_slug) ||
          (step.kind !== "visit" && step.kind !== "inspect") || step.sequence !== index + 1) throw new ApiError("invalid");
      return { id: slug(step.slug), bodyId: step.body_slug, kind: step.kind, label: text(step.objective) };
    });
    unique(steps.map(step => step.id));
    const [first, ...remaining] = steps;
    if (!first) throw new ApiError("invalid");
    return {
      id: slug(mission.slug), title: text(mission.title), description: text(mission.description), objective: text(mission.objective),
      category: mission.category, difficulty: mission.difficulty, estimatedDuration: text(mission.estimated_duration),
      completionLabel: text(mission.completion_label), destinationBodyId: first.bodyId,
      steps: [first, ...remaining] as [MissionStep, ...MissionStep[]],
    } satisfies Mission;
  });
  unique(result.map(mission => mission.id));
  return result;
}
