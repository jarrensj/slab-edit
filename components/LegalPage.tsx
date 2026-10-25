// The Terms of Service and Privacy Policy pages: their Markdown (from
// content/) in a column of readable text that scrolls inside the app shell on
// wider screens.
// TODO: have both pages reviewed by a lawyer. The Terms have no governing-law
// clause yet, and Contact points at kwaji.com; a support email, if one is
// added, belongs in an env var rather than the repo.
export function LegalPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 sm:min-h-0 sm:overflow-y-auto">
      <article className="legal mx-auto max-w-160 px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16">
        {children}
      </article>
    </main>
  );
}
