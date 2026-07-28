import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("vertical-farm-hydroponic");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
