"use client";

import Link from "next/link";
import { useState } from "react";
import { downloadReady } from "@/content/project";
import { LineMark } from "./LineMark";
import { ThemeSelect } from "./ThemeSelect";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#voices", label: "Local voices" },
  { href: "/privacy/", label: "Privacy" },
];

function Action({ onClick }: { onClick?: () => void }) {
  return downloadReady ? (
    <Link href="/#download" className="btn btn-primary btn-small" onClick={onClick}>
      Download the app
    </Link>
  ) : (
    <Link href="/#preview" className="btn btn-primary btn-small" onClick={onClick}>
      Try the reader
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="border-b border-hairline bg-bg">
      <div className="container-luma flex min-h-[4.5rem] flex-wrap items-center gap-x-8 gap-y-2 py-3">
        <Link href="/" className="flex items-center gap-2.5 text-fg no-underline" aria-label="LUMA home">
          <LineMark className="h-7 w-10 text-fg" />
          <span className="font-display text-[1.75rem] font-medium leading-none tracking-[0.04em]">LUMA</span>
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="inline-flex min-h-11 items-center rounded-lg px-3 text-[1.0625rem] text-muted no-underline hover:text-fg">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto hidden items-center gap-4 lg:flex">
          <ThemeSelect id="theme-desktop" />
          <Action />
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-small ms-auto lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            )}
          </svg>
          Menu
        </button>
      </div>

      <nav id="mobile-nav" aria-label="Main" hidden={!open} className="border-t border-hairline lg:hidden">
        <ul className="container-luma flex flex-col gap-1 py-4">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={close} className="flex min-h-12 items-center rounded-lg px-2 text-lg font-bold text-fg no-underline">
                {l.label}
              </a>
            </li>
          ))}
          <li className="px-2 py-3">
            <ThemeSelect id="theme-mobile" />
          </li>
          <li>
            <Action onClick={close} />
          </li>
        </ul>
      </nav>
    </header>
  );
}
