import { getBodyDetails } from "@/features/solar-system/data/bodies";
import { getMission } from "../data/missions";
import type { Mission, MissionAction, MissionState, MissionStatus } from "../types/mission";

export const MISSION_STORAGE_KEY = "interstellar:mission-state:v1";
export const initialMissionState: MissionState = {
  activeMissionId: null, completedMissionIds: [], completedStepIds: [],
};

export function currentStep(mission: Mission, state: MissionState) {
  return mission.steps.find((step) => !state.completedStepIds.includes(step.id)) ?? null;
}

export function missionStatus(mission: Mission, state: MissionState): MissionStatus {
  if (state.completedMissionIds.includes(mission.id)) return "completed";
  if (state.activeMissionId === mission.id) return "active";
  if (mission.steps.some((step) => !getBodyDetails(step.bodyId))) return "locked";
  return "available";
}

export function missionReducer(state: MissionState, action: MissionAction): MissionState {
  if (action.type === "RESET_ACTIVE_MISSION") {
    return { ...state, activeMissionId: null, completedStepIds: [] };
  }
  if (action.type === "START_MISSION") {
    const mission = getMission(action.missionId);
    if (!mission || state.activeMissionId || missionStatus(mission, state) !== "available") return state;
    return { ...state, activeMissionId: mission.id, completedStepIds: [] };
  }
  const mission = getMission(state.activeMissionId);
  if (!mission) return state;
  const step = currentStep(mission, state);
  if (!step || step.bodyId !== action.bodyId || step.kind !== action.kind) return state;
  const completedStepIds = [...state.completedStepIds, step.id];
  if (completedStepIds.length === mission.steps.length) {
    return { activeMissionId: null, completedStepIds: [], completedMissionIds: [...state.completedMissionIds, mission.id] };
  }
  return { ...state, completedStepIds };
}

// Treat storage as untrusted input. Only a valid prefix of the active itinerary is accepted.
export function parseMissionState(raw: string | null): MissionState {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return initialMissionState;
    const record = value as Record<string, unknown>;
    const { activeMissionId, completedMissionIds, completedStepIds } = record;
    if (!(activeMissionId === null || typeof activeMissionId === "string") ||
      !Array.isArray(completedMissionIds) || !Array.isArray(completedStepIds)) return initialMissionState;
    if (!completedMissionIds.every((id): id is string => typeof id === "string" && getMission(id) !== null) ||
      new Set(completedMissionIds).size !== completedMissionIds.length) return initialMissionState;
    const active = getMission(activeMissionId);
    if (activeMissionId !== null && (!active || completedMissionIds.includes(activeMissionId) ||
      active.steps.some((step) => !getBodyDetails(step.bodyId)))) return initialMissionState;
    if ((!active && completedStepIds.length > 0) || (active &&
      (completedStepIds.length >= active.steps.length || !completedStepIds.every((id, index) => id === active.steps[index]?.id)))) return initialMissionState;
    return { activeMissionId, completedMissionIds, completedStepIds: completedStepIds as string[] };
  } catch {
    return initialMissionState;
  }
}
