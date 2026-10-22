import { useState } from "react";
import { celestialBodies } from "@/features/solar-system/data/bodies";
import { ExplorationDialog } from "@/features/solar-system/components/ExplorationDialog";
import type { MissionControls } from "./MissionCard";
import { MissionList } from "./MissionList";

export function MissionBrowser({ onClose, ...controls }: MissionControls & { onClose: () => void }) {
  const [bodyId, setBodyId] = useState("all");
  return <ExplorationDialog title="Exploration missions" eyebrow="Mission control" onClose={onClose}>
    <p className="mb-4 text-sm leading-6 text-slate-300">Choose a mission, then explore at your own pace. Starting a mission keeps your current view.</p>
    <label className="mb-5 block text-sm text-slate-300">Filter by destination
      <select className="mt-2 block min-h-11 w-full rounded-lg border border-white/20 bg-slate-900 p-3" value={bodyId} onChange={(event) => setBodyId(event.target.value)}>
        <option value="all">All missions</option>
        {celestialBodies.map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
      </select>
    </label>
    <MissionList {...controls} bodyId={bodyId === "all" ? undefined : bodyId} />
  </ExplorationDialog>;
}
