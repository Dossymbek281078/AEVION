import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("underwater-tunnels-subsea");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
