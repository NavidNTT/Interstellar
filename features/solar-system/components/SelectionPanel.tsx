"use client";

import type { CelestialBody } from "../types";
import type { SolarSystemPhase, TravelDirection } from "../types";

type SelectionPanelProps = {
  selectedBody: CelestialBody | null;
  phase: SolarSystemPhase;
  direction: TravelDirection | null;
  onTravel: () => void;
  onStop: () => void;
  onBackToOverview: () => void;
  onDetails: () => void;
};

export function SelectionPanel({ selectedBody, phase, direction, onTravel, onStop, onBackToOverview, onDetails }: SelectionPanelProps) {
  const isTraveling = phase === "traveling";
  const status = !selectedBody
    ? "Awaiting selection"
    : phase === "traveling"
      ? direction === "to-overview"
        ? "RETURNING TO OVERVIEW"
        : `TRAVELING TO ${selectedBody.name.toUpperCase()}`
      : phase === "arrived"
        ? `ARRIVED AT ${selectedBody.name.toUpperCase()}`
        : selectedBody.name;

  return (
    <aside className="pointer-events-auto absolute left-4 top-4 z-10 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-slate-950/75 p-5 text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-md sm:left-6 sm:top-6 sm:p-6">
      <p className="text-[0.65rem] font-semibold tracking-[0.34em] text-sky-200/70">INTERSTELLAR</p>
      <p className="mt-2 text-[0.6rem] tracking-[0.25em] text-slate-400">SOLAR SYSTEM / 01</p>
      <div className="mt-7 border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected body</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight text-white">
          {status}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {selectedBody?.shortDescription ?? "Select a celestial body to explore."}
        </p>
        {selectedBody && phase !== "traveling" && (
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">{selectedBody.type}</p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          {phase === "selected" && (
            <button
              type="button"
              className="min-h-11 rounded-lg border border-amber-200/50 bg-amber-200/10 px-4 py-3 text-left text-xs font-semibold tracking-[0.16em] text-amber-100 transition hover:bg-amber-200/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
              onClick={onTravel}
              disabled={!selectedBody}
            >
              TRAVEL TO {selectedBody?.name.toUpperCase() ?? "BODY"}
            </button>
          )}
          {isTraveling && (
            <button
              type="button"
              className="min-h-11 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-left text-xs font-semibold tracking-[0.16em] text-slate-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={onStop}
            >
              STOP TRAVEL
            </button>
          )}
          {phase === "arrived" && (
            <button
              type="button"
              className="min-h-11 rounded-lg border border-amber-200/50 bg-amber-200/10 px-4 py-3 text-left text-xs font-semibold tracking-[0.16em] text-amber-100 transition hover:bg-amber-200/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
              onClick={onBackToOverview}
            >
              BACK TO OVERVIEW
            </button>
          )}
          {(phase === "selected" || phase === "arrived") && selectedBody && (
            <button
              type="button"
              className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-left text-xs font-semibold tracking-[0.16em] text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={onDetails}
            >
              OPEN DETAILS
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
