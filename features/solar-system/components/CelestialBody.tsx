"use client";

import { useCursor } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { CelestialBody as CelestialBodyData } from "../types";
import { PlanetSurfaceMaterial } from "./PlanetSurfaceMaterial";
import type { ThreeEvent } from "@react-three/fiber";
import { SATURN_RING_PROFILE, selectionMarkerRadii } from "../data/appearance";
import { SaturnRings } from "./SaturnRings";
import { PlanetAtmosphere } from "./PlanetAtmosphere";

type CelestialBodyProps = {
  body: CelestialBodyData;
  selected: boolean;
  onSelect: (id: CelestialBodyData["id"]) => void;
};

export function CelestialBody({ body, selected, onSelect }: CelestialBodyProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  useCursor(hovered);
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(body.id);
  };
  const pointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
  };
  const pointerOut = () => setHovered(false);
  const marker = selectionMarkerRadii(body.id, body.radius);

  return (
    <group position={[body.distanceFromSun, 0, 0]}>
      <group scale={selected ? 1.16 : 1}>
        <mesh
          ref={meshRef}
          onClick={select}
          onPointerOver={pointerOver}
          onPointerOut={pointerOut}
        >
          <sphereGeometry args={[body.radius, 32, 32]} />
          {body.id !== "sun" && body.type === "planet" ? (
            <PlanetSurfaceMaterial id={body.id} color={body.color} selected={selected} />
          ) : (
            <meshStandardMaterial
              color={body.color}
              emissive={body.type === "star" ? body.color : selected ? "#536d92" : "#000000"}
              emissiveIntensity={body.type === "star" ? 0.8 : selected ? 0.35 : 0}
              roughness={0.72}
              metalness={0.05}
            />
          )}
        </mesh>
        {body.id === "saturn" && <SaturnRings radius={body.radius} onSelect={select}
          onPointerOver={pointerOver} onPointerOut={pointerOut} />}
        <PlanetAtmosphere id={body.id} radius={body.radius} />
      </group>
      {selected && (
        <mesh rotation={body.id === "saturn"
          ? [-Math.PI / 2 + SATURN_RING_PROFILE.tilt, 0, 0]
          : [Math.PI / 2, 0, 0]}>
          <ringGeometry args={[marker.inner, marker.outer, 64]} />
          <meshBasicMaterial color="#f4c67a" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
