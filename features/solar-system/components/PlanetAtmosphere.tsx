"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { atmosphereProfiles, atmosphereRadius } from "../data/appearance";
import { KEY_LIGHT_POSITION } from "../data/lighting";
import type { CelestialBodyId } from "../types";

const vertexShader = /* glsl */`
  uniform vec3 sunDirection;
  varying vec3 viewNormal;
  varying vec3 viewPosition;
  varying float sunFacing;
  void main() {
    vec4 positionInView = modelViewMatrix * vec4(position, 1.0);
    viewPosition = positionInView.xyz;
    viewNormal = normalize(normalMatrix * normal);
    sunFacing = dot(normalize(mat3(modelMatrix) * normal), sunDirection);
    gl_Position = projectionMatrix * positionInView;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 atmosphereColor;
  uniform float opacity;
  varying vec3 viewNormal;
  varying vec3 viewPosition;
  varying float sunFacing;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(viewNormal), normalize(-viewPosition))), 3.0);
    float light = mix(0.35, 1.0, smoothstep(-0.35, 0.6, sunFacing));
    gl_FragColor = vec4(atmosphereColor, opacity * rim * light);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Decorative shells must never take part in pointer hit testing.
const ignoreRaycast = () => {};

export function PlanetAtmosphere({ id, radius }: { id: CelestialBodyId; radius: number }) {
  const profile = atmosphereProfiles[id];
  const uniforms = useMemo(() => profile ? {
    atmosphereColor: { value: new THREE.Color(profile.color) },
    opacity: { value: profile.opacity },
    sunDirection: { value: new THREE.Vector3(...KEY_LIGHT_POSITION).normalize() },
  } : null, [profile]);
  const shellRadius = atmosphereRadius(id, radius);
  if (!uniforms || shellRadius === null) return null;

  return (
    <mesh raycast={ignoreRaycast}>
      <sphereGeometry args={[shellRadius, 32, 32]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
        side={THREE.BackSide} blending={THREE.AdditiveBlending} transparent
        depthTest depthWrite={false} />
    </mesh>
  );
}
