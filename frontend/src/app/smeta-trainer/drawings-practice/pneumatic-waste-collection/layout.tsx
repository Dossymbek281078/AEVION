import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("pneumatic-waste-collection");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
