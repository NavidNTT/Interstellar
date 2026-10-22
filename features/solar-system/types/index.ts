export type CelestialBodyType = "star" | "planet";

export type CelestialBody = {
  id: "sun" | "earth" | "mars";
  name: string;
  type: CelestialBodyType;
  radius: number;
  distanceFromSun: number;
  color: string;
  description: string;
};

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
