import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DuduSnack — Expo workspace",
  description: "Build and run Expo projects on Android emulators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
