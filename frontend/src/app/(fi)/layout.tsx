import type { Metadata } from "next";
import { guestContent as content } from "@/lib/guestContent";
import "../globals.css";

export const metadata: Metadata = {
  title: content.fi.meta.title,
  description: content.fi.meta.description,
};

export default function FinnishLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  );
}
