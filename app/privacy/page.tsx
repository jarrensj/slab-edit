import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import Privacy from "@/content/privacy.md";

export const metadata: Metadata = {
  title: "Privacy Policy · slab edit",
  description:
    "Your photos are edited in your browser and never uploaded. Here's what slab edit does store and collect.",
};

export default function PrivacyPage() {
  return (
    <LegalPage>
      <Privacy />
    </LegalPage>
  );
}
