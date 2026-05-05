import Link from "next/link";

export default function PrivacyPage() {
    return (
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-24 flex flex-col items-center">
            <div className="w-full space-y-8 text-white/70">
                <h1 className="text-4xl font-bold tracking-tight text-white">Privacy Policy</h1>
                <p className="text-sm text-white/40">Last Updated: March 2026</p>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
                    <p>
                        Welcome to Arivu. We respect your privacy and are committed to protecting your personal data.
                        This Privacy Policy explains how we collect, use, and safeguard your information when you use our open-source software, dashboard, and website.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">2. Open Source & Telemetry</h2>
                    <p>
                        Arivu is primarily open-source software that you run on your own infrastructure. By default, the core engine and dashboard do <strong>not</strong> collect remote telemetry, logs, or database query data unless explicitly configured by the user to route through external LLM providers (e.g., OpenAI, Anthropic).
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">3. Third-Party Services</h2>
                    <p>
                        When utilizing Arivu&apos;s LLM adapters or integration platforms (Slack, Discord, Telegram, WhatsApp), your data transmission is subject to the privacy policies of those respective third parties. We do not intermediate or store these payloads on Arivu-owned servers.
                    </p>
                </section>

                <div className="pt-8 border-t border-white/10">
                    <Link href="/" className="text-sm font-medium text-white hover:underline">← Back to Home</Link>
                </div>
            </div>
        </div>
    );
}