import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacts — AEVION Bank",
  description: "Recipient address book — saved nicknames, account-ids, last-sent dates. Manage who shows up in autocomplete when you send AEC.",
  robots: { index: false, follow: false },
};

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
