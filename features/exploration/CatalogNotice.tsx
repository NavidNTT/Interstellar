import { useExplorationData } from "./ExplorationDataProvider";

export function CatalogNotice({ canRetry }: { canRetry: boolean }) {
  const catalog = useExplorationData();
  const message = catalog.status === "loading" ? "Loading exploration catalog. The local scene is ready."
    : catalog.status === "api" ? "API catalog connected"
    : catalog.status === "empty" ? `API connected. ${!catalog.bodies.length ? "No celestial bodies are published." : "No missions are published."}`
    : catalog.errorCode === "unconfigured" ? "Local catalog. API connection is not configured."
    : "API unavailable. Using the local exploration catalog.";
  return <div className="mt-3 rounded-lg border border-white/10 p-3 text-xs leading-5 text-slate-300" aria-label="Catalog connection">
    <p role="status">{message}</p>
    {(catalog.status === "fallback" || catalog.status === "empty") && <>
      <button type="button" className="mission-button mt-2" disabled={!canRetry} onClick={catalog.retry}>RETRY CONNECTION</button>
      {!canRetry && <p className="mt-2 text-slate-400">Stop travel before refreshing the catalog.</p>}
    </>}
  </div>;
}
