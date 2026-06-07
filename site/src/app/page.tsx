"use client";

import { useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { ArrowRight, Terminal, Database, Zap, Code2, Blocks, Bot, GitBranch, LayoutDashboard } from "lucide-react";
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
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", ring: "ring-blue-500/20" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", ring: "ring-amber-500/20" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", ring: "ring-purple-500/20" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-400", ring: "ring-pink-500/20" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-400", ring: "ring-rose-500/20" },
};

const integrations = [
  { name: "OpenAI", src: "/openai-svgrepo-com.svg", invert: true },
  { name: "Anthropic", src: "/anthropic-logo.png", invert: false },
  { name: "Groq", src: "/groq-logo.png", invert: false },
  { name: "DeepSeek", src: "/deepseek-color.svg", invert: false },
  { name: "Ollama", src: "/ollama-logo-dark.svg", invert: false },
  { name: "Hugging Face", src: "/hf-logo.svg", invert: false },
  { name: "Alibaba", src: "/alibabacloud-color.svg", invert: false },
];

const databases = [
  { name: "PostgreSQL", src: "/postgresql-logo.svg", invert: false },
  { name: "MySQL", src: "/mysql-logo.svg", invert: false },
  { name: "SQLite", src: "/sqlite-logo.svg", invert: false },
  { name: "Databricks", src: "/databricks.png", invert: false },
  { name: "Snowflake", src: "/snowflake.svg", invert: false },
];

