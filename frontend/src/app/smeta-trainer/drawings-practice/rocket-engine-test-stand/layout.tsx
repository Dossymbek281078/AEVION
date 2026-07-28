import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("rocket-engine-test-stand");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
