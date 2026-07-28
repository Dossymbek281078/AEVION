import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("eco-resort-glamping");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
