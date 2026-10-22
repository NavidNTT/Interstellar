"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OVERVIEW_CAMERA_POSITION, OVERVIEW_CAMERA_TARGET } from "../data/camera";
import { bodyById, celestialBodies } from "../data/bodies";
import { CelestialBody } from "./CelestialBody";
import { OrbitPath } from "./OrbitPath";
import { SelectionPanel } from "./SelectionPanel";
import { StarField } from "./StarField";
import { TravelCamera } from "./TravelCamera";
import { useSolarSystemState } from "../hooks/useSolarSystemState";

export function SolarSystemScene() {
  const { state, selectBody, clearSelection, startTravel, returnToOverview, cancelTravel, completeTravel } =
    useSolarSystemState();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const selectedBody = state.selectedId ? bodyById[state.selectedId] : null;

  useEffect(() => {
    if (state.phase === "overview") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (state.phase === "traveling") cancelTravel();
      else if (state.phase === "selected") clearSelection();
      else if (state.phase === "arrived" && state.selectedId) selectBody(state.selectedId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelTravel, clearSelection, selectBody, state.phase, state.selectedId]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0" aria-label="Interactive solar system scene">
        <Canvas
          camera={{ position: OVERVIEW_CAMERA_POSITION, fov: 45 }}
          dpr={[1, 2]}
          onPointerMissed={() => {
            if (state.phase === "selected") clearSelection();
          }}
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
              selected={state.selectedId === body.id}
              onSelect={selectBody}
            />
          ))}
          <OrbitControls ref={controlsRef} enablePan minDistance={5} maxDistance={28} target={OVERVIEW_CAMERA_TARGET} />
          <TravelCamera
            phase={state.phase}
            direction={state.direction}
            selectedBody={selectedBody}
            requestId={state.requestId}
            controlsRef={controlsRef}
            onComplete={completeTravel}
          />
        </Canvas>
      </div>
      <SelectionPanel
        selectedBody={selectedBody}
        phase={state.phase}
        direction={state.direction}
        onTravel={startTravel}
        onStop={cancelTravel}
        onBackToOverview={returnToOverview}
      />
      <p className="pointer-events-none absolute bottom-4 right-4 z-10 max-w-[15rem] text-right text-[0.65rem] tracking-[0.12em] text-slate-400/80 sm:bottom-6 sm:right-6">
        DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A BODY
      </p>
    </main>
  );
}
