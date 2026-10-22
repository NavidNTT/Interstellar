import type { CelestialBodyDetails, CelestialBodyId } from "../types";

export const celestialBodies: CelestialBodyDetails[] = [
  {
    id: "sun",
    name: "Sun",
    type: "star",
    radius: 1.8,
    distanceFromSun: 0,
    color: "#ffb347",
    shortDescription: "The warm, luminous anchor of this small prototype system.",
    fullDescription: "The Sun is the star at the center of our solar system. Its gravity holds the planets, dwarf planets, asteroids, and comets in orbit, while its energy powers the climate and chemistry of Earth.",
    diameter: "1,392,700 km",
    mass: "1.989 × 10³⁰ kg",
    gravity: "274 m/s²",
    averageTemperature: "5,500°C at the photosphere",
    distanceFromSunDisplay: "Central star",
    orbitalPeriod: "—",
    rotationPeriod: "25–35 Earth days",
    numberOfMoons: "—",
    numberOfPlanets: "8",
    atmosphere: "Hydrogen and helium plasma; no solid surface",
    composition: "About 74% hydrogen and 24% helium by mass, with heavier elements making up the remainder.",
    interestingFacts: [
      "Contains more than 99% of the solar system's total mass.",
      "Light from the Sun reaches Earth in about 8 minutes 20 seconds.",
      "Its visible surface is called the photosphere.",
    ],
  },
  {
    id: "earth",
    name: "Earth",
    type: "planet",
    radius: 0.62,
    distanceFromSun: 5.4,
    color: "#4d9de0",
    shortDescription: "A blue world with a hint of green, orbiting in the inner system.",
    fullDescription: "Earth is a rocky planet with stable surface oceans and a nitrogen-rich atmosphere. It is the only world currently known to support life, with a dynamic climate shaped by its atmosphere, oceans, and magnetic field.",
    diameter: "12,742 km",
    mass: "5.972 × 10²⁴ kg",
    gravity: "9.81 m/s²",
    averageTemperature: "About 15°C global average",
    distanceFromSunDisplay: "149.6 million km",
    orbitalPeriod: "365.25 Earth days",
    rotationPeriod: "23 hours 56 minutes",
    numberOfMoons: "1",
    numberOfPlanets: "—",
    atmosphere: "About 78% nitrogen, 21% oxygen, and 1% argon and trace gases",
    composition: "A rocky silicate mantle and crust surrounding an iron-rich core.",
    interestingFacts: [
      "Liquid surface water covers roughly 71% of the planet.",
      "Earth's magnetic field helps deflect charged particles from the solar wind.",
      "Its atmosphere and oceans continuously exchange heat and moisture.",
    ],
  },
  {
    id: "mars",
    name: "Mars",
    type: "planet",
    radius: 0.48,
    distanceFromSun: 8.2,
    color: "#c9684b",
    shortDescription: "A rust-colored outer neighbor on a wider representative orbit.",
    fullDescription: "Mars is a cold, dusty terrestrial planet with a thin atmosphere and a surface marked by impact craters, volcanoes, valleys, and polar ice. Its iron-rich minerals give the landscape its characteristic red color.",
    diameter: "6,779 km",
    mass: "6.39 × 10²³ kg",
    gravity: "3.71 m/s²",
    averageTemperature: "About −63°C global average",
    distanceFromSunDisplay: "227.9 million km",
    orbitalPeriod: "687 Earth days",
    rotationPeriod: "24 hours 37 minutes",
    numberOfMoons: "2",
    numberOfPlanets: "—",
    atmosphere: "About 95% carbon dioxide, 2.7% nitrogen, and 1.6% argon",
    composition: "Rocky silicates with an iron-rich core and iron oxide dust on the surface.",
    interestingFacts: [
      "Olympus Mons is the largest known volcano in the solar system.",
      "A Martian day, called a sol, is only about 40 minutes longer than an Earth day.",
      "Mars has two small moons named Phobos and Deimos.",
    ],
  },
];

export const bodyById: Partial<Record<CelestialBodyId, CelestialBodyDetails>> = celestialBodies.reduce<
  Partial<Record<CelestialBodyId, CelestialBodyDetails>>
>((bodies, body) => {
  bodies[body.id] = body;
  return bodies;
}, {});

export function getBodyDetails(id: string | null | undefined): CelestialBodyDetails | null {
  if (id !== "sun" && id !== "earth" && id !== "mars") return null;
  return bodyById[id] ?? null;
}
