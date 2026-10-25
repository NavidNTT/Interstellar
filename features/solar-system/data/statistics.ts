import type { CelestialBodyDetails } from "../types";

const statistics = [
  ["Diameter", "diameter"],
  ["Mass", "mass"],
  ["Gravity", "gravity"],
  ["Average temperature", "averageTemperature"],
  ["Distance from Sun", "distanceFromSunDisplay"],
  ["Orbital period", "orbitalPeriod"],
  ["Rotation period", "rotationPeriod"],
  ["Moons", "numberOfMoons"],
  ["Planets in system", "numberOfPlanets"],
] as const satisfies ReadonlyArray<readonly [string, keyof CelestialBodyDetails]>;

/** Select relevant fields without parsing or rewriting catalog display strings. */
export function bodyStatistics(body: CelestialBodyDetails) {
  return statistics
    .filter(([, key]) => {
      if (key === "numberOfPlanets") return body.type === "star";
      if (key === "numberOfMoons" || key === "orbitalPeriod") return body.type === "planet";
      return true;
    })
    .map(([label, key]) => ({ label, key, value: body[key] }));
}
