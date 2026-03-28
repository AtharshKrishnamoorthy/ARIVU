import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-24 flex flex-col items-center">
      <div className="w-full space-y-8 text-white/70">
        <h1 className="text-4xl font-bold tracking-tight text-white">Terms of Service</h1>
        <p className="text-sm text-white/40">Last Updated: March 2026</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Arivu, including our software SDKs, APIs, and dashboard (collectively, the &quot;Services&quot;),
            you agree to be bound by these Terms. If you disagree, do not use the Services.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">2. License</h2>
          <p>
            The Arivu core engine and dashboard are released under the MIT License. You are free to use, modify, and distribute the software subject to the license conditions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">3. Disclaimer of Warranties</h2>
          <p>
            The software is provided &quot;as is&quot;, without warranty of any kind. In no event shall the authors or copyright holders be liable for any claim or damages arising from your use of the software.
          </p>
        </section>

        <div className="pt-8 border-t border-white/10">
          <Link href="/" className="text-sm font-medium text-white hover:underline">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
