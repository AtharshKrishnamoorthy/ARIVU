"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { Database, BrainCircuit, Sparkles, Activity } from "lucide-react";

const steps = [
    { num: "01", title: "Connect Your Database", desc: "Link PostgreSQL, MySQL, SQLite, Databricks, or Snowflake in seconds. Arivu securely maps your schema, relationships, and metadata automatically.", img: "/arivu-db.png", icon: Database, color: "text-blue-400", bg: "bg-blue-500/10", glow: "rgba(59,130,246,0.15)" },
    { num: "02", title: "Configure the Intelligent Engine", desc: "Select from top-tier models like OpenAI, Anthropic, or run local open-source models via Ollama. Customize prompts and set up your agentic pipeline.", img: "/arivu-models.png", icon: BrainCircuit, color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "rgba(16,185,129,0.15)" },
    { num: "03", title: "Query with Natural Language", desc: "Ask questions naturally. The agent generates SQL, executes it safely, and renders beautiful charts and data tables instantly in the chat interface.", img: "/arivu-chat-dash.png", icon: Sparkles, color: "text-purple-400", bg: "bg-purple-500/10", glow: "rgba(168,85,247,0.15)" },
    { num: "04", title: "Deploy, Automate & Monitor", desc: "Connect to Slack, Discord, or schedule automated email reports. Monitor all pipeline traces, SQL syntax, and performance in real-time.", img: "/arivu-sessions.png", icon: Activity, color: "text-orange-400", bg: "bg-orange-500/10", glow: "rgba(249,115,22,0.15)" }
];

function StepCard({ step, i }: { step: typeof steps[0], i: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const Icon = step.icon;

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const imageY = useTransform(scrollYProgress, [0, 1], [30, -30]);
    const smoothImageY = useSpring(imageY, { stiffness: 60, damping: 20 });

    const glowOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

    return (
        <motion.div
            ref={ref}
            className="sticky w-full min-h-[65vh] xl:min-h-[70vh] rounded-[2rem] border border-white/10 bg-[#080808] p-6 md:p-12 shadow-[0_-30px_60px_-10px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden"
            style={{ top: `calc(100px + ${i * 24}px)` }}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.05 }}
        >
            {/* ambient glow that follows scroll */}
            <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse 60% 50% at 70% 50%, ${step.glow}, transparent)`,
                    opacity: glowOpacity,
                }}
            />

            {/* Left content */}
            <div className="flex-1 space-y-4 z-10">
                <motion.div
                    className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${step.bg} ${step.color}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 + i * 0.05 }}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                >
                    <Icon className="h-7 w-7" />
                </motion.div>

                <div className="space-y-3">
                    <motion.span
                        className="text-5xl md:text-7xl font-black text-white/5 block -mb-2 md:-mb-4 tracking-tight"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.15 + i * 0.05 }}
                    >
                        {step.num}
                    </motion.span>

                    <motion.h3
                        className="text-xl md:text-3xl font-bold leading-tight relative"
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, ease: "easeOut", delay: 0.2 + i * 0.05 }}
                    >
                        {step.title}
                    </motion.h3>

                    <motion.p
                        className="text-sm md:text-base text-white/60 leading-relaxed max-w-xs relative"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, ease: "easeOut", delay: 0.28 + i * 0.05 }}
                    >
                        {step.desc}
                    </motion.p>
                </div>
            </div>

            {/* Right image */}
            <motion.div
                className="flex-[1.4] w-full aspect-video relative rounded-2xl border border-white/10 overflow-hidden bg-black/50 group"
                initial={{ opacity: 0, x: 40, scale: 0.97 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 + i * 0.05 }}
                whileHover={{ scale: 1.015 }}
            >
                <div className={`absolute inset-0 opacity-20 transition-opacity duration-700 group-hover:opacity-40 blur-3xl ${step.bg}`} />

                {/* Subtle shimmer on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-20 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent" />

                <motion.div className="w-full h-full" style={{ y: smoothImageY }}>
                    <Image
                        src={step.img}
                        alt={step.title}
                        fill
                        className="object-cover object-top rounded-2xl relative z-10"
                    />
                </motion.div>
            </motion.div>
        </motion.div>
    );
}

export default function HowItWorks() {
    return (
        <section id="workflow" className="w-full py-32 px-4 sm:px-6 relative z-10">
            <div className="max-w-6xl mx-auto text-center mb-24">
                <motion.h2
                    className="text-3xl md:text-5xl font-bold tracking-tight mb-6"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                >
                    How Arivu Works
                </motion.h2>
                <motion.p
                    className="text-white/50 max-w-2xl mx-auto text-lg"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                >
                    From raw database connections to fully automated insights in four simple steps.
                </motion.p>
            </div>

            <div className="max-w-5xl mx-auto flex flex-col gap-8 md:gap-12 relative pb-32">
                {steps.map((step, i) => (
                    <StepCard key={step.num} step={step} i={i} />
                ))}
            </div>
        </section>
    );
}