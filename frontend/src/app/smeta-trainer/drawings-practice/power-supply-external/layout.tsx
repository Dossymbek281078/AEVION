import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("power-supply-external");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
