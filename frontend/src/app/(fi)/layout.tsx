import type { Metadata } from "next";
import { content } from "@/lib/content";
import "../globals.css";

export const metadata: Metadata = {
  title: content.fi.meta.title,
  description: content.fi.meta.description,
  alternates: { languages: { en: "/en" } },
};

export default function FinnishLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  );
}
