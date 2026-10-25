import type { CelestialBodyId } from "../types";

export type PlanetId = Exclude<CelestialBodyId, "sun">;
type RGB = readonly [number, number, number];
type SurfaceProfile = {
  readonly style: "rocky" | "terrestrial" | "clouds" | "bands";
  readonly seed: number;
  readonly contrast: number;
  readonly roughness: number;
};

// Presentation only: scientific records, scene dimensions and API data stay untouched.
export const surfaceProfiles = {
  mercury: { style: "rocky", seed: 11, contrast: 0.18, roughness: 0.9 },
  venus: { style: "clouds", seed: 23, contrast: 0.1, roughness: 0.82 },
  earth: { style: "terrestrial", seed: 37, contrast: 0.12, roughness: 0.72 },
  mars: { style: "rocky", seed: 41, contrast: 0.16, roughness: 0.92 },
  jupiter: { style: "bands", seed: 53, contrast: 0.2, roughness: 0.86 },
  saturn: { style: "bands", seed: 67, contrast: 0.12, roughness: 0.88 },
  uranus: { style: "bands", seed: 79, contrast: 0.045, roughness: 0.78 },
  neptune: { style: "bands", seed: 83, contrast: 0.1, roughness: 0.8 },
} as const satisfies Record<PlanetId, SurfaceProfile>;

export const SURFACE_MAP_WIDTH = 256;
export const SURFACE_MAP_HEIGHT = 128;
export const SELECTED_SURFACE_EMISSIVE_INTENSITY = 0.08;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(min: number, max: number, value: number): number {
  const t = clamp((value - min) / (max - min));
  return t * t * (3 - 2 * t);
}

