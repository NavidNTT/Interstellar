"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { createSurfaceMap, SELECTED_SURFACE_EMISSIVE_INTENSITY, surfaceProfiles, type PlanetId } from "../data/appearance";

export function PlanetSurfaceMaterial({ id, color, selected }: {
  id: PlanetId;
  color: string;
  selected: boolean;
}) {
  const pixels = useMemo(() => createSurfaceMap(id, color), [id, color]);

  return (
    <meshStandardMaterial
      color="#ffffff"
      emissive={selected ? "#536d92" : "#000000"}
      emissiveIntensity={selected ? SELECTED_SURFACE_EMISSIVE_INTENSITY : 0}
      roughness={surfaceProfiles[id].roughness}
      metalness={0}
    >
      {/* R3F owns/disposes this texture. Selection changes retain the same args,
          so they neither regenerate pixel data nor replace the GPU resource. */}
      <dataTexture
        attach="map"
        args={[pixels.data, pixels.width, pixels.height, THREE.RGBAFormat]}
        colorSpace={THREE.SRGBColorSpace}
        wrapS={THREE.RepeatWrapping}
        wrapT={THREE.ClampToEdgeWrapping}
        magFilter={THREE.LinearFilter}
        minFilter={THREE.LinearMipmapLinearFilter}
        generateMipmaps
        needsUpdate
      />
    </meshStandardMaterial>
  );
}
