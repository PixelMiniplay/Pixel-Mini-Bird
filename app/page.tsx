import React from 'react';
import FlappyBirdGame from '@/components/FlappyBirdGame';

export default function Home() {
  return (
    <main className="w-full min-h-screen flex flex-col justify-between bg-[#70c5ce] font-sans relative overflow-hidden select-none" id="arcade-terminal-root">
      {/* Decorative clouds background for the outer layout */}
      <div className="absolute top-20 left-10 w-24 h-12 bg-white/30 rounded-full blur-xs pointer-events-none" />
      <div className="absolute top-40 right-20 w-32 h-16 bg-white/20 rounded-full blur-xs pointer-events-none" />
      <div className="absolute top-10 right-48 w-20 h-10 bg-white/10 rounded-full blur-xs pointer-events-none" />
      
      {/* Top minimalistic status navigation */}
      <nav className="w-full border-b-4 border-[#5a4d41] bg-[#ded895] py-3.5 px-6 flex items-center justify-between z-20 relative font-bold text-[#5a4d41]" id="navbar-accent">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#73bf2e] border-2 border-[#5a4d41] animate-pulse" />
          <span className="text-xs tracking-widest font-black uppercase">CABINET_LIVE_ONLINE</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-black">
          <span>UTC TIME: 12:28:22</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">LOC: SYSTEM_ASIA</span>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-grow flex items-center justify-center relative z-10 w-full col-span-1 p-2">
        <FlappyBirdGame />
      </div>

      {/* Footer Details */}
      <footer className="w-full border-t-4 border-[#5a4d41] bg-[#ded895] py-4 text-center z-10 text-[#5a4d41] font-black" id="footer-accent">
        <p className="text-[10px] tracking-widest uppercase">
          ARCADE CONTROLS SECURE PROTOCOL // POWERED BY NEXT.JS & RETRO VIBRANT SYSTEM
        </p>
      </footer>
    </main>
  );
}
