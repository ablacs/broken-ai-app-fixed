import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notely",
  description: "Notes app used to demonstrate three common bugs in AI-built apps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
