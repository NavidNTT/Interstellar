"use client";

import { useEffect, useRef } from "react";
import type { CelestialBodyDetails } from "../types";
import { BodyStats } from "./BodyStats";
import { InterestingFacts } from "./InterestingFacts";

type BodyDetailsProps = {
  body: CelestialBodyDetails;
  onClose: () => void;
};

export function BodyDetails({ body, onClose }: BodyDetailsProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [body.id]);

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-end bg-black/35 p-3 sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="body-details-title"
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur-xl sm:max-h-[calc(100vh-3rem)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.25em] text-amber-200/80">Scientific profile</p>
            <h2 id="body-details-title" className="mt-2 text-2xl font-medium tracking-tight text-white sm:text-3xl">
              {body.name}
            </h2>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{body.type}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={`Close ${body.name} details`}
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-300 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            Close
          </button>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">
          <p className="text-sm leading-7 text-slate-300">{body.fullDescription}</p>
          <section className="mt-6" aria-labelledby="body-statistics-heading">
            <h3 id="body-statistics-heading" className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Key statistics</h3>
            <BodyStats body={body} />
          </section>
          <section className="mt-6" aria-labelledby="body-composition-heading">
            <h3 id="body-composition-heading" className="text-xs uppercase tracking-[0.2em] text-slate-400">Atmosphere & composition</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{body.atmosphere}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{body.composition}</p>
          </section>
          <section className="mt-6" aria-labelledby="body-facts-heading">
            <h3 id="body-facts-heading" className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Interesting facts</h3>
            <InterestingFacts facts={body.interestingFacts} />
          </section>
        </div>
      </section>
    </div>
  );
}
