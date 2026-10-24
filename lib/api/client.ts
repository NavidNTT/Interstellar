export class ApiError extends Error {
  constructor(public readonly code: "unconfigured" | "http" | "network" | "invalid" | "timeout", public readonly status?: number) {
    super("Exploration data could not be loaded.");
    this.name = "ApiError";
  }
}

export async function requestData(path: string, signal: AbortSignal): Promise<unknown> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!base) throw new ApiError("unconfigured");
  try {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch { throw new ApiError("invalid"); }
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 5000);
  try {
    const response = await fetch(`${base}/${path}`, {
      signal: AbortSignal.any([signal, timeout.signal]),
      headers: { Accept: "application/json" }, credentials: "omit",
    });
    if (!response.ok) throw new ApiError("http", response.status);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload)) throw new ApiError("invalid");
    return payload.data;
  } catch (error) {
    if (signal.aborted) throw error;
    if (timeout.signal.aborted) throw new ApiError("timeout");
    if (error instanceof ApiError) throw error;
    throw new ApiError(error instanceof SyntaxError ? "invalid" : "network");
  } finally { clearTimeout(timer); }
}
