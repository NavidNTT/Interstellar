"use client";

import type { ReactNode } from "react";
import { ExplorationDialog } from "./ExplorationDialog";
import type { CelestialBodyDetails } from "../types";
import { BodyStats } from "./BodyStats";
import { InterestingFacts } from "./InterestingFacts";

type BodyDetailsProps = {
  body: CelestialBodyDetails;
  onClose: () => void;
  missions: ReactNode;
};

export function BodyDetails({ body, onClose, missions }: BodyDetailsProps) {
  return (
    <ExplorationDialog title={body.name} eyebrow="Scientific profile" onClose={onClose}>
      <div className="mb-6 border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-amber-100">{body.type}</p>
        <p className="mt-3 text-sm leading-7 text-slate-200">{body.shortDescription}</p>
      </div>
      <section aria-labelledby="body-description-heading">
        <h3 id="body-description-heading" className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Scientific description</h3>
        <p className="text-sm leading-7 text-slate-300">{body.fullDescription}</p>
      </section>
      <section className="mt-6" aria-labelledby="body-statistics-heading">
        <h3 id="body-statistics-heading" className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Key statistics</h3>
        <BodyStats body={body} />
      </section>
      <section className="mt-6" aria-labelledby="body-composition-heading">
        <h3 id="body-composition-heading" className="text-xs uppercase tracking-[0.2em] text-slate-400">Atmosphere & composition</h3>
        <dl className="mt-3 space-y-4 text-sm leading-7">
          <div><dt className="font-medium text-slate-100">Atmosphere</dt><dd className="mt-1 text-slate-300">{body.atmosphere}</dd></div>
          <div><dt className="font-medium text-slate-100">Composition</dt><dd className="mt-1 text-slate-300">{body.composition}</dd></div>
        </dl>
      </section>
      <section className="mt-6" aria-labelledby="body-facts-heading">
        <h3 id="body-facts-heading" className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Interesting facts</h3>
        <InterestingFacts facts={body.interestingFacts} />
      </section>
      <section className="mt-8 border-t border-white/10 pt-6" aria-label="Related missions">
        <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Related missions</h3>
        {missions}
      </section>
    </ExplorationDialog>
  );
}
