import type { CelestialBodyId } from "@/features/solar-system/types";

export type MissionStatus = "locked" | "available" | "active" | "completed";
export type MissionCategory = "observation" | "travel" | "science";
export type MissionStep = {
  id: string;
  bodyId: CelestialBodyId;
  kind: "visit" | "inspect";
  label: string;
};
export type Mission = {
  id: string;
  title: string;
  description: string;
  objective: string;
  destinationBodyId: CelestialBodyId;
  category: MissionCategory;
  difficulty: "introductory" | "standard";
  estimatedDuration: string;
  completionLabel: string;
  steps: readonly [MissionStep, ...MissionStep[]];
};
export type MissionState = {
  activeMissionId: string | null;
  completedMissionIds: string[];
  completedStepIds: string[];
};
export type MissionAction =
  | { type: "START_MISSION"; missionId: string }
  | { type: "RECORD_OBJECTIVE"; bodyId: string; kind: MissionStep["kind"] }
  | { type: "RESET_ACTIVE_MISSION" };
