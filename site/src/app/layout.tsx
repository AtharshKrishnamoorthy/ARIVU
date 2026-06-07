import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";
import Link from "next/link";
import GithubStarButton from "./components/GithubStarButton";
import DotBackground from "./components/DotBackground";

export const metadata: Metadata = {
  title: "Arivu — The Agentic Database Command Center",
  description: "Open-source framework for autonomous database agents. Python SDK + no-code observability dashboard.",
  icons: {
    icon: "/arivu-logo-dark.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen bg-black text-white selection:bg-white/20 antialiased font-sans`}>
        <DotBackground>
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "rgba(20,20,20,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
              },
            }}
          />

          {/* Navigation Header */}
          <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/70 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
                  <img src="/arivu-logo-dark.png" alt="Arivu Logo" className="h-8 w-auto object-contain" />
                </Link>
                <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-white/55">
                  <Link href="/#features" className="transition-colors hover:text-white">Features</Link>
                  <Link href="/#integrations" className="transition-colors hover:text-white">Integrations</Link>
                  <Link href="https://pypi.org/project/arivu-ai/" target="_blank" className="transition-colors hover:text-white">SDK</Link>
                  <Link href="https://arivu.mintlify.app/" target="_blank" className="transition-colors hover:text-white">Docs</Link>
                </nav>
              </div>

              <div className="flex items-center gap-3">
                <GithubStarButton />
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          {/* Footer */}
          <footer className="border-t border-white/10 bg-black/50 pt-16 pb-8 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="col-span-1 md:col-span-2">
                  <Link href="/" className="flex items-center mb-4">
                    <img src="/arivu-logo-dark.png" alt="Arivu Logo" className="h-6 w-auto object-contain opacity-80" />
                  </Link>
                  <p className="text-white/40 text-sm max-w-xs leading-relaxed">
                    The open-source framework for agentic DB command center. Build, scale, and observe your data pipelines with ease.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 text-sm text-white/90">Ecosystem</h4>
                  <ul className="space-y-3 text-sm text-white/50">
                    <li><Link href="/#features" className="hover:text-white transition-colors">Dashboard</Link></li>
                    <li><Link href="https://pypi.org/project/arivu-ai/" target="_blank" className="hover:text-white transition-colors">Python SDK</Link></li>
                    <li><Link href="https://arivu.mintlify.app/" target="_blank" className="hover:text-white transition-colors">Documentation</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 text-sm text-white/90">Legal</h4>
                  <ul className="space-y-3 text-sm text-white/50">
                    <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                    <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                    <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                  </ul>
                </div>
              </div>
              <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
                <p>© {new Date().getFullYear()} Arivu. All rights reserved.</p>
                <div className="flex items-center gap-6">
                  <Link href="https://github.com/AtharshKrishnamoorthy/ARIVU" className="hover:text-white transition-colors">GitHub</Link>
                  <Link href="https://twitter.com/arivu_io" className="hover:text-white transition-colors">Twitter</Link>
                </div>
              </div>
            </div>
          </footer>
        </DotBackground>
      </body>
    </html>
  );
}