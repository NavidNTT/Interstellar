"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

type OrbitPathProps = {
  radius: number;
};

export function OrbitPath({ radius }: OrbitPathProps) {
  const points = useMemo(
    () =>
      Array.from({ length: 128 }, (_, index) => {
        const angle = (index / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      }),
    [radius],
  );

  return <Line points={points} color="#5d738b" transparent opacity={0.34} lineWidth={0.7} />;
}
