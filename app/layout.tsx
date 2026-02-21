import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "The Indian Trading Arena",
    description: "Indian stock market trading platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
