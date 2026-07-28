import type { Metadata } from "next";
import { drawingTopicMetadata } from "../../data/drawingsTopics";

export const metadata: Metadata = drawingTopicMetadata("mkd-kapremont");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
