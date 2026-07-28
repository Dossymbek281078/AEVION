import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("simulator-training-center");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
