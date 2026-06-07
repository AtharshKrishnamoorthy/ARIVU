"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden flex items-center">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-white/70 hover:text-white">
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 w-48 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col py-2 z-50"
          >
            <Link onClick={() => setIsOpen(false)} href="/#features" className="px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">Features</Link>
            <Link onClick={() => setIsOpen(false)} href="/#integrations" className="px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">Integrations</Link>
            <Link onClick={() => setIsOpen(false)} href="https://pypi.org/project/arivu-ai/" target="_blank" className="px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">SDK</Link>
            <Link onClick={() => setIsOpen(false)} href="https://arivu.mintlify.app/" target="_blank" className="px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">Docs</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
