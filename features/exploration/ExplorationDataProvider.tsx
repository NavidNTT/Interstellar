"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createCatalogStore, initialCatalog } from "./catalogStore";

const defaultValue = {
  ...initialCatalog,
  getBody: (id: string | null | undefined) => initialCatalog.bodies.find(body => body.id === id) ?? null,
  getMission: (id: string | null | undefined) => initialCatalog.missions.find(mission => mission.id === id) ?? null,
  retry: () => {},
};
const CatalogContext = createContext(defaultValue);

export function ExplorationDataProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createCatalogStore);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const value = useMemo(() => ({
    ...snapshot, retry: store.retry,
    getBody: (id: string | null | undefined) => snapshot.bodies.find(body => body.id === id) ?? null,
    getMission: (id: string | null | undefined) => snapshot.missions.find(mission => mission.id === id) ?? null,
  }), [snapshot, store]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useExplorationData() { return useContext(CatalogContext); }
