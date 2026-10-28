import type { Metadata } from "next";
import Landing from "@/components/Landing";
import { content } from "@/lib/content";

export const metadata: Metadata = {
  title: content.en.meta.title,
  description: content.en.meta.description,
  alternates: { languages: { fi: "/omistajille" } },
};

export default function Page() {
  return <Landing lang="en" />;
}
