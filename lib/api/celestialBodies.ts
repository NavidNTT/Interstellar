import { requestData } from "./client";
import { adaptBodies } from "./adapters";

export async function fetchCelestialBodies(signal: AbortSignal) {
  return adaptBodies(await requestData("v1/celestial-bodies", signal));
}