function parseColor(color: string): RGB {
  if (!/^#[a-f\d]{6}$/i.test(color)) throw new Error("Surface color must be a six-digit hex color.");
  return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

function scale(color: RGB, brightness: number): RGB {
  return [color[0] * brightness, color[1] * brightness, color[2] * brightness];
}

function sample(profile: SurfaceProfile, base: RGB, u: number, v: number): RGB {
  // Sample on the unit sphere rather than a flat noise grid: longitude wraps and
  // surface detail converges at the poles. No randomness, clock or browser APIs.
  const longitude = (u - Math.floor(u)) * Math.PI * 2;
  const latitude = (clamp(v) - 0.5) * Math.PI;
  const x = Math.cos(latitude) * Math.cos(longitude);
  const y = Math.sin(latitude);
  const z = Math.cos(latitude) * Math.sin(longitude);
  const phase = profile.seed * 0.73;
  const broad = (
    Math.sin(3 * x + 2 * y + phase) * Math.cos(3 * z - y) +
    0.5 * Math.sin(7 * z + 4 * y - phase) * Math.cos(5 * x + y)
  ) / 1.5;
  const fine = Math.sin(29 * x + 17 * z + phase) * Math.cos(23 * y - 11 * z);
  let color: RGB;

  if (profile.style === "terrestrial") {
    // Illustrative land/ocean masks, deliberately not a map of Earth's geography.
    const land = smoothstep(0.02, 0.2, broad);
    const ocean = scale(base, 0.82 + profile.contrast * broad);
    const vegetation = mix(base, [88, 128, 65], 0.85);
    color = mix(ocean, vegetation, land);
    color = mix(color, [221, 234, 232], smoothstep(0.91, 0.98, Math.abs(y)));
    const cloud = smoothstep(0.4, 0.85, broad + 0.24 * fine) * 0.18;
    color = mix(color, [239, 242, 239], cloud);
  } else {
    const variation = profile.style === "bands"
      ? Math.sin(y * 34 + broad * 1.8) * 0.75 + broad * 0.25
      : profile.style === "clouds"
        ? broad * 0.8 + Math.sin(y * 12 + broad) * 0.2
        : broad * 0.7 + fine * 0.3;
    const brightness = 0.94 + profile.contrast * variation;
    color = scale(base, brightness);
  }

  return [
    Math.round(clamp(color[0], 0, 255)),
    Math.round(clamp(color[1], 0, 255)),
    Math.round(clamp(color[2], 0, 255)),
  ];
}

/** Returns sRGB bytes at a UV coordinate; u=0 and u=1 sample the same meridian. */
export function sampleSurfaceColor(id: PlanetId, baseColor: string, u: number, v: number): RGB {
  return sample(surfaceProfiles[id], parseColor(baseColor), u, v);
}

/** Pure CPU data. The client rendering layer owns the corresponding GPU texture. */
export function createSurfaceMap(id: PlanetId, baseColor: string) {
  const profile = surfaceProfiles[id];
  const base = parseColor(baseColor);
  const data = new Uint8Array(SURFACE_MAP_WIDTH * SURFACE_MAP_HEIGHT * 4);
  for (let row = 0; row < SURFACE_MAP_HEIGHT; row += 1) {
    for (let column = 0; column < SURFACE_MAP_WIDTH; column += 1) {
      // Texel centers pair with RepeatWrapping; do not duplicate the seam column.
      const color = sample(profile, base, (column + 0.5) / SURFACE_MAP_WIDTH, (row + 0.5) / SURFACE_MAP_HEIGHT);
      const offset = (row * SURFACE_MAP_WIDTH + column) * 4;
      data.set(color, offset);
      data[offset + 3] = 255;
    }
  }
  return { data, width: SURFACE_MAP_WIDTH, height: SURFACE_MAP_HEIGHT };
}

export const SATURN_RING_PROFILE = {
  innerRatio: 1.35,
  outerRatio: 2.15,
  gapInnerRatio: 1.85,
  gapOuterRatio: 1.94,
  tilt: 27 * Math.PI / 180,
  segments: 128,
  mapSize: 256,
} as const;

export function saturnRingRadii(radius: number) {
  return { inner: radius * SATURN_RING_PROFILE.innerRatio, outer: radius * SATURN_RING_PROFILE.outerRatio };
}

export function selectionMarkerRadii(id: CelestialBodyId, radius: number) {
  // Saturn's outer ring grows to 2.494 radii when selected (2.15 * 1.16).
  return id === "saturn"
    ? { inner: radius * 2.6, outer: radius * 2.67 }
    : { inner: radius * 1.3, outer: radius * 1.37 };
}

/** UVs match RingGeometry's planar mapping rather than a radial strip. */
export function sampleSaturnRing(u: number, v: number): readonly [number, number, number, number] {
  const profile = SATURN_RING_PROFILE;
  const radius = Math.hypot(2 * u - 1, 2 * v - 1) * profile.outerRatio;
  const gap = radius >= profile.gapInnerRatio && radius <= profile.gapOuterRatio;
  if (radius < profile.innerRatio || radius > profile.outerRatio || gap) return [35, 27, 19, 0];
  const bands = 0.86 + 0.09 * Math.sin(radius * 95) + 0.05 * Math.sin(radius * 237);
  return [Math.round(220 * bands), Math.round(195 * bands), Math.round(150 * bands), 255];
}

export function createSaturnRingMap() {
  const size = SATURN_RING_PROFILE.mapSize;
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      data.set(sampleSaturnRing((column + 0.5) / size, (row + 0.5) / size), (row * size + column) * 4);
    }
  }
  return { data, width: size, height: size };
}

type AtmosphereProfile = { readonly color: string; readonly opacity: number; readonly radiusScale: number };
export const atmosphereProfiles: Readonly<Record<CelestialBodyId, AtmosphereProfile | null>> = {
  sun: null,
  mercury: null,
  venus: { color: "#f4d4a0", opacity: 0.1, radiusScale: 1.045 },
  earth: { color: "#81bbff", opacity: 0.14, radiusScale: 1.035 },
  mars: { color: "#e7a084", opacity: 0.025, radiusScale: 1.02 },
  jupiter: null,
  saturn: null,
  uranus: { color: "#9ce7ed", opacity: 0.09, radiusScale: 1.035 },
  neptune: { color: "#779fff", opacity: 0.1, radiusScale: 1.035 },
};

export function atmosphereRadius(id: CelestialBodyId, radius: number): number | null {
  const profile = atmosphereProfiles[id];
  return profile ? radius * profile.radiusScale : null;
}
