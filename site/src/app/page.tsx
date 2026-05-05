"use client";

import { motion } from "framer-motion";
import { ArrowRight, Terminal, Database, Zap, Code2, Blocks, Bot, GitBranch } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ArchitectureDiagram from "./components/ArchitectureDiagram";
import HowItWorks from "./components/HowItWorks";

// ── Animation Variants ──────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 22 } },
};

// ── Data ─────────────────────────────────────────────────────────────────────
const features = [
  {
    icon: Code2,
    color: "blue",
    title: "Natural Language Querying",
    desc: "Translate plain English into optimized SQL. Arivu executes queries safely and renders answers as charts or tables — no SQL knowledge required.",
  },
  {
    icon: Database,
    color: "emerald",
    title: "Multi-Database Federation",
    desc: "Connect PostgreSQL, MySQL, SQLite, Databricks, and Snowflake. Switch active environments securely on the fly from a single interface.",
  },
  {
    icon: Zap,
    color: "amber",
    title: "Graph-Based Observability",
    desc: "Deep-dive into granular pipeline traces, node latencies, memory state tracking, and SQL syntax errors in real-time — never wonder why an agent failed.",
  },
  {
    icon: Terminal,
    color: "purple",
    title: "Unified Dashboard",
    desc: "Monitor metrics, view conversation states across platforms, manage credentials, and deploy your agent from a single pane of glass.",
  },
  {
    icon: Blocks,
    color: "pink",
    title: "SDK & MCP Support",
    desc: "Extend agents with a robust Python SDK and native MCP integrations for seamless AI tool execution inside Cursor or Windsurf.",
  },
  {
    icon: Bot,
    color: "rose",
    title: "Automations & Mail",
    desc: "Trigger recurring dataset checks and dispatch automated email reports, query results, and system alerts directly to your team's inbox.",
  },
];

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  blue:    { bg: "bg-blue-500/10",    text: "text-blue-400",    ring: "ring-blue-500/20" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/20" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-400",   ring: "ring-amber-500/20" },
  purple:  { bg: "bg-purple-500/10",  text: "text-purple-400",  ring: "ring-purple-500/20" },
  pink:    { bg: "bg-pink-500/10",    text: "text-pink-400",    ring: "ring-pink-500/20" },
  rose:    { bg: "bg-rose-500/10",    text: "text-rose-400",    ring: "ring-rose-500/20" },
};

const integrations = [
  { name: "OpenAI",       src: "/openai-svgrepo-com.svg",   invert: true },
  { name: "Anthropic",    src: "/anthropic-logo.png",        invert: false },
  { name: "Groq",         src: "/groq-logo.png",             invert: false },
  { name: "DeepSeek",     src: "/deepseek-color.svg",        invert: false },
  { name: "Ollama",       src: "/ollama-logo-dark.svg",      invert: false },
  { name: "Hugging Face", src: "/hf-logo.svg",               invert: false },
  { name: "Alibaba",      src: "/alibabacloud-color.svg",    invert: false },
];

const databases = [
  { name: "PostgreSQL", src: "/postgresql-logo.svg", invert: false },
  { name: "MySQL",      src: "/mysql-logo.svg",       invert: false },
  { name: "SQLite",     src: "/sqlite-logo.svg",      invert: false },
  { name: "Databricks", src: "/databricks.png",       invert: false },
  { name: "Snowflake",  src: "/snowflake.svg",        invert: false },
];

