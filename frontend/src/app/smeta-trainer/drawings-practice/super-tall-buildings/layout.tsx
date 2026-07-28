import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("super-tall-buildings");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
