import type { CelestialBody } from "../types";

export const celestialBodies: CelestialBody[] = [
  {
    id: "sun",
    name: "Sun",
    type: "star",
    radius: 1.8,
    distanceFromSun: 0,
    color: "#ffb347",
    description: "The warm, luminous anchor of this small prototype system.",
  },
  {
    id: "earth",
    name: "Earth",
    type: "planet",
    radius: 0.62,
    distanceFromSun: 5.4,
    color: "#4d9de0",
    description: "A blue world with a hint of green, orbiting in the inner system.",
  },
  {
    id: "mars",
    name: "Mars",
    type: "planet",
    radius: 0.48,
    distanceFromSun: 8.2,
    color: "#c9684b",
    description: "A rust-colored outer neighbor on a wider representative orbit.",
  },
];

export const bodyById = Object.fromEntries(
  celestialBodies.map((body) => [body.id, body]),
) as Record<CelestialBody["id"], CelestialBody>;
