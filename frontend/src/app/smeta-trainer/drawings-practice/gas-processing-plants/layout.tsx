import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("gas-processing-plants");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
