import type { MetadataRoute } from "next";

// PWA manifest for AEVION. Default start_url is /bank — once installed,
// tapping the home-screen icon opens the wallet directly. The /pitch and
// /demo routes still work, just not as the launcher target.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AEVION — Trust infrastructure & Bank",
    short_name: "AEVION",
    description:
      "Wallet, royalties, signatures, awards, chess and more — bound by a single trust graph. Multilingual EN / RU / KZ.",
    start_url: "/bank",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0d9488",
    categories: ["finance", "productivity", "social", "entertainment"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Inbox",
        short_name: "Inbox",
        description: "Pending splits, advance, recurring shortfalls and goals",
        url: "/bank/inbox",
      },
      {
        name: "Scan to pay",
        short_name: "Pay",
        description: "Generate a QR for an in-person AEC payment",
        url: "/bank/explore",
      },
      {
        name: "Statement",
        short_name: "Statement",
        description: "Printable wallet report",
        url: "/bank/statement",
      },
      {
        name: "Leaderboard",
        short_name: "Top",
        description: "Top creators, chess and referrers",
        url: "/bank/leaderboard",
      },
    ],
  };
}
