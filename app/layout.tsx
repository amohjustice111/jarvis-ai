import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "J.A.R.V.I.S. — Claude Intelligence",
  description: "Your personal AI assistant, powered by Claude.",
  applicationName: "J.A.R.V.I.S."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}