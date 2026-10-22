"use client";

import type { CelestialBodyDetails } from "../types";

type BodyStatsProps = { body: CelestialBodyDetails };

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

export function BodyStats({ body }: BodyStatsProps) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {statistics.map(([label, key]) => (
        <div key={key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <dt className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-400">{label}</dt>
          <dd className="mt-1 text-sm leading-5 text-slate-100">{body[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
