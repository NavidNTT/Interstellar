export type CelestialBodyType = "star" | "planet";

export const CELESTIAL_BODY_IDS = [
  "sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
] as const;

export type CelestialBodyId = (typeof CELESTIAL_BODY_IDS)[number];

export type CelestialBodyDetails = {
  id: CelestialBodyId;
  name: string;
  type: CelestialBodyType;
  radius: number;
  distanceFromSun: number;
  color: string;
  shortDescription: string;
  fullDescription: string;
  diameter: string;
  mass: string;
  gravity: string;
  averageTemperature: string;
  distanceFromSunDisplay: string;
  orbitalPeriod: string;
  rotationPeriod: string;
  numberOfMoons: string;
  numberOfPlanets: string;
  atmosphere: string;
  composition: string;
  interestingFacts: string[];
};

export type CelestialBody = CelestialBodyDetails;

export type SolarSystemPhase = "overview" | "selected" | "traveling" | "arrived";

export type TravelDirection = "to-body" | "to-overview";

export type SolarSystemState =
  | { phase: "overview"; selectedId: null; direction: null; requestId: number }
  | { phase: "selected"; selectedId: CelestialBody["id"]; direction: null; requestId: number }
  | {
      phase: "traveling";
      selectedId: CelestialBody["id"];
      direction: TravelDirection;
      requestId: number;
    }
  | { phase: "arrived"; selectedId: CelestialBody["id"]; direction: null; requestId: number };
