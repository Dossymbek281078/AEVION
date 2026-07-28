import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("stormwater-detention-tunnel");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
