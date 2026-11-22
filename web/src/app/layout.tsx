import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Newsreader } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  // next/font has no metric overrides for this family; skip the fallback.
  adjustFontFallback: false,
});

// Editorial serif for headings. Its Vietnamese range includes the dotted
// vowels Yorùbá and Igbo use.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext", "vietnamese"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LUMA: read the page your way",
    template: "%s · LUMA",
  },
  description:
    "LUMA turns a classroom board or handout into text you can resize, listen to, and ask questions about in English, Yorùbá, Hausa, Igbo or Nigerian Pidgin. Reading works offline.",
  icons: {
    icon: [{ url: "/icon-32.png", sizes: "32x32" }, { url: "/icon-512.png", sizes: "512x512" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F3" },
    { media: "(prefers-color-scheme: dark)", color: "#141517" },
  ],
};

// Applies the visitor's saved theme before the first paint.
const themeScript = `try{var t=localStorage.getItem("luma-theme");if(t==="paper")t="light";if(t&&t!=="system")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${atkinson.variable} ${newsreader.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
