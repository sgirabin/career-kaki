import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerKaki",
  description: "Autonomous career enablement dashboard powered by Next.js and Vercel AI SDK.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">
        {children}
      </body>
    </html>
  );
}
