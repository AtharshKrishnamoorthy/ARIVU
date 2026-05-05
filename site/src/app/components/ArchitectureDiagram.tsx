"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/* ── Data ──────────────────────────────────────────────────────────── */
const databases = [
    { name: "PostgreSQL", src: "/postgresql-logo.svg" },
    { name: "MySQL", src: "/mysql-logo.svg" },
    { name: "SQLite", src: "/sqlite-logo.svg" },
    { name: "Databricks", src: "/databricks.png", size: 80 },
    { name: "Snowflake", src: "/snowflake.svg", invert: false, size: 80 },
];

const llms = [
    { name: "OpenAI", src: "/openai-svgrepo-com.svg", invert: true },
    { name: "Anthropic", src: "/anthropic-logo.png" },
    { name: "Groq", src: "/groq-logo.png" },
    { name: "DeepSeek", src: "/deepseek-color.svg" },
    { name: "Ollama", src: "/ollama-logo-dark.svg" },
    { name: "HuggingFace", src: "/hf-logo.svg" },
];

const channels = [
    { name: "Telegram", src: "/telegram-svgrepo-com.svg" },
    { name: "WhatsApp", src: "/whatsapp-svgrepo-com.svg" },
    { name: "Slack", src: "/slack-svgrepo-com.svg" },
    { name: "Discord", src: "/discord-svgrepo-com.svg" },
];

const mcpIntegrations = [
    { name: "Cursor", src: "/cursor.svg", invert: true },
    { name: "Windsurf", src: "/windsurf.svg", invert: true },
    { name: "Claude Code", src: "/claude-code.svg", invert: true, filter: "hue-rotate(-20deg) saturate(1.5) brightness(1.1)" },
];

/* ── Grid Cell — logos sit directly inside these ──────────────────── */
function GridCell({
    name, src, invert, size = 36, filter,
}: {
    name: string; src: string; invert?: boolean; size?: number; filter?: string;
}) {
    return (
        <div className="group flex flex-col items-center justify-center gap-3 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300 p-4 md:p-5 w-full h-full min-h-[96px]">
            <Image
                src={src} alt={name} width={size} height={size}
                className={`object-contain transition-transform duration-300 group-hover:scale-110 ${invert ? "invert opacity-80" : ""}`}
                style={filter ? { filter } : {}}
                unoptimized
            />
            <span className="text-[9px] md:text-[10px] font-semibold text-white/30 group-hover:text-white/50 tracking-[0.12em] uppercase transition-colors duration-300 text-center">
                {name}
            </span>
        </div>
    );
}

