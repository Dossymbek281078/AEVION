import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("best-practices");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
