"use client";

import React from "react";

export default function DotBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-black">
      {/* Dot Grid Pattern Layer */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1.5px, transparent 1.5px)`,
          backgroundSize: '32px 32px',
        }}
      >
        {/* Radial mask to fade out the dots towards the edges, giving a focused spotlight effect */}
        <div className="absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,transparent_10%,black_100%)]" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
