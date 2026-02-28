import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Trading Arena",
  description:
    "A research-grade paper trading arena where LLMs compete on Nifty 50",
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
