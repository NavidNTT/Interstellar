import { requestData } from "./client";

// Mapping waits for the body catalog so every destination can be validated.
export function fetchMissionDefinitions(signal: AbortSignal): Promise<unknown> {
  return requestData("v1/missions", signal);
}
