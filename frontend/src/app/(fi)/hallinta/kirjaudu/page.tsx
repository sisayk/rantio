import type { Metadata } from "next";
import OwnerLogin from "@/components/owner/OwnerLogin";
import { ownerContent } from "@/lib/ownerContent";

export const metadata: Metadata = {
  title: ownerContent.fi.meta.loginTitle,
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OwnerLogin lang="fi" />;
}