const platforms = [
  { name: "Slack", src: "/slack-svgrepo-com.svg", invert: false },
  { name: "Discord", src: "/discord-svgrepo-com.svg", invert: false },
  { name: "Telegram", src: "/telegram-svgrepo-com.svg", invert: false },
  { name: "WhatsApp", src: "/whatsapp-svgrepo-com.svg", invert: false },
  { name: "REST API", src: "/api-logo.svg", invert: true },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function LogoGrid({ items }: { items: typeof databases; cols?: number }) {
  // Duplicate items 4 times to ensure a seamless infinite scroll regardless of screen width
  const duplicatedItems = [...items, ...items, ...items, ...items];

  return (
    <div className="relative w-full overflow-hidden flex py-4">
      <div className="flex items-center gap-16 md:gap-24 animate-marquee w-max px-8">
        {duplicatedItems.map((logo, idx) => (
          <div
            key={`${logo.name}-${idx}`}
            className="flex flex-col items-center gap-3 group shrink-0"
          >
            <Image
              src={logo.src}
              alt={logo.name}
              width={40}
              height={40}
              className={`object-contain ${logo.invert ? "invert opacity-50" : "opacity-60"} group-hover:opacity-100 transition-opacity duration-300`}
              unoptimized
            />
            <span className="text-[10px] font-medium text-black/35 dark:text-white/35 group-hover:text-black/60 dark:text-white/60 transition-colors tracking-wide">
              {logo.name}
            </span>
          </div>
        ))}
      </div>
      {/* Edge gradient masks to make it fade smoothly */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black via-black/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black via-black/80 to-transparent" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-black/40 dark:text-white/40 border border-black/8 dark:border-white/8 bg-white/[0.03] mb-5">
      {children}
    </span>
  );
}

// ── Dashboard Mockup ────────────────────────────────────────────────────────
function DashboardMockup() {
  const { scrollYProgress } = useScroll({
    offset: ["start end", "center center"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [15, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);

  const springRotateX = useSpring(rotateX, { stiffness: 100, damping: 30 });
  const springScale = useSpring(scale, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      style={{
        rotateX: springRotateX,
        scale: springScale,
        boxShadow: "0 30px 100px -20px rgba(59,130,246,0.3)",
      }}
      className="w-full max-w-6xl rounded-xl md:rounded-2xl border border-black/10 dark:border-white/10 bg-[#0a0a0a] overflow-hidden relative shadow-2xl mx-auto perspective-[2000px] flex items-center justify-center"
    >
      <img src="/dashboard-db-new.png" alt="Arivu Dashboard" className="w-full h-auto object-contain" />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl md:rounded-2xl pointer-events-none" />
    </motion.div>
  );
}

// ── Animated Terminal ───────────────────────────────────────────────────────
const fullCodeText = `from arivu import Arivu

# Initialize the engine
db = Arivu.connect(
  host="postgres",
  port="5432",
  user="arivu",
  password="[PASSWORD]",
  dbname="postgres",
  dialect="postgresql",
  mode="admin",
  ttl="3600",
)

# Run AI pipeline

from arivu.pipeline import run_pipeline
input = db.query("What are the top 5 highest grossing customers?")
result = run_pipeline(input)

# View response

print(result.response)
print(result.sql)
print(result.success)
print(result.trace_events)`;

const highlightCode = (str: string) => {
  // Use single quotes for HTML attributes to prevent the regex from matching its own injected HTML
  return str
    .replace(/(".*?")/g, "<span class='text-amber-300/80'>$1</span>")
    .replace(/\b(from|import|True)\b/g, "<span class='text-sky-400'>$1</span>")
    .replace(/\b(Arivu|app|q|response)\b/g, "<span class='text-black/90 dark:text-white/90'>$1</span>")
    .replace(/\.(connect|query|run_pipeline)\b/g, ".<span class='text-emerald-400'>$1</span>")
    .replace(/(#.*)/g, "<span class='text-black/30 dark:text-white/30'>$1</span>")
    .replace(/\b(print)\b/g, "<span class='text-purple-400'>$1</span>");
};

function AnimatedTerminal() {
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullCodeText.slice(0, i));
      i++;
      if (i > fullCodeText.length) clearInterval(interval);
    }, 12); // Fast character typing speed

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -32 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl md:rounded-2xl border border-black/8 dark:border-white/8 bg-[#0a0a0a] overflow-hidden w-full max-w-4xl mx-auto shadow-2xl"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/6 dark:border-white/6 bg-white/[0.01]">
        <div className="flex gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500/40 border border-red-500/50" />
          <div className="w-3.5 h-3.5 rounded-full bg-amber-500/40 border border-amber-500/50" />
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/40 border border-emerald-500/50" />
        </div>
        <span className="font-mono text-xs text-black/30 dark:text-white/30 tracking-wider flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5" /> main.py
        </span>
        <div className="w-14" />
      </div>
      <div className="p-6 md:p-8 overflow-x-auto h-[400px] text-[13px] md:text-[15px] font-mono leading-relaxed text-black/70 dark:text-white/70 whitespace-pre">
        <span dangerouslySetInnerHTML={{ __html: highlightCode(typedText) }} />
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block w-2.5 h-5 bg-white/60 dark:bg-black/60 dark:bg-white/60 translate-y-1 ml-1"
        />
      </div>
    </motion.div>
  );
}

// ── Product Showcase Toggle ──────────────────────────────────────────────────
function ProductShowcase() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "sdk">("dashboard");

  return (
    <section className="w-full px-4 sm:px-6 pb-28 pt-8 flex flex-col items-center">
      {/* Content Area */}
      <div className="w-full relative flex justify-center mb-8">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-5xl rounded-md overflow-hidden border border-black/10 dark:border-white/10 shadow-[0_0_80px_rgba(255,255,255,0.05)] bg-white/50 dark:bg-black/50"
            >
              <video
                src="/motion-video.mp4"
                autoPlay
                loop
                muted
                playsInline
                controls
                className="w-full h-auto object-contain"
              />
            </motion.div>
          ) : (
            <motion.div
              key="sdk"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-6xl"
            >
              <AnimatedTerminal />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toggle Tab */}
      <div className="flex items-center p-1.5 bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-full mt-4 backdrop-blur-md shadow-2xl relative z-30">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`relative p-2 rounded-full flex items-center justify-center transition-colors duration-300 ${activeTab === "dashboard" ? "text-white dark:text-black" : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white dark:text-black dark:text-white"}`}
          title="Dashboard"
        >
          {activeTab === "dashboard" && (
            <motion.div layoutId="activeTab" className="absolute inset-0 bg-white dark:bg-black dark:bg-white rounded-full shadow-md" transition={{ type: "spring", stiffness: 300, damping: 25 }} />
          )}
          <LayoutDashboard className="relative z-10 w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveTab("sdk")}
          className={`relative p-2 rounded-full flex items-center justify-center transition-colors duration-300 ${activeTab === "sdk" ? "text-white dark:text-black" : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white dark:text-black dark:text-white"}`}
          title="Python SDK"
        >
          {activeTab === "sdk" && (
            <motion.div layoutId="activeTab" className="absolute inset-0 bg-white dark:bg-black dark:bg-white rounded-full shadow-md" transition={{ type: "spring", stiffness: 300, damping: 25 }} />
          )}
          <Code2 className="relative z-10 w-5 h-5" />
        </button>
      </div>
    </section>
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
            <span className="inline-flex items-center rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-black/70 dark:text-white/70 border border-black/10 dark:border-white/10 bg-white/5 dark:bg-black/5 dark:bg-white/5 backdrop-blur-md">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2 shrink-0 animate-pulse" />
              v0.3 Open Source Release
            </span>
          </motion.div>

          {/* Heading — original white fade gradient */}
          <motion.h1
            variants={itemAnim}
            className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-black dark:from-white to-black/60 dark:to-white/60"
          >
            The Agentic Database <br className="hidden md:block" /> Command Center
          </motion.h1>

          {/* Sub */}
          <motion.p
            variants={itemAnim}
            className="text-base md:text-lg text-black/45 dark:text-white/45 mb-10 max-w-xl mx-auto leading-relaxed"
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
              className="flex items-center gap-2 rounded-full bg-white dark:bg-black dark:bg-white text-white dark:text-black px-6 py-3 font-semibold transition-all hover:bg-black/90 dark:hover:bg-white/90 dark:bg-black/90 dark:bg-white/90 hover:scale-105 active:scale-95"
            >
              <Terminal className="h-4 w-4" />
              pip install arivu-ai
            </Link>
            <Link
              href="#features"
              className="flex items-center gap-2 rounded-full border border-black/20 dark:border-white/20 bg-white/5 dark:bg-black/5 dark:bg-white/5 px-6 py-3 font-medium text-white dark:text-black dark:text-white transition-all hover:bg-black/10 dark:hover:bg-white/10 dark:bg-black/10 dark:bg-white/10"
            >
              Explore Features
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </motion.div>

        {/* ── Product Showcase Toggle ───────────────────────────────────────────── */}
        <ProductShowcase />
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="w-full max-w-6xl px-4 sm:px-6 py-24 border-t border-black/6 dark:border-white/6">
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
          <motion.p variants={itemAnim} className="text-black/40 dark:text-white/40 max-w-xl mx-auto text-base leading-relaxed">
            Everything you need to orchestrate pipelines, observe agent reasoning, and manage federated connections — unified.
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-fr"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-5%" }}
        >
          {features.map((f, i) => {
            const Icon = f.icon;
            const c = colorMap[f.color];

            // Bento Box layout spanning logic
            let colSpan = "md:col-span-1";
            if (i === 0 || i === 3 || i === 4) colSpan = "md:col-span-2";

            return (
              <motion.div
                key={f.title}
                variants={itemAnim}
                className={`group relative rounded-3xl border border-black/7 dark:border-white/7 bg-white/[0.02] hover:bg-white/[0.04] hover:border-black/12 dark:border-white/12 p-8 transition-all duration-300 overflow-hidden flex flex-col justify-between ${colSpan}`}
              >
                {/* Hover glow */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${c.bg} blur-3xl scale-150`} />
                <div className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl ${c.bg} ${c.text} ring-1 ${c.ring} mb-6 shadow-inner`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="relative text-lg font-semibold mb-3 tracking-tight text-black/90 dark:text-white/90">
                    {f.title}
                  </h3>
                  <p className="relative text-sm text-black/40 dark:text-white/40 leading-relaxed font-medium">
                    {f.desc}
                  </p>
                </div>
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
      <section id="ecosystem" className="w-full border-t border-black/6 dark:border-white/6">

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
            <motion.p variants={itemAnim} className="text-black/35 dark:text-white/35 text-sm max-w-md mx-auto">
              Connect and federate data from your favorite warehouses and SQL databases.
            </motion.p>
          </motion.div>
          <LogoGrid items={databases} />
        </div>

        {/* Divider */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="h-px bg-white/6 dark:bg-black/6 dark:bg-white/6" />
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
            <motion.p variants={itemAnim} className="text-black/35 dark:text-white/35 text-sm max-w-md mx-auto">
              Arivu routes intelligently to your preferred model provider automatically.
            </motion.p>
          </motion.div>
          <LogoGrid items={integrations} />
        </div>

        {/* Divider */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="h-px bg-white/6 dark:bg-black/6 dark:bg-white/6" />
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
            <motion.p variants={itemAnim} className="text-black/35 dark:text-white/35 text-sm max-w-md mx-auto">
              Deploy directly to the platforms your team already uses, plus REST API for full control.
            </motion.p>
          </motion.div>
          <LogoGrid items={platforms} />
        </div>
      </section>

      <section className="w-full border-t border-black/6 dark:border-white/6">
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
            className="text-black/40 dark:text-white/40 text-base mb-10 max-w-md leading-relaxed"
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
              className="flex items-center gap-2 rounded-full bg-white dark:bg-black dark:bg-white text-white dark:text-black px-6 py-3 font-semibold transition-all hover:bg-black/90 dark:hover:bg-white/90 dark:bg-black/90 dark:bg-white/90 hover:scale-105 active:scale-95"
            >
              <GitBranch className="h-4 w-4" />
              View on GitHub
            </Link>
            <Link
              href="#sdk"
              className="flex items-center gap-2 rounded-full border border-black/20 dark:border-white/20 bg-white/5 dark:bg-black/5 dark:bg-white/5 px-6 py-3 font-medium text-white dark:text-black dark:text-white transition-all hover:bg-black/10 dark:hover:bg-white/10 dark:bg-black/10 dark:bg-white/10"
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