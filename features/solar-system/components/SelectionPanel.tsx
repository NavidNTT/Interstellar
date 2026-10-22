"use client";

import type { CelestialBody } from "../types";

type SelectionPanelProps = {
  selectedBody: CelestialBody | null;
};

export function SelectionPanel({ selectedBody }: SelectionPanelProps) {
  return (
    <aside className="pointer-events-none absolute left-4 top-4 z-10 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-slate-950/75 p-5 text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-md sm:left-6 sm:top-6 sm:p-6">
      <p className="text-[0.65rem] font-semibold tracking-[0.34em] text-sky-200/70">INTERSTELLAR</p>
      <p className="mt-2 text-[0.6rem] tracking-[0.25em] text-slate-400">SOLAR SYSTEM / 01</p>
      <div className="mt-7 border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected body</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight text-white">
          {selectedBody?.name ?? "Awaiting selection"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {selectedBody?.description ?? "Select a celestial body to explore."}
        </p>
      </div>
    </aside>
  );
}
