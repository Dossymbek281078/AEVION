import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("dams-hydrostructures");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
