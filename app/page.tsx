import { SolarSystemScene } from "@/features/solar-system";
import { ExplorationDataProvider } from "@/features/exploration/ExplorationDataProvider";

export default function Home() {
  return <ExplorationDataProvider><SolarSystemScene /></ExplorationDataProvider>;
}
