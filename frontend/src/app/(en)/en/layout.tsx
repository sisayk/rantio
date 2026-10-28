import type { Metadata } from "next";
import { content } from "@/lib/content";
import "../../globals.css";

export const metadata: Metadata = {
  title: content.en.meta.title,
  description: content.en.meta.description,
  alternates: { languages: { fi: "/" } },
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
