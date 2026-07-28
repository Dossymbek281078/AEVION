import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("kindergarten-detsad");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
