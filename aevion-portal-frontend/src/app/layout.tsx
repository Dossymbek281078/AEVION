import type { Metadata } from "next";
import "./globals.css";
import TopNav from "../components/TopNav";

export const metadata: Metadata = {
  title: "AEVION Portal",
  description: "AEVION Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
