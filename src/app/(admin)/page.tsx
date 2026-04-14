import type { Metadata } from "next";
import MapaAcre from "@/components/Maps/MapaAcre";

export const metadata: Metadata = {
  title: "Dashboard | Gabinete Digital",
  description: "Gabinete Digital — TCE-AC",
};

export default function Dashboard() {
  return <MapaAcre />;
}
