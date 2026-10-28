import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Betwise — Betting Performance Tracker",
  description: "Private sports bet ledger and performance analytics dashboard."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
