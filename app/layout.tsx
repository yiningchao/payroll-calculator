import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plane Pay — 2026 Canada Payroll Calculator",
  description: "Estimate Canadian take-home pay using 2026 CRA rates and your TD1 personal tax credit claims.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
