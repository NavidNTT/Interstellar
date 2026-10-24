import type { Vector3Tuple } from "three";

/**
 * Scene lighting rig.
 *
 * A distant star sends effectively parallel rays, so the key light is directional: every body
 * receives the same illumination angle no matter how far out it orbits. A point light cannot do
 * that here — with inverse-square falloff plus a cutoff window it would have to be brightened
 * roughly a hundredfold to keep the outer planets shaded, which would blow out the inner system.
 */

export const AMBIENT_INTENSITY = 0.18;

export const HEMISPHERE_SKY_COLOR = "#a7c7ed";
export const HEMISPHERE_GROUND_COLOR = "#080b14";
export const HEMISPHERE_INTENSITY = 0.3;

export const KEY_LIGHT_COLOR = "#fff1dd";
export const KEY_LIGHT_INTENSITY = 1.4;
/**
 * Placed behind the Sun so the parallel rays travel outward along +x, meeting the Sun-facing
 * hemisphere of every planet at the same angle and preserving a visible terminator.
 */
export const KEY_LIGHT_POSITION: Vector3Tuple = [-10, 3, 5];

/** Warm accent near the star only; it contributes almost nothing in the outer system. */
export const POINT_ACCENT_COLOR = "#ffd29a";
export const POINT_ACCENT_INTENSITY = 12;
export const POINT_ACCENT_DISTANCE = 40;
export const POINT_ACCENT_DECAY = 2;

/** Ambient plus hemisphere: the light that reaches a planet's unlit side. */
export function fillIrradiance(): number {
  return AMBIENT_INTENSITY + HEMISPHERE_INTENSITY;
}

/**
 * Mirrors three's `getDistanceAttenuation` (see its ShaderChunk source) so the declared
 * numeric invariants can be checked without a GPU: inverse-square falloff multiplied by the
 * smooth cutoff window. Kept in sync with POINT_ACCENT_* rather than restated in tests.
 */
export function pointLightIrradiance(
  distance: number,
  intensity = POINT_ACCENT_INTENSITY,
  cutoff = POINT_ACCENT_DISTANCE,
  decay = POINT_ACCENT_DECAY,
): number {
  if (distance <= 0) return 0;
  const falloff = 1 / Math.max(distance ** decay, 0.01);
  const window = cutoff > 0 ? Math.max(0, 1 - (distance / cutoff) ** 4) ** 2 : 1;
  return intensity * falloff * window;
}

/** Lit-side to unlit-side illumination ratio, which distance does not affect. */
export function contrastRatio(): number {
  return (KEY_LIGHT_INTENSITY + fillIrradiance()) / fillIrradiance();
}
