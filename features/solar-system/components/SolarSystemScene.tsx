"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { bodyById, celestialBodies } from "../data/bodies";
import { CelestialBody } from "./CelestialBody";
import { OrbitPath } from "./OrbitPath";
import { SelectionPanel } from "./SelectionPanel";
import { StarField } from "./StarField";
import type { CelestialBody as CelestialBodyData } from "../types";

export function SolarSystemScene() {
  const [selectedId, setSelectedId] = useState<CelestialBodyData["id"] | null>(null);
  const selectedBody = selectedId ? bodyById[selectedId] : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0" aria-label="Interactive solar system scene">
        <Canvas
          camera={{ position: [10, 8, 15], fov: 45 }}
          dpr={[1, 2]}
          onPointerMissed={() => setSelectedId(null)}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={["#030712"]} />
          <ambientLight intensity={0.32} />
          <hemisphereLight args={["#a7c7ed", "#080b14", 0.45]} />
          <pointLight position={[0, 0, 0]} intensity={80} distance={40} decay={2} color="#ffd29a" />
          <StarField />
          <OrbitPath radius={bodyById.earth.distanceFromSun} />
          <OrbitPath radius={bodyById.mars.distanceFromSun} />
          {celestialBodies.map((body) => (
            <CelestialBody
              key={body.id}
              body={body}
              selected={selectedId === body.id}
              onSelect={setSelectedId}
            />
          ))}
          <OrbitControls enablePan minDistance={5} maxDistance={28} target={[3, 0, 0]} />
        </Canvas>
      </div>
      <SelectionPanel selectedBody={selectedBody} />
      <p className="pointer-events-none absolute bottom-4 right-4 z-10 max-w-[15rem] text-right text-[0.65rem] tracking-[0.12em] text-slate-400/80 sm:bottom-6 sm:right-6">
        DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A BODY
      </p>
    </main>
  );
}
