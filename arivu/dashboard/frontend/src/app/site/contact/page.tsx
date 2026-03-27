"use client";

import Link from "next/link";
import { Send, Mail, MapPin } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">Contact Us</h1>
        <p className="text-white/50 text-lg max-w-xl mx-auto">
          Interested in enterprise support, contributing, or just want to say hello? Reach out to the Arivu team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
        {/* Contact info */}
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Get in touch</h3>
            <p className="text-white/60">We operate globally and typically respond within 24 hours to all inquiries.</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                <Mail className="h-5 w-5 text-white/80" />
              </div>
              <div>
                <p className="font-medium text-white">Email</p>
                <p className="text-white/50">hello@arivu.io</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                <MapPin className="h-5 w-5 text-white/80" />
              </div>
              <div>
                <p className="font-medium text-white">Location</p>
                <p className="text-white/50">San Francisco, CA<br/>Remote First</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-sm">
          <form className="space-y-4 relative z-10" onSubmit={e => e.preventDefault()}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70">First Name</label>
                <input 
                  type="text" 
                  className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                  placeholder="John"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70">Last Name</label>
                <input 
                  type="text" 
                  className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70">Work Email</label>
              <input 
                type="email" 
                className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                placeholder="john@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70">Message</label>
              <textarea 
                rows={4}
                className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
                placeholder="How can we help?"
              />
            </div>

            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 rounded-md font-semibold mt-4 transition-all hover:bg-white/90 active:scale-[0.98]"
            >
              Send Message
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
      
      <div className="mt-16 pt-8 border-t border-white/10 text-center">
        <Link href="/site" className="text-sm font-medium text-white hover:underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
