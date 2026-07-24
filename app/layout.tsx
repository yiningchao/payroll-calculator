import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canada & UK Payroll Calculator",
  description: "Estimate Canadian or UK take-home pay, compare regions, or gross up a target net amount using current 2026 payroll rules.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
