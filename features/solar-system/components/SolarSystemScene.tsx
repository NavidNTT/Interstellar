"use client";

import { MissionBrowser } from "@/features/missions/components/MissionBrowser";
import { MissionList } from "@/features/missions/components/MissionList";
import { useMissionState } from "@/features/missions/hooks/useMissionState";
import { useExplorationData } from "@/features/exploration/ExplorationDataProvider";
import { CatalogNotice } from "@/features/exploration/CatalogNotice";
import { currentStep } from "@/features/missions/utils/missionProgress";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OVERVIEW_CAMERA_POSITION, OVERVIEW_CAMERA_TARGET } from "../data/camera";

import { CelestialBody } from "./CelestialBody";
import { OrbitPath } from "./OrbitPath";
import { SelectionPanel } from "./SelectionPanel";
import { BodyDetails } from "./BodyDetails";
import { StarField } from "./StarField";
import { TravelCamera } from "./TravelCamera";
import { useSolarSystemState } from "../hooks/useSolarSystemState";

export function SolarSystemScene() {
  const { state, selectBody, clearSelection, startTravel, returnToOverview, cancelTravel, completeTravel } =
    useSolarSystemState();
  const catalog = useExplorationData();
  const { bodies: celestialBodies, getBody: getBodyDetails, getMission } = catalog;
  const mission = useMissionState();
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const activeMission = getMission(mission.state.activeMissionId);
  const nextStep = activeMission ? currentStep(activeMission, mission.state) : null;
  const missionControls = {
    state: mission.state, ready: mission.ready, canSelectDestination: state.phase !== "traveling",
    onStart: mission.startMission, onReset: mission.resetActiveMission,
    onDestination: (id: string) => {
      const body = getBodyDetails(id);
      if (!body || state.phase === "traveling") return;
      setIsMissionsOpen(false);
      setIsDetailsOpen(false);
      selectBody(body.id);
    },
  };
  const handleTravelComplete = () => {
    if (state.phase === "traveling" && state.direction === "to-body") {
      mission.recordObjective(state.selectedId, "visit");
    }
    completeTravel();
  };
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const selectedBody = getBodyDetails(state.selectedId);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Native dialogs own Escape while open, preventing a second travel transition.
      if (isMissionsOpen || isDetailsOpen) return;
      if (state.phase === "traveling") cancelTravel();
      else if (state.phase === "selected") clearSelection();
      else if (state.phase === "arrived" && state.selectedId) selectBody(state.selectedId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelTravel, clearSelection, isMissionsOpen, isDetailsOpen, selectBody, state.phase, state.selectedId]);

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
          <OrbitPath radius={getBodyDetails("earth")?.distanceFromSun ?? 5.4} />
          <OrbitPath radius={getBodyDetails("mars")?.distanceFromSun ?? 8.2} />
          {celestialBodies.map((body) => (
            <CelestialBody
              key={body.id}
              body={body}
              selected={state.selectedId === body.id}
              onSelect={(id) => {
                setIsDetailsOpen(false);
                selectBody(id);
              }}
            />
          ))}
          <OrbitControls ref={controlsRef} enablePan minDistance={5} maxDistance={28} target={OVERVIEW_CAMERA_TARGET} />
          <TravelCamera
            phase={state.phase}
            direction={state.direction}
            selectedBody={selectedBody}
            requestId={state.requestId}
            controlsRef={controlsRef}
            onComplete={handleTravelComplete}
          />
        </Canvas>
      </div>
      <SelectionPanel
        selectedBody={selectedBody}
        phase={state.phase}
        direction={state.direction}
        onTravel={startTravel}
        onStop={cancelTravel}
        onBackToOverview={() => {
          setIsDetailsOpen(false);
          returnToOverview();
        }}
        catalogNotice={<><CatalogNotice canRetry={state.phase !== "traveling"} />{mission.state.activeMissionId && !activeMission && <div className="mt-3 text-xs text-slate-300"><p>The saved active mission is unavailable in this catalog. Its progress is retained.</p><button type="button" className="mission-button mt-2" onClick={mission.resetActiveMission}>ABANDON UNAVAILABLE MISSION</button></div>}</>}
        onMissions={() => setIsMissionsOpen(true)}
        missionSummary={activeMission && nextStep ? "ACTIVE: " + activeMission.title + " / " + nextStep.label : mission.state.completedMissionIds.length ? mission.state.completedMissionIds.length + " missions COMPLETED. Choose your next exploration." : "Choose a mission to guide your exploration."}
        onDetails={() => {
          if (selectedBody) mission.recordObjective(selectedBody.id, "inspect");
          setIsDetailsOpen(true);
        }}
      />
      {isDetailsOpen && selectedBody && <BodyDetails body={selectedBody} onClose={() => setIsDetailsOpen(false)} missions={<><button type="button" className="mission-button mb-3" onClick={() => setIsMissionsOpen(true)}>VIEW ALL MISSIONS</button><MissionList bodyId={selectedBody.id} {...missionControls} /></>} />}
      {isMissionsOpen && <MissionBrowser {...missionControls} onClose={() => setIsMissionsOpen(false)} />}
      <p className="pointer-events-none absolute bottom-4 right-4 z-10 max-w-[15rem] text-right text-[0.65rem] tracking-[0.12em] text-slate-400/80 sm:bottom-6 sm:right-6">
        DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A BODY
      </p>
    </main>
  );
}
