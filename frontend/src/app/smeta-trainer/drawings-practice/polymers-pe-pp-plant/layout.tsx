import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("polymers-pe-pp-plant");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
