import { celestialBodies } from "@/features/solar-system/data/bodies";
import type { CelestialBodyDetails } from "@/features/solar-system/types";
import { missions } from "../data/missions";
import type { Mission, MissionAction, MissionState, MissionStatus } from "../types/mission";

export const MISSION_STORAGE_KEY = "interstellar:mission-state:v1";
export const initialMissionState: MissionState = {
  activeMissionId: null, completedMissionIds: [], completedStepIds: [],
};

export function currentStep(mission: Mission, state: MissionState) {
  return mission.steps.find((step) => !state.completedStepIds.includes(step.id)) ?? null;
}

export function missionStatus(mission: Mission, state: MissionState, bodies: readonly CelestialBodyDetails[] = celestialBodies): MissionStatus {
  if (state.completedMissionIds.includes(mission.id)) return "completed";
  if (mission.steps.some((step) => !bodies.some(body => body.id === step.bodyId))) return "locked";
  if (state.activeMissionId === mission.id) return "active";
  return "available";
}

export function missionReducer(state: MissionState, action: MissionAction, definitions: readonly Mission[] = missions, bodies: readonly CelestialBodyDetails[] = celestialBodies): MissionState {
  if (action.type === "RESET_ACTIVE_MISSION") {
    return { ...state, activeMissionId: null, completedStepIds: [] };
  }
  if (action.type === "START_MISSION") {
    const mission = definitions.find(item => item.id === action.missionId);
    if (!mission || state.activeMissionId || missionStatus(mission, state, bodies) !== "available") return state;
    return { ...state, activeMissionId: mission.id, completedStepIds: [] };
  }
  const mission = definitions.find(item => item.id === state.activeMissionId);
  if (!mission) return state;
  if (state.completedStepIds.some((id, index) => id !== mission.steps[index]?.id)) return state;
  const step = currentStep(mission, state);
  if (!step || step.bodyId !== action.bodyId || step.kind !== action.kind) return state;
  const completedStepIds = [...state.completedStepIds, step.id];
  if (completedStepIds.length === mission.steps.length) {
    return { activeMissionId: null, completedStepIds: [], completedMissionIds: [...state.completedMissionIds, mission.id] };
  }
  return { ...state, completedStepIds };
}

// Treat storage as untrusted input. Only a valid prefix of the active itinerary is accepted.
export function parseMissionState(raw: string | null, definitions: readonly Mission[] = missions, bodies: readonly CelestialBodyDetails[] = celestialBodies, retainUnavailable = false): MissionState {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return initialMissionState;
    const record = value as Record<string, unknown>;
    const { activeMissionId, completedMissionIds, completedStepIds } = record;
    if (!(activeMissionId === null || typeof activeMissionId === "string") ||
      !Array.isArray(completedMissionIds) || !Array.isArray(completedStepIds)) return initialMissionState;
    const validId = (id: unknown): id is string => typeof id === "string" && id.length <= 255 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
    if (!completedMissionIds.every((id): id is string => validId(id) && (retainUnavailable || definitions.some(item => item.id === id))) ||
      new Set(completedMissionIds).size !== completedMissionIds.length) return initialMissionState;
    if (!completedStepIds.every(validId) || new Set(completedStepIds).size !== completedStepIds.length ||
        (activeMissionId !== null && !validId(activeMissionId))) return initialMissionState;
    const active = definitions.find(item => item.id === activeMissionId);
    if (activeMissionId !== null && (completedMissionIds.includes(activeMissionId) ||
      (!retainUnavailable && (!active || active.steps.some((step) => !bodies.some(body => body.id === step.bodyId)))))) return initialMissionState;
    if (activeMissionId === null && completedStepIds.length > 0) return initialMissionState;
    if (active && (completedStepIds.length >= active.steps.length || !completedStepIds.every((id, index) => id === active.steps[index]?.id))) {
      return retainUnavailable ? { activeMissionId: null, completedStepIds: [], completedMissionIds } : initialMissionState;
    }
    return { activeMissionId, completedMissionIds, completedStepIds: completedStepIds as string[] };
  } catch {
    return initialMissionState;
  }
}
