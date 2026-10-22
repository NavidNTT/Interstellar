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
