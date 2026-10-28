import type { Metadata } from "next";
import GuestHome from "@/components/guest/GuestHome";
import { guestContent } from "@/lib/guestContent";

export const metadata: Metadata = {
  title: guestContent.en.meta.title,
  description: guestContent.en.meta.description,
  alternates: { languages: { fi: "/" } },
};

export default function Page() {
  return <GuestHome lang="en" />;
}
