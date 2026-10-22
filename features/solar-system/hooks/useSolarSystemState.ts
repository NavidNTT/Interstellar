"use client";

import { useCallback, useState } from "react";
import type { CelestialBody, SolarSystemState } from "../types";

const initialState: SolarSystemState = {
  phase: "overview",
  selectedId: null,
  direction: null,
  requestId: 0,
};

export function useSolarSystemState() {
  const [state, setState] = useState<SolarSystemState>(initialState);

  const selectBody = useCallback((id: CelestialBody["id"]) => {
    setState((current) => {
      if (current.phase === "traveling") return current;
      return {
        phase: "selected",
        selectedId: id,
        direction: null,
        requestId: current.requestId,
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState((current) => {
      if (current.phase === "traveling") return current;
      return { phase: "overview", selectedId: null, direction: null, requestId: current.requestId };
    });
  }, []);

  const startTravel = useCallback(() => {
    setState((current) => {
      if (current.phase !== "selected") return current;
      return {
        phase: "traveling",
        selectedId: current.selectedId,
        direction: "to-body",
        requestId: current.requestId + 1,
      };
    });
  }, []);

  const returnToOverview = useCallback(() => {
    setState((current) => {
      if (current.phase !== "arrived") return current;
      return {
        phase: "traveling",
        selectedId: current.selectedId,
        direction: "to-overview",
        requestId: current.requestId + 1,
      };
    });
  }, []);

  const cancelTravel = useCallback(() => {
    setState((current) => {
      if (current.phase !== "traveling") return current;
      return current.direction === "to-body"
        ? {
            phase: "selected",
            selectedId: current.selectedId,
            direction: null,
            requestId: current.requestId,
          }
        : {
            phase: "arrived",
            selectedId: current.selectedId,
            direction: null,
            requestId: current.requestId,
          };
    });
  }, []);

  const completeTravel = useCallback(() => {
    setState((current) => {
      if (current.phase !== "traveling") return current;
      return current.direction === "to-body"
        ? {
            phase: "arrived",
            selectedId: current.selectedId,
            direction: null,
            requestId: current.requestId,
          }
        : {
            phase: "overview",
            selectedId: null,
            direction: null,
            requestId: current.requestId,
          };
    });
  }, []);

  return { state, selectBody, clearSelection, startTravel, returnToOverview, cancelTravel, completeTravel };
}
