import { getBodyDetails } from "@/features/solar-system/data/bodies";
import type { Mission, MissionState } from "../types/mission";
import { currentStep, missionStatus } from "../utils/missionProgress";

export type MissionControls = {
  state: MissionState;
  ready: boolean;
  canSelectDestination: boolean;
  onStart: (id: string) => void;
  onDestination: (id: string) => void;
  onReset: () => void;
};

export function MissionCard({ mission, ...controls }: MissionControls & { mission: Mission }) {
  const { state, ready, canSelectDestination, onStart, onDestination, onReset } = controls;
  const status = missionStatus(mission, state);
  const step = status === "active" ? currentStep(mission, state) : mission.steps[0];
  const blocked = !!state.activeMissionId && status !== "active";
  return (
    <article className="mission-card" aria-label={mission.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium text-white">{mission.title}</h4>
        <span className={`mission-status mission-status-${status}`}>{status.toUpperCase()}</span>
      </div>
      <p className="mt-2 text-xs capitalize text-slate-400">{mission.category} · {mission.difficulty} · {mission.estimatedDuration}</p>
      <p className="mt-3 text-sm leading-6 text-slate-300">{mission.description}</p>
      <p className="mt-3 text-sm leading-6 text-slate-200"><strong>Objective: </strong>{mission.objective}</p>
      <ol className="mt-3 space-y-2 text-sm text-slate-300" aria-label="Mission steps">
        {mission.steps.map((item, index) => {
          const done = status === "completed" || (status === "active" && state.completedStepIds.includes(item.id));
          return <li key={item.id}>{done ? "✓ Completed" : item.id === step?.id && status === "active" ? "→ Current" : "Remaining"}: {index + 1}. {item.label}</li>;
        })}
      </ol>
      {status === "completed" ? <p className="mt-4 text-sm text-emerald-200">{mission.completionLabel}</p> :
        <p className="mt-3 text-xs text-amber-100">{status === "active" ? "Current destination" : "First destination"}: {getBodyDetails(step?.bodyId)?.name ?? "Unavailable"}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="mission-button" disabled={!ready || status === "completed" || status === "locked" || (status === "active" ? !canSelectDestination : blocked)}
          onClick={() => status === "active" && step ? onDestination(step.bodyId) : onStart(mission.id)}>
          {status === "completed" ? "MISSION COMPLETED" : status === "locked" ? "DESTINATION UNAVAILABLE" : status === "active" ? "VIEW DESTINATION" : "START MISSION"}
        </button>
        {status === "active" && <button type="button" className="mission-button" onClick={onReset}>ABANDON MISSION</button>}
      </div>
      {status === "active" && <p className="mt-3 text-xs leading-5 text-slate-400">{step?.kind === "inspect" ? "View the destination, then open its scientific details." : "View the destination, then press the travel button. Only a new arrival counts."} Abandoning clears this mission&apos;s steps.</p>}
      {blocked && status === "available" && <p className="mt-3 text-xs text-slate-400">Finish or abandon the active mission to start this one.</p>}
    </article>
  );
}
