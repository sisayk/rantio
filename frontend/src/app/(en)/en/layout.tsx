import type { Metadata } from "next";
import { guestContent as content } from "@/lib/guestContent";
import "../../globals.css";

export const metadata: Metadata = {
  title: content.en.meta.title,
  description: content.en.meta.description,
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
