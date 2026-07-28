import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("aluminum-smelter-electrolysis");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
