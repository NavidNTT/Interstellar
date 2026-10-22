"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { MissionAction, MissionState, MissionStep } from "../types/mission";
import { initialMissionState, MISSION_STORAGE_KEY, missionReducer, parseMissionState } from "../utils/missionProgress";

type Store = { ready: boolean; progress: MissionState };
type Action = MissionAction | { type: "HYDRATE"; progress: MissionState };
function reducer(store: Store, action: Action): Store {
  if (action.type === "HYDRATE") return store.ready ? store : { ready: true, progress: action.progress };
  if (!store.ready) return store;
  const progress = missionReducer(store.progress, action);
  return progress === store.progress ? store : { ...store, progress };
}

export function useMissionState() {
  const [store, dispatch] = useReducer(reducer, { ready: false, progress: initialMissionState });
  useEffect(() => {
    let progress = initialMissionState;
    try { progress = parseMissionState(window.localStorage.getItem(MISSION_STORAGE_KEY)); } catch { /* Memory-only mode. */ }
    dispatch({ type: "HYDRATE", progress });
  }, []);
  useEffect(() => {
    if (!store.ready) return;
    try { window.localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(store.progress)); } catch { /* Exploration stays usable. */ }
  }, [store]);
  const startMission = useCallback((missionId: string) => dispatch({ type: "START_MISSION", missionId }), []);
  const recordObjective = useCallback((bodyId: string, kind: MissionStep["kind"]) => dispatch({ type: "RECORD_OBJECTIVE", bodyId, kind }), []);
  const resetActiveMission = useCallback(() => dispatch({ type: "RESET_ACTIVE_MISSION" }), []);
  return { state: store.progress, ready: store.ready, startMission, recordObjective, resetActiveMission };
}
