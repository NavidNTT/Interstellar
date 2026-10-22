"use client";

import { Points, PointMaterial } from "@react-three/drei";
import { useMemo } from "react";

export function StarField() {
  const positions = useMemo(() => {
    const values: number[] = [];
    let seed = 19;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let index = 0; index < 900; index += 1) {
      const radius = 24 + random() * 32;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      values.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
    }

    return new Float32Array(values);
  }, []);

  return (
    <Points positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial transparent color="#d8e8ff" size={0.08} sizeAttenuation depthWrite={false} />
    </Points>
  );
}
