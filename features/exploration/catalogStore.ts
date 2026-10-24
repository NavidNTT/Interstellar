import { celestialBodies } from "@/features/solar-system/data/bodies";
import { missions } from "@/features/missions/data/missions";
import type { CelestialBodyDetails } from "@/features/solar-system/types";
import type { Mission } from "@/features/missions/types/mission";
import { fetchCelestialBodies } from "@/lib/api/celestialBodies";
import { fetchMissionDefinitions } from "@/lib/api/missions";
import { adaptMissions } from "@/lib/api/adapters";
import { ApiError } from "@/lib/api/client";

export type Catalog = { bodies: readonly CelestialBodyDetails[]; missions: readonly Mission[] };
export type CatalogSnapshot = Catalog & { status: "loading" | "api" | "empty" | "fallback"; errorCode?: ApiError["code"] };
export const initialCatalog: CatalogSnapshot = { bodies: celestialBodies, missions, status: "loading" };

export async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const [bodies, definitions] = await Promise.all([fetchCelestialBodies(signal), fetchMissionDefinitions(signal)]);
  return { bodies, missions: adaptMissions(definitions, bodies) };
}

export function createCatalogStore(loader = loadCatalog) {
  let snapshot = initialCatalog;
  let controller: AbortController | null = null;
  let loaded = false;
  const listeners = new Set<() => void>();
  const publish = (next: CatalogSnapshot) => { snapshot = next; listeners.forEach(listener => listener()); };
  const start = () => {
    if (controller) return;
    const request = new AbortController();
    controller = request;
    publish({ ...snapshot, status: "loading", errorCode: undefined });
    loader(request.signal).then(catalog => {
      if (request.signal.aborted) return;
      loaded = true;
      publish({ ...catalog, status: catalog.bodies.length && catalog.missions.length ? "api" : "empty" });
    }).catch(error => {
      if (request.signal.aborted) return;
      request.abort();
      loaded = true;
      publish({ bodies: celestialBodies, missions, status: "fallback", errorCode: error instanceof ApiError ? error.code : "network" });
    }).finally(() => { if (controller === request) controller = null; });
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialCatalog,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!loaded || snapshot.status === "loading") start();
      return () => {
        listeners.delete(listener);
        // Strict Mode's immediate resubscription shares the same in-flight requests.
        queueMicrotask(() => {
          if (!listeners.size && controller) {
            controller.abort(); controller = null;
          }
        });
      };
    },
    retry: start,
  };
}
