"use client";

type InterestingFactsProps = { facts: string[] };

export function InterestingFacts({ facts }: InterestingFactsProps) {
  return (
    <ul className="space-y-3 text-sm leading-6 text-slate-300">
      {facts.map((fact) => (
        <li key={fact} className="min-w-0 border-l border-amber-200/50 pl-3">
          {fact}
        </li>
      ))}
    </ul>
  );
}
