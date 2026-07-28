import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("seismic-isolation");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
