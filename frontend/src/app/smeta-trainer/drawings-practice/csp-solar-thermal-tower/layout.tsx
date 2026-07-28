import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("csp-solar-thermal-tower");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
