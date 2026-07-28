import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("insulation-works");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
