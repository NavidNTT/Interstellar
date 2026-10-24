import { useExplorationData } from "@/features/exploration/ExplorationDataProvider";
import { MissionCard, type MissionControls } from "./MissionCard";

export function MissionList({ bodyId, ...controls }: MissionControls & { bodyId?: string }) {
  const { missions } = useExplorationData();
  const related = bodyId === undefined ? missions : missions.filter((mission) => mission.steps.some((step) => step.bodyId === bodyId));
  return <div className="space-y-3">{related.length ? related.map((mission) => <MissionCard key={mission.id} mission={mission} {...controls} />) : <p className="text-sm text-slate-400">No missions are available for this view.</p>}</div>;
}
