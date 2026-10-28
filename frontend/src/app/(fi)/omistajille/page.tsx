import type { Metadata } from "next";
import Landing from "@/components/Landing";
import { content } from "@/lib/content";

export const metadata: Metadata = {
  title: content.fi.meta.title,
  description: content.fi.meta.description,
  alternates: { languages: { en: "/en/hosts" } },
};

export default function Page() {
  return <Landing lang="fi" />;
}
