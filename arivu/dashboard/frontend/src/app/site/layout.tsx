import Link from "next/link";
import { Github, Star } from "lucide-react";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/20">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/site" className="flex items-center transition-opacity hover:opacity-80">
              {/* Responsive theme logos */}
              <img src="/arivu-logo-dark.png" alt="Arivu Logo" className="hidden dark:block h-8 w-auto object-contain" />
              <img src="/arivu-logo-light.png" alt="Arivu Logo" className="block dark:hidden h-8 w-auto object-contain" />
            </Link>
            
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-white/60">
              <Link href="/site#features" className="transition-colors hover:text-white">Features</Link>
              <Link href="/site#integrations" className="transition-colors hover:text-white">Integrations</Link>
              <Link href="/site#sdk" className="transition-colors hover:text-white">SDK</Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="https://github.com/arivu-io/arivu" 
              target="_blank" 
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 py-1.5 px-3 text-xs font-medium backdrop-blur-md transition-all hover:bg-white/10"
            >
              <Github className="h-4 w-4" />
              <div className="h-3.5 w-[1px] bg-white/20 mx-0.5" />
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-white/80" />
                <span className="font-mono">1.2k</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black pt-16 pb-8">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <Link href="/site" className="flex items-center mb-4">
                <img src="/arivu-logo-dark.png" alt="Arivu Logo" className="hidden dark:block h-6 w-auto object-contain opacity-80" />
                <img src="/arivu-logo-light.png" alt="Arivu Logo" className="block dark:hidden h-6 w-auto object-contain opacity-80" />
              </Link>
              <p className="text-white/40 text-sm max-w-xs leading-relaxed">
                The open-source framework for autonomous database agents. Build, scale, and observe your data pipelines with ease.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm text-white/90">Ecosystem</h4>
              <ul className="space-y-3 text-sm text-white/50">
                <li><Link href="/site#features" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/site#sdk" className="hover:text-white transition-colors">Python SDK</Link></li>
                <li><Link href="/site#integrations" className="hover:text-white transition-colors">Integrations</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-sm text-white/90">Legal</h4>
              <ul className="space-y-3 text-sm text-white/50">
                <li><Link href="/site/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/site/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/site/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
            <p>© {new Date().getFullYear()} Arivu. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="https://github.com/arivu-io/arivu" className="hover:text-white transition-colors">
                GitHub
              </Link>
              <Link href="https://twitter.com/arivu_io" className="hover:text-white transition-colors">
                Twitter
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
