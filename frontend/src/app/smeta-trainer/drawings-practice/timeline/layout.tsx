import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("timeline");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
