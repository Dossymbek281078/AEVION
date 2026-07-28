import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("gas-medium-pressure");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
