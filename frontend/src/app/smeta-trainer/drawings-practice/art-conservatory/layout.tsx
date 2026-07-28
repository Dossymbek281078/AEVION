import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("art-conservatory");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
