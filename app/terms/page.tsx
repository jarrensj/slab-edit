import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import Terms from "@/content/terms.md";

export const metadata: Metadata = {
  title: "Terms of Service · slab edit",
  description: "The terms for using slab edit.",
};

export default function TermsPage() {
  return (
    <LegalPage>
      <Terms />
    </LegalPage>
  );
}
