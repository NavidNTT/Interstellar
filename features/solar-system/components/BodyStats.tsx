"use client";

import type { CelestialBodyDetails } from "../types";
import { bodyStatistics } from "../data/statistics";

type BodyStatsProps = { body: CelestialBodyDetails };

export function BodyStats({ body }: BodyStatsProps) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {bodyStatistics(body).map(({ label, key, value }) => (
        <div key={key} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <dt className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-400">{label}</dt>
          <dd className="mt-1 text-sm leading-6 text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
