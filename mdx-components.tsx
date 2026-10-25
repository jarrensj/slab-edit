import type { MDXComponents } from "mdx/types";
import Link from "next/link";

// Required by @next/mdx, which renders the Markdown in content/. Links to
// other pages of the app (like the Terms' link to the Privacy Policy) go
// through next/link, so they don't reload the whole page.
const components: MDXComponents = {
  a: ({ href = "", ...props }) =>
    href.startsWith("/") ? (
      <Link href={href} {...props} />
    ) : (
      <a href={href} {...props} />
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
