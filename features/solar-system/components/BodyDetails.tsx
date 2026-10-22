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
      <section className="mb-6" aria-label="Related missions">
        <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Related missions</h3>
        {missions}
      </section>
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
    </ExplorationDialog>
  );
}
