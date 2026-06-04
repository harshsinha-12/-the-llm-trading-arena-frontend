import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Trading Arena",
  description:
    "A research-grade paper trading arena where LLMs compete on Nifty 50",
  openGraph: {
    title: "LLM Trading Arena",
    description:
      "A research-grade paper trading arena where LLMs compete on Nifty 50",
    images: [
      {
        url: "/opengraph-image.png",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
