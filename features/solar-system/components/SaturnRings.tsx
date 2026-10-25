"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { createSaturnRingMap, SATURN_RING_PROFILE, saturnRingRadii } from "../data/appearance";

export function SaturnRings({ radius, onSelect, onPointerOver, onPointerOut }: {
  radius: number;
  onSelect: (event: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: () => void;
}) {
  const pixels = useMemo(() => createSaturnRingMap(), []);
  const radii = saturnRingRadii(radius);
  return (
    <mesh
      rotation={[-Math.PI / 2 + SATURN_RING_PROFILE.tilt, 0, 0]}
      onClick={onSelect}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <ringGeometry args={[radii.inner, radii.outer, SATURN_RING_PROFILE.segments]} />
      <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0}
        side={THREE.DoubleSide} alphaTest={0.5} alphaToCoverage transparent={false} depthTest depthWrite>
        <dataTexture attach="map" args={[pixels.data, pixels.width, pixels.height, THREE.RGBAFormat]}
          colorSpace={THREE.SRGBColorSpace} magFilter={THREE.LinearFilter}
          minFilter={THREE.LinearMipmapLinearFilter} generateMipmaps needsUpdate />
      </meshStandardMaterial>
    </mesh>
  );
}
