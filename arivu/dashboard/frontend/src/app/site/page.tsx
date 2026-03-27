"use client";

import { motion } from "framer-motion";
import { ArrowRight, Terminal, Database, Shield, Zap, Code2, Server } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
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

  const platforms = [
    { name: "Slack", src: "/slack-svgrepo-com.svg", invert: false },
    { name: "Discord", src: "/discord-svgrepo-com.svg", invert: false },
    { name: "Telegram", src: "/telegram-svgrepo-com.svg", invert: false },
    { name: "WhatsApp", src: "/whatsapp-svgrepo-com.svg", invert: false },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      {/* ── Hero Section ────────────────────────────────────────── */}
      <section className="relative w-full flex flex-col items-center justify-center pt-32 pb-20 px-4 sm:px-6 overflow-hidden">
        {/* Abstract background gradient */}
        <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center max-w-4xl z-10"
        >
          <motion.div variants={item} className="mb-6 flex justify-center">
            <Badge variant="outline" className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70 border-white/10 bg-white/5 backdrop-blur-md">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2 shrink-0 animate-pulse" />
              v0.1 Open Source Release
            </Badge>
          </motion.div>
          
          <motion.h1 
            variants={item}
            className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
          >
            The Agentic Database <br className="hidden md:block" />
            Command Center
          </motion.h1>
          
          <motion.p 
            variants={item}
            className="text-lg md:text-xl text-white/50 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Arivu bridges the gap between your data and AI. Providing a scalable Python SDK 
            and a beautiful no-code observability dashboard for orchestrating data pipelines.
          </motion.p>
          
          <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="https://github.com/arivu-io/arivu" 
              target="_blank"
              className="flex items-center gap-2 rounded-lg bg-white text-black px-6 py-3 font-semibold transition-all hover:bg-white/90 hover:scale-105 active:scale-95"
            >
              <Terminal className="h-4 w-4" />
              pip install arivu
            </Link>
            <Link 
              href="#features" 
              className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-medium text-white transition-all hover:bg-white/10"
            >
              Explore Features
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── SDK Code Preview ────────────────────────────────────── */}
      <section id="sdk" className="w-full max-w-5xl px-4 sm:px-6 py-16">
        <div className="rounded-xl border border-white/10 bg-black/50 overflow-hidden backdrop-blur-sm shadow-2xl">
          <div className="flex items-center px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
            </div>
            <div className="mx-auto font-mono text-[10px] text-white/40">main.py</div>
          </div>
          <div className="p-6 overflow-x-auto text-sm font-mono text-white/80 whitespace-pre">
            <span className="text-blue-400">from</span> arivu <span className="text-blue-400">import</span> Arivu{`\n\n`}
            <span className="text-white/40"># Initialize the engine</span>{`\n`}
            app = Arivu.connect({`\n`}
            {`  `}database_url=<span className="text-emerald-400">"postgresql://user:pass@localhost:5432/db"</span>,{`\n`}
            {`  `}llm_provider=<span className="text-emerald-400">"openai"</span>,{`\n`}
            {`  `}monitoring=<span className="text-blue-400">True</span>{`\n`}
            ){`\n\n`}
            <span className="text-white/40"># Format context and run AI pipeline</span>{`\n`}
            q = app.query(<span className="text-emerald-400">"What are the top 5 highest grossing customers?"</span>){`\n`}
            response = app.run_pipeline(q){`\n\n`}
            <span className="text-amber-300">print</span>(response)
          </div>
        </div>
      </section>

      {/* ── Capabilities Highlights ─────────────────────────────── */}
      <section id="features" className="w-full max-w-6xl px-4 sm:px-6 py-24 space-y-32">
        
        {/* Feature 1: Chat Dashboard */}
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 space-y-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
              <Code2 className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">No-Code Querying <br/>& Visualization</h2>
            <p className="text-white/60 leading-relaxed text-lg">
              Explore your relational databases using natural language. Arivu translates prompts into optimized SQL, executes them safely, and renders answers instantly in a sleek chat interface.
            </p>
          </div>
          <div className="flex-[1.5] w-full relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl opacity-30" />
            <div className="relative rounded-xl border border-white/10 bg-white/5 p-2 shadow-2xl overflow-hidden ring-1 ring-white/10">
              <Image 
                src="/arivu-chat-dark.png" 
                alt="Chat Interface Preview" 
                width={1200}
                height={800}
                className="w-full h-auto rounded-lg object-cover"
                unoptimized
              />
            </div>
          </div>
        </div>

        {/* Feature 2: Multi-Connections */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-20">
          <div className="flex-1 space-y-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
              <Database className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Multi-Database <br/>Federation</h2>
            <p className="text-white/60 leading-relaxed text-lg">
              Manage unlimited PostgreSQL, MySQL, and SQLite connections seamlessly. Swap between active environments on the fly securely without exposing credentials to untrusted networks.
            </p>
          </div>
          <div className="flex-[1.5] w-full relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-3xl opacity-30" />
            <div className="relative rounded-xl border border-white/10 bg-white/5 p-2 shadow-2xl overflow-hidden ring-1 ring-white/10">
              <Image 
                src="/arivu-conn-dark.png" 
                alt="Connections Interface Preview" 
                width={1200}
                height={800}
                className="w-full h-auto rounded-lg object-cover"
                unoptimized
              />
            </div>
          </div>
        </div>

        {/* Feature 3: Observability */}
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 space-y-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
              <Zap className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Pipeline Tracing <br/>& Observability</h2>
            <p className="text-white/60 leading-relaxed text-lg">
              Never wonder why an agent failed. Deep-dive into granular pipeline traces, node latencies, and SQL syntax errors in real-time. Built-in RLHF tools allow teams to curate and improve generation accuracy.
            </p>
          </div>
          <div className="flex-[1.5] w-full relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-500/20 blur-3xl opacity-30" />
            <div className="relative rounded-xl border border-white/10 bg-white/5 p-2 shadow-2xl overflow-hidden ring-1 ring-white/10">
              <Image 
                src="/arivu-monitoring-dash-dark.png" 
                alt="Monitoring Dashboard Preview" 
                width={1200}
                height={800}
                className="w-full h-auto rounded-lg object-cover"
                unoptimized
              />
            </div>
          </div>
        </div>

      </section>

      {/* ── LLM Ecosystem ─────────────────────────────────────── */}
      <section id="models" className="w-full py-24 border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Supported Models</h2>
          <p className="text-white/50 mb-12 max-w-2xl mx-auto">
            Arivu routes intelligently to your favorite LLM providers automatically.
          </p>
          
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-8 items-center justify-items-center opacity-80 hover:opacity-100 transition-all duration-500">
            {integrations.map((logo) => (
              <div key={logo.name} className="flex flex-col items-center gap-3 transition-transform hover:scale-110">
                <div className="h-10 flex items-center justify-center">
                  <Image src={logo.src} alt={logo.name} width={40} height={40} className={`max-h-full object-contain ${logo.invert ? 'invert' : ''}`} unoptimized />
                </div>
                <span className="text-[10px] font-medium text-white/50">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ────────────────────────────────────────── */}
      <section id="integrations" className="w-full py-24 border-t border-white/10 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Communication Platforms</h2>
          <p className="text-white/50 mb-12 max-w-2xl mx-auto">
            Supports direct continuous deployment to the communication platforms you already use.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 items-center justify-items-center opacity-80 hover:opacity-100 transition-all duration-500">
             {platforms.map((logo) => (
              <div key={logo.name} className="flex flex-col items-center gap-3 transition-transform hover:scale-110 flex-shrink-0">
                <div className="h-10 flex items-center justify-center">
                  <Image src={logo.src} alt={logo.name} width={40} height={40} className={`max-h-full object-contain ${logo.invert ? 'invert' : ''}`} unoptimized />
                </div>
                <span className="text-[10px] font-medium text-white/50">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      
    </div>
  );
}
