import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QEvents — Events Platform | AEVION",
  description: "Discover and attend tech conferences, hackathons, workshops and networking events in the AEVION ecosystem.",
  openGraph: {
    title: "QEvents — Events Platform",
    description: "Find and RSVP to upcoming tech, business, and community events.",
    siteName: "AEVION",
  },
};

export default function QEventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