/* ── Horizontal Arrow (for desktop) ──────────────────────────────── */
function HArrow() {
    return (
        <div className="hidden lg:flex items-center justify-center border-y border-white/[0.06] bg-white/[0.01] px-2">
            <svg width="48" height="12" viewBox="0 0 48 12" className="text-white/15">
                <line x1="0" y1="6" x2="40" y2="6" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                <path d="M38 2 L46 6 L38 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

/* ── Vertical Arrow (for mobile) ─────────────────────────────────── */
function VArrowMobile() {
    return (
        <div className="flex lg:hidden items-center justify-center py-3">
            <svg width="12" height="32" viewBox="0 0 12 32" className="text-white/15">
                <line x1="6" y1="0" x2="6" y2="24" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                <path d="M2 22 L6 30 L10 22" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

/* ── Vertical Arrow between LLMs and Engine (desktop) ────────────── */
function VArrowDesktop() {
    return (
        <div className="hidden lg:flex items-center justify-center py-0 border-x border-white/[0.00] bg-white/[0.00]">
            <svg width="12" height="36" viewBox="0 0 12 36" className="text-white/15">
                <line x1="6" y1="0" x2="6" y2="28" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                <path d="M2 26 L6 34 L10 26" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

/* ── Main Component ───────────────────────────────────────────────── */
export default function ArchitectureDiagram() {
    return (
        <section className="w-full py-28 border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="text-center mb-16">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold mb-3">Ecosystem</p>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Architecture Overview</h2>
                    <p className="text-white/40 max-w-2xl mx-auto leading-relaxed">
                        Arivu sits at the center of your data stack — connecting databases, LLM providers, and communication channels through a unified agentic pipeline.
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="relative"
                >
                    {/* ════════════════════════════════════════════════════════════
              DESKTOP LAYOUT (lg+)
              ════════════════════════════════════════════════════════════ */}
                    <div className="hidden lg:block">
                        {/* ── Row 1: LLM Providers ── */}
                        <div className="text-center mb-0">
                            <div className="inline-block">
                                <div className="border border-white/[0.06] bg-white/[0.01] px-6 py-2 text-center">
                                    <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">LLM Providers</span>
                                </div>
                                <div className="grid grid-cols-6">
                                    {llms.map(l => <GridCell key={l.name} {...l} size={32} />)}
                                </div>
                            </div>
                        </div>

                        {/* ── Vertical arrow from LLMs to Engine ── */}
                        <div className="flex justify-center">
                            <VArrowDesktop />
                        </div>

                        {/* ── Row 2: [Data Sources] → [Engine] → [Channels] ── */}
                        <div className="grid grid-cols-[1fr_auto_auto_auto_2fr_auto_auto_auto_1fr] items-stretch">
                            {/* Empty left spacer */}
                            <div />

                            {/* Data Sources column */}
                            <div className="flex flex-col h-full w-[240px]">
                                <div className="border border-white/[0.06] bg-white/[0.01] px-6 py-2 text-center h-10 flex items-center justify-center">
                                    <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">Data Sources</span>
                                </div>
                                <div className="grid grid-cols-2 flex-grow h-full auto-rows-[minmax(96px,1fr)]">
                                    {databases.map(d => (
                                        <div key={d.name} className={d.name === "Snowflake" ? "col-span-2 h-full" : "col-span-1 h-full"}>
                                            <GridCell {...d} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Arrow → */}
                            <HArrow />

                            {/* Empty buffer */}
                            <div />

                            {/* Arivu Engine */}
                            <div className="flex flex-col items-center justify-center border border-white/[0.08] bg-white/[0.025] relative">
                                {/* Subtle internal glow */}
                                <div className="absolute inset-0 bg-white/[0.01] rounded-none" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-white/[0.03] rounded-full blur-[60px]" />

                                <div className="relative z-10 flex flex-col items-center gap-4 py-8 px-12">
                                    <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">Engine</span>
                                    <div className="relative flex items-center justify-center w-36 h-36 rounded-2xl border border-white/[0.12] bg-white/[0.04] ring-1 ring-white/[0.06]">
                                        <Image src="/arivu-logo-dark.png" alt="Arivu" width={72} height={72} className="object-contain" unoptimized />
                                        <span className="absolute inset-0 rounded-2xl animate-ping opacity-[0.03] bg-white" style={{ animationDuration: "3s" }} />
                                    </div>
                                    <span className="text-base font-bold text-white/50 tracking-wide">Arivu</span>
                                    <div className="flex gap-4 mt-1">
                                        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5">
                                            <Image src="/arivu-logo-dark.png" alt="" width={14} height={14} className="object-contain opacity-50" unoptimized />
                                            <span className="text-[10px] text-white/30 font-medium">Dashboard</span>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.887S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.032v-2.867s-.11-3.403 3.345-3.403h5.765s3.236.052 3.236-3.127V3.264S18.28 0 11.914 0zM8.708 1.885a1.053 1.053 0 1 1 0 2.107 1.053 1.053 0 0 1 0-2.107z" fill="#3776AB" />
                                                <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752h-5.814v-.826h8.134S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96h-2.032v2.867s.11 3.403-3.345 3.403H9.455s-3.236-.052-3.236 3.127v5.268S5.72 24 12.086 24zm3.206-1.885a1.053 1.053 0 1 1 0-2.107 1.053 1.053 0 0 1 0 2.107z" fill="#FFD43B" />
                                            </svg>
                                            <span className="text-[10px] text-white/30 font-medium">Python SDK</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Empty buffer */}
                            <div />

                            {/* Arrow → */}
                            <HArrow />

                            {/* Channels column */}
                            <div className="flex flex-col h-full w-[240px]">
                                <div className="border border-white/[0.06] bg-white/[0.01] px-6 py-2 text-center h-10 flex items-center justify-center">
                                    <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">Channels</span>
                                </div>
                                <div className="grid grid-cols-2 flex-grow h-full auto-rows-[minmax(96px,1fr)]">
                                    {channels.map(d => (
                                        <div key={d.name} className="col-span-1 h-full">
                                            <GridCell {...d} size={40} />
                                        </div>
                                    ))}
                                </div>
                                <div className="border border-white/[0.06] bg-white/[0.01] px-6 py-2 text-center h-10 flex items-center justify-center mt-4">
                                    <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">MCP Integrations</span>
                                </div>
                                <div className="grid grid-cols-3 auto-rows-[minmax(88px,1fr)]">
                                    {mcpIntegrations.map(m => (
                                        <div key={m.name} className="col-span-1 border-b-0 border-white/[0.06]">
                                            <GridCell {...m} size={m.size || 28} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Empty right spacer */}
                            <div />
                        </div>
                    </div>

                    {/* ════════════════════════════════════════════════════════════
              MOBILE LAYOUT (< lg)
              ════════════════════════════════════════════════════════════ */}
                    <div className="lg:hidden flex flex-col items-center">
                        {/* LLM Providers */}
                        <div className="w-full max-w-sm">
                            <div className="border border-white/[0.06] bg-white/[0.01] px-4 py-2 text-center">
                                <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">LLM Providers</span>
                            </div>
                            <div className="grid grid-cols-3 auto-rows-[minmax(88px,1fr)]">
                                {llms.map(l => <GridCell key={l.name} {...l} size={26} />)}
                            </div>
                        </div>

                        <VArrowMobile />

                        {/* Data Sources */}
                        <div className="w-full max-w-sm">
                            <div className="border border-white/[0.06] bg-white/[0.01] px-4 py-2 text-center">
                                <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">Data Sources</span>
                            </div>
                            <div className="grid grid-cols-2 auto-rows-[minmax(92px,1fr)]">
                                {databases.map(d => (
                                    <div key={d.name} className={d.name === "Snowflake" ? "col-span-2" : "col-span-1"}>
                                        <GridCell {...d} size={d.size || 30} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <VArrowMobile />

                        {/* Arivu Engine */}
                        <div className="w-full max-w-sm border border-white/[0.08] bg-white/[0.025] flex flex-col items-center py-8 px-6 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] bg-white/[0.03] rounded-full blur-[40px]" />
                            <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20 mb-4 relative z-10">Engine</span>
                            <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl border border-white/[0.12] bg-white/[0.04] z-10">
                                <Image src="/arivu-logo-dark.png" alt="Arivu" width={52} height={52} className="object-contain" unoptimized />
                            </div>
                            <span className="text-sm font-bold text-white/50 mt-3 relative z-10">Arivu</span>
                            <div className="flex gap-3 mt-3 relative z-10">
                                <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                                    <Image src="/arivu-logo-dark.png" alt="" width={10} height={10} className="object-contain opacity-50" unoptimized />
                                    <span className="text-[8px] text-white/30">Dashboard</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                        <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.887S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.032v-2.867s-.11-3.403 3.345-3.403h5.765s3.236.052 3.236-3.127V3.264S18.28 0 11.914 0zM8.708 1.885a1.053 1.053 0 1 1 0 2.107 1.053 1.053 0 0 1 0-2.107z" fill="#3776AB" />
                                        <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752h-5.814v-.826h8.134S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96h-2.032v2.867s.11 3.403-3.345 3.403H9.455s-3.236-.052-3.236 3.127v5.268S5.72 24 12.086 24zm3.206-1.885a1.053 1.053 0 1 1 0-2.107 1.053 1.053 0 0 1 0 2.107z" fill="#FFD43B" />
                                    </svg>
                                    <span className="text-[8px] text-white/30">SDK</span>
                                </div>
                            </div>
                        </div>

                        <VArrowMobile />

                        {/* Channels */}
                        <div className="w-full max-w-sm border border-white/[0.06] bg-white/[0.01]">
                            <div className="border-b border-white/[0.06] px-4 py-2 text-center">
                                <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">Channels</span>
                            </div>
                            <div className="grid grid-cols-2 auto-rows-[minmax(92px,1fr)]">
                                {channels.map(c => <GridCell key={c.name} {...c} size={30} />)}
                            </div>
                        </div>

                        <VArrowMobile />

                        {/* MCP Tools */}
                        <div className="w-full max-w-sm border border-white/[0.06] bg-white/[0.01]">
                            <div className="border-b border-white/[0.06] px-4 py-2 text-center">
                                <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-white/20">MCP Integrations</span>
                            </div>
                            <div className="grid grid-cols-3 auto-rows-[minmax(88px,1fr)]">
                                {mcpIntegrations.map(m => <GridCell key={m.name} {...m} size={m.size || 24} />)}
                            </div>
                        </div>

                    </div>

                    {/* Bottom tagline */}
                    <div className="mt-10 text-center">
                        <p className="text-[9px] tracking-[0.3em] text-white/12 uppercase font-medium">
                            Natural Language → SQL → Structured Response
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}