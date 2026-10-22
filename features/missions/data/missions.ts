import type { Mission } from "../types/mission";

export const missions: readonly Mission[] = [
  {
    id: "first-contact", title: "First Contact", category: "travel", difficulty: "introductory",
    description: "Begin your exploration with a journey to our blue home world.",
    objective: "Travel to Earth and arrive at its observation point.", destinationBodyId: "earth",
    estimatedDuration: "Under 1 minute", completionLabel: "Earth observation point reached",
    steps: [{ id: "earth-visit", bodyId: "earth", kind: "visit", label: "Arrive at Earth" }],
  },
  {
    id: "red-planet", title: "Red Planet Approach", category: "travel", difficulty: "introductory",
    description: "Set a course for the rust-colored neighbor of Earth.",
    objective: "Travel to Mars and arrive at its observation point.", destinationBodyId: "mars",
    estimatedDuration: "Under 1 minute", completionLabel: "Mars observation point reached",
    steps: [{ id: "mars-visit", bodyId: "mars", kind: "visit", label: "Arrive at Mars" }],
  },
  {
    id: "solar-observation", title: "Solar Observation", category: "observation", difficulty: "introductory",
    description: "Observe the star that anchors this solar system from a representative viewpoint.",
    objective: "Travel to the Sun's observation point.", destinationBodyId: "sun",
    estimatedDuration: "Under 1 minute", completionLabel: "Solar observation point reached",
    steps: [{ id: "sun-visit", bodyId: "sun", kind: "visit", label: "Arrive at the Sun" }],
  },
  {
    id: "inner-survey", title: "Inner System Survey", category: "travel", difficulty: "standard",
    description: "Explore two rocky worlds in a short guided itinerary.",
    objective: "Arrive at Earth, then travel to Mars.", destinationBodyId: "earth",
    estimatedDuration: "1–2 minutes", completionLabel: "Inner system survey complete",
    steps: [
      { id: "survey-earth", bodyId: "earth", kind: "visit", label: "Arrive at Earth" },
      { id: "survey-mars", bodyId: "mars", kind: "visit", label: "Arrive at Mars" },
    ],
  },
  {
    id: "stellar-neighborhood", title: "Stellar Neighborhood", category: "science", difficulty: "standard",
    description: "Discover the scientific profiles of our star and its two featured planets.",
    objective: "Open scientific details for the Sun, then Earth, then Mars after starting this mission.",
    destinationBodyId: "sun", estimatedDuration: "2–3 minutes", completionLabel: "Stellar neighborhood inspected",
    steps: [
      { id: "inspect-sun", bodyId: "sun", kind: "inspect", label: "Open Sun details" },
      { id: "inspect-earth", bodyId: "earth", kind: "inspect", label: "Open Earth details" },
      { id: "inspect-mars", bodyId: "mars", kind: "inspect", label: "Open Mars details" },
    ],
  },
];

export function getMission(id: string | null | undefined): Mission | null {
  return missions.find((mission) => mission.id === id) ?? null;
}
