import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("mrna-vaccine-pilot");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
