import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Reshi Resume Studio",
  manifest: "/brand/site.webmanifest",
  description:
    "Your private workspace for a resume that tells your story. Edit, match, and export locally.",
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
