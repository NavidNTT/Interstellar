"use client";

import { useCursor } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { CelestialBody as CelestialBodyData } from "../types";

type CelestialBodyProps = {
  body: CelestialBodyData;
  selected: boolean;
  onSelect: (id: CelestialBodyData["id"]) => void;
};

export function CelestialBody({ body, selected, onSelect }: CelestialBodyProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  useCursor(hovered);

  return (
    <group position={[body.distanceFromSun, 0, 0]}>
      <mesh
        ref={meshRef}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(body.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        scale={selected ? 1.16 : 1}
      >
        <sphereGeometry args={[body.radius, 32, 32]} />
        <meshStandardMaterial
          color={body.color}
          emissive={body.type === "star" ? body.color : selected ? "#536d92" : "#000000"}
          emissiveIntensity={body.type === "star" ? 0.8 : selected ? 0.35 : 0}
          roughness={0.72}
          metalness={0.05}
        />
      </mesh>
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[body.radius * 1.3, body.radius * 1.37, 64]} />
          <meshBasicMaterial color="#f4c67a" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
