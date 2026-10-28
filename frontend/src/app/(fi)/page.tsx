import type { Metadata } from "next";
import GuestHome from "@/components/guest/GuestHome";
import { guestContent } from "@/lib/guestContent";

export const metadata: Metadata = {
  title: guestContent.fi.meta.title,
  description: guestContent.fi.meta.description,
  alternates: { languages: { en: "/en" } },
};

export default function Page() {
  return <GuestHome lang="fi" />;
}
