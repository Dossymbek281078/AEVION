import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("oil-offshore-platform");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
