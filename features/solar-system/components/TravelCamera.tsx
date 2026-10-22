"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OVERVIEW_CAMERA_POSITION, OVERVIEW_CAMERA_TARGET, TRAVEL_DURATION_MS } from "../data/camera";
import type { CelestialBody, SolarSystemPhase, TravelDirection } from "../types";

type TravelCameraProps = {
  phase: SolarSystemPhase;
  direction: TravelDirection | null;
  selectedBody: CelestialBody | null;
  requestId: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onComplete: () => void;
};

type Animation = {
  requestId: number;
  direction: TravelDirection;
  elapsed: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
};

export function TravelCamera({
  phase,
  direction,
  selectedBody,
  requestId,
  controlsRef,
  onComplete,
}: TravelCameraProps) {
  const { camera } = useThree();
  const animationRef = useRef<Animation | null>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (phase !== "traveling" || !direction || (direction === "to-body" && !selectedBody)) {
      animationRef.current = null;
      if (controls) controls.enabled = true;
      return;
    }

    const bodyPosition = new THREE.Vector3(selectedBody?.distanceFromSun ?? 0, 0, 0);
    const currentTarget = controls?.target.clone() ?? new THREE.Vector3(...OVERVIEW_CAMERA_TARGET);
    const toPosition =
      direction === "to-overview"
        ? new THREE.Vector3(...OVERVIEW_CAMERA_POSITION)
        : bodyPosition.clone().add(
            new THREE.Vector3(
              Math.max(2.6, (selectedBody?.radius ?? 0.5) * 4.5),
              Math.max(1.8, (selectedBody?.radius ?? 0.5) * 2.8),
              Math.max(3.2, (selectedBody?.radius ?? 0.5) * 5.5),
            ),
          );
    const toTarget = direction === "to-overview" ? new THREE.Vector3(...OVERVIEW_CAMERA_TARGET) : bodyPosition;

    animationRef.current = {
      requestId,
      direction,
      elapsed: 0,
      fromPosition: camera.position.clone(),
      toPosition,
      fromTarget: currentTarget,
      toTarget,
    };
    if (controls) controls.enabled = false;
  }, [camera, controlsRef, direction, phase, requestId, selectedBody]);

  useFrame((_, delta) => {
    const animation = animationRef.current;
    const controls = controlsRef.current;
    if (!animation || phase !== "traveling") return;

    animation.elapsed += delta * 1000;
    const progress = THREE.MathUtils.clamp(animation.elapsed / TRAVEL_DURATION_MS, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(animation.fromPosition, animation.toPosition, eased);
    const target = new THREE.Vector3().lerpVectors(animation.fromTarget, animation.toTarget, eased);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    } else {
      camera.lookAt(target);
    }

    if (progress >= 1) {
      animationRef.current = null;
      if (controls) controls.enabled = true;
      completeRef.current();
    }
  });

  return null;
}
