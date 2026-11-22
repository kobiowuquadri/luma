import Link from "next/link";
import { project } from "@/content/project";
import { LineMark } from "./LineMark";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/#voices", label: "Local voices" },
      { href: "/#preview", label: "Reader preview" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/support/", label: "Support and installation" },
      { href: "/privacy/", label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="container-luma grid gap-12 py-16 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="space-y-4">
          <p className="flex items-center gap-2.5">
            <LineMark className="h-7 w-10 text-fg" />
            <span className="font-display text-[1.75rem] font-medium leading-none tracking-[0.04em]">LUMA</span>
          </p>
          <p className="max-w-[38ch] text-lg text-muted">{project.expansion}. Built for the {project.event}.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="font-bold">{c.title}</p>
            <ul className="mt-3 space-y-1">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-11 items-center text-lg text-muted no-underline hover:text-fg hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-hairline">
        <p className="container-luma py-6 text-muted">
          The handout used across this site is an original sample written for the preview. It is not a real student&apos;s page.
        </p>
      </div>
    </footer>
  );
}
