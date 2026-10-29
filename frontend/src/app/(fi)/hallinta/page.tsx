import type { Metadata } from "next";
import OwnerDashboard from "@/components/owner/OwnerDashboard";
import { ownerContent } from "@/lib/ownerContent";

export const metadata: Metadata = {
  title: ownerContent.fi.meta.title,
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OwnerDashboard lang="fi" />;
}
