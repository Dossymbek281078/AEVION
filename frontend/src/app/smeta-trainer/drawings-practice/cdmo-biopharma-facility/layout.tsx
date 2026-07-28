import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("cdmo-biopharma-facility");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
