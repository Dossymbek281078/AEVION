import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("research-lab-bsl4");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