const platforms = [
  { name: "Slack",    src: "/slack-svgrepo-com.svg",    invert: false },
  { name: "Discord",  src: "/discord-svgrepo-com.svg",  invert: false },
  { name: "Telegram", src: "/telegram-svgrepo-com.svg", invert: false },
  { name: "WhatsApp", src: "/whatsapp-svgrepo-com.svg", invert: false },
  { name: "REST API", src: "/api-logo.svg",              invert: true },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function LogoGrid({ items, cols }: { items: typeof databases; cols: number }) {
  return (
    <motion.div
      className={`grid gap-6 items-center justify-items-center`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10%" }}
    >
      {items.map((logo) => (
        <motion.div
          key={logo.name}
          variants={itemAnim}
          className="flex flex-col items-center gap-3 group"
        >
          <Image
            src={logo.src}
            alt={logo.name}
            width={40}
            height={40}
            className={`object-contain ${logo.invert ? "invert opacity-50" : "opacity-60"} group-hover:opacity-100 transition-opacity duration-300`}
            unoptimized
          />
          <span className="text-[10px] font-medium text-white/35 group-hover:text-white/60 transition-colors tracking-wide">
            {logo.name}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-white/40 border border-white/8 bg-white/[0.03] mb-5">
      {children}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="flex flex-col items-center w-full">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative w-full flex flex-col items-center justify-center pt-36 pb-28 px-4 sm:px-6 overflow-hidden">
        {/* Top divider line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="text-center max-w-3xl z-10"
        >
          {/* Badge — original style */}
          <motion.div variants={itemAnim} className="mb-6 flex justify-center">
            <span className="inline-flex items-center rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70 border border-white/10 bg-white/5 backdrop-blur-md">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2 shrink-0 animate-pulse" />
              v0.2 Open Source Release
            </span>
          </motion.div>

          {/* Heading — original white fade gradient */}
          <motion.h1
            variants={itemAnim}
            className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
          >
            The Agentic Database <br className="hidden md:block" /> Command Center
          </motion.h1>

          {/* Sub */}
          <motion.p
            variants={itemAnim}
            className="text-base md:text-lg text-white/45 mb-10 max-w-xl mx-auto leading-relaxed"
          >
            Arivu bridges your data and AI — a scalable Python SDK with a beautiful no-code observability dashboard for orchestrating intelligent data pipelines.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={itemAnim}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="https://github.com/AtharshKrishnamoorthy/ARIVU"
              target="_blank"
              className="flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 font-semibold transition-all hover:bg-white/90 hover:scale-105 active:scale-95"
            >
              <Terminal className="h-4 w-4" />
              pip install arivu-ai
            </Link>
            <Link
              href="#features"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-medium text-white transition-all hover:bg-white/10"
            >
              Explore Features
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── SDK Preview ──────────────────────────────────────────────────── */}
      <section id="sdk" className="w-full max-w-3xl px-4 sm:px-6 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden"
        >
          {/* Window chrome */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/40" />
              <div className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/40" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500/40" />
            </div>
            <span className="font-mono text-[10px] text-white/25 tracking-wider">main.py</span>
            <div className="w-14" />
          </div>
          {/* Code */}
          <div className="p-6 overflow-x-auto text-[13px] font-mono leading-7 text-white/70 whitespace-pre">
            <span className="text-sky-400">from</span>{" "}
            <span className="text-white/90">arivu</span>{" "}
            <span className="text-sky-400">import</span>{" "}
            <span className="text-white/90">Arivu</span>{"\n\n"}
            <span className="text-white/25"># Initialize the engine</span>{"\n"}
            <span className="text-white/90">app</span>{" = "}
            <span className="text-white/90">Arivu</span>
            <span className="text-white/50">.</span>
            <span className="text-emerald-400">connect</span>
            <span className="text-white/50">(</span>{"\n"}
            {"  "}<span className="text-sky-300/80">database_url</span>
            <span className="text-white/50">=</span>
            <span className="text-amber-300/80">&quot;postgresql://user:pass@localhost:5432/db&quot;</span>
            <span className="text-white/50">,</span>{"\n"}
            {"  "}<span className="text-sky-300/80">llm_provider</span>
            <span className="text-white/50">=</span>
            <span className="text-amber-300/80">&quot;openai&quot;</span>
            <span className="text-white/50">,</span>{"\n"}
            {"  "}<span className="text-sky-300/80">monitoring</span>
            <span className="text-white/50">=</span>
            <span className="text-sky-400">True</span>{"\n"}
            <span className="text-white/50">)</span>{"\n\n"}
            <span className="text-white/25"># Run AI pipeline</span>{"\n"}
            <span className="text-white/90">q</span>{" = "}
            <span className="text-white/90">app</span>
            <span className="text-white/50">.</span>
            <span className="text-emerald-400">query</span>
            <span className="text-white/50">(</span>
            <span className="text-amber-300/80">&quot;What are the top 5 highest grossing customers?&quot;</span>
            <span className="text-white/50">)</span>{"\n"}
            <span className="text-white/90">response</span>{" = "}
            <span className="text-white/90">app</span>
            <span className="text-white/50">.</span>
            <span className="text-emerald-400">run_pipeline</span>
            <span className="text-white/50">(</span>
            <span className="text-white/90">q</span>
            <span className="text-white/50">)</span>{"\n\n"}
            <span className="text-purple-400">print</span>
            <span className="text-white/50">(</span>
            <span className="text-white/90">response</span>
            <span className="text-white/50">)</span>
          </div>
        </motion.div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="w-full max-w-6xl px-4 sm:px-6 py-24 border-t border-white/6">
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.div variants={itemAnim} className="flex justify-center">
            <SectionLabel>Features</SectionLabel>
          </motion.div>
          <motion.h2 variants={itemAnim} className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Powerful Agentic Capabilities
          </motion.h2>
          <motion.p variants={itemAnim} className="text-white/40 max-w-xl mx-auto text-base leading-relaxed">
            Everything you need to orchestrate pipelines, observe agent reasoning, and manage federated connections — unified.
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-5%" }}
        >
          {features.map((f) => {
            const Icon = f.icon;
            const c = colorMap[f.color];
            return (
              <motion.div
                key={f.title}
                variants={itemAnim}
                className="group relative rounded-2xl border border-white/7 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/12 p-7 transition-all duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${c.bg} blur-2xl scale-150`} />
                <div className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} ${c.text} ring-1 ${c.ring} mb-5`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="relative text-[15px] font-semibold mb-2.5 tracking-tight text-white/90">
                  {f.title}
                </h3>
                <p className="relative text-sm text-white/40 leading-relaxed">
                  {f.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── Architecture Diagram ─────────────────────────────────────────── */}
      <ArchitectureDiagram />

      {/* ── Ecosystem ────────────────────────────────────────────────────── */}
      <section id="ecosystem" className="w-full border-t border-white/6">

        {/* Databases */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div variants={itemAnim} className="flex justify-center">
              <SectionLabel>Databases</SectionLabel>
            </motion.div>
            <motion.h2 variants={itemAnim} className="text-2xl font-bold mb-3 tracking-tight">
              Supported Databases
            </motion.h2>
            <motion.p variants={itemAnim} className="text-white/35 text-sm max-w-md mx-auto">
              Connect and federate data from your favorite warehouses and SQL databases.
            </motion.p>
          </motion.div>
          <LogoGrid items={databases} cols={5} />
        </div>

        {/* Divider */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="h-px bg-white/6" />
        </div>

        {/* Models */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div variants={itemAnim} className="flex justify-center">
              <SectionLabel>Models</SectionLabel>
            </motion.div>
            <motion.h2 variants={itemAnim} className="text-2xl font-bold mb-3 tracking-tight">
              Supported LLM Providers
            </motion.h2>
            <motion.p variants={itemAnim} className="text-white/35 text-sm max-w-md mx-auto">
              Arivu routes intelligently to your preferred model provider automatically.
            </motion.p>
          </motion.div>
          <LogoGrid items={integrations} cols={7} />
        </div>

        {/* Divider */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="h-px bg-white/6" />
        </div>

        {/* Platforms */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div variants={itemAnim} className="flex justify-center">
              <SectionLabel>Platforms</SectionLabel>
            </motion.div>
            <motion.h2 variants={itemAnim} className="text-2xl font-bold mb-3 tracking-tight">
              Communication Platforms
            </motion.h2>
            <motion.p variants={itemAnim} className="text-white/35 text-sm max-w-md mx-auto">
              Deploy directly to the platforms your team already uses, plus REST API for full control.
            </motion.p>
          </motion.div>
          <LogoGrid items={platforms} cols={5} />
        </div>
      </section>

      <section className="w-full border-t border-white/6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-28 flex flex-col items-center text-center relative overflow-hidden">
          <motion.div
            className="flex justify-center mb-5"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionLabel>Open Source</SectionLabel>
          </motion.div>
          <motion.h2
            className="text-3xl md:text-5xl font-bold tracking-tight mb-5 max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.05 }}
          >
            Start querying your data intelligently today
          </motion.h2>
          <motion.p
            className="text-white/40 text-base mb-10 max-w-md leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Arivu is fully open source. Star it, fork it, or contribute — the agentic data layer is yours to build on.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <Link
              href="https://github.com/AtharshKrishnamoorthy/ARIVU"
              target="_blank"
              className="flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 font-semibold transition-all hover:bg-white/90 hover:scale-105 active:scale-95"
            >
              <GitBranch className="h-4 w-4" />
              View on GitHub
            </Link>
            <Link
              href="#sdk"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-medium text-white transition-all hover:bg-white/10"
            >
              <Terminal className="h-4 w-4" />
              pip install arivu-ai
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  );
}