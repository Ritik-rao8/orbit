"use client";

import React, { useState, useEffect, useRef } from "react";
import { Share2, LogIn, Clock, Sparkles } from "lucide-react";

// Path coordinates inside the phone's 370x500 mock screen space
const PATH_YOU = [
  [120, 160],
  [140, 200],
  [180, 210],
  [210, 260],
  [250, 280],
  [290, 260]
];

const PATH_SARAH = [
  [310, 240],
  [280, 280],
  [220, 290],
  [180, 340],
  [150, 360],
  [120, 340]
];

const PATH_ALEX = [
  [160, 340],
  [190, 300],
  [220, 260],
  [250, 220],
  [230, 180],
  [190, 140]
];

export default function PhoneMockup() {
  const containerRef = useRef(null);
  
  // Parallax rotation states
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Animation progress state for moving markers (0 to 1)
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  // Interpolate coordinate points along paths
  const getInterpolatedPoint = (path, t) => {
    const index = t * (path.length - 1);
    const i = Math.floor(index);
    const f = index - i;
    if (i >= path.length - 1) return path[path.length - 1];
    const p1 = path[i];
    const p2 = path[i + 1];
    return [
      p1[0] + (p2[0] - p1[0]) * f,
      p1[1] + (p2[1] - p1[1]) * f
    ];
  };

  // Loop position updates for markers
  useEffect(() => {
    let animId;
    const tick = () => {
      progressRef.current += 0.003;
      // Smooth continuous ping-pong oscillation
      const oscillation = 0.5 + 0.5 * Math.sin(progressRef.current);
      setProgress(oscillation);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Handle mouse moves for 3D parallax tilt
  const handleMouseMove = (e) => {
    const card = containerRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Calculate mouse position relative to card center (normalized to -0.5 to 0.5)
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;

    // Map mouse position to degree rotation limits (max X tilt: 12deg, max Y tilt: 15deg)
    const rotX = -(mouseY / (height / 2)) * 12;
    const rotY = (mouseX / (width / 2)) * 15;

    setRotateX(rotX);
    setRotateY(rotY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Smoothly reset tilt back to zero
    setRotateX(0);
    setRotateY(0);
  };

  // Compute animated positions
  const posYou = getInterpolatedPoint(PATH_YOU, progress);
  const posSarah = getInterpolatedPoint(PATH_SARAH, progress);
  const posAlex = getInterpolatedPoint(PATH_ALEX, progress);

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center w-full max-w-[390px] h-[750px] cursor-pointer"
      style={{
        perspective: "1000px"
      }}
    >
      {/* 1. Ambient Background Glow behind phone (tilts slightly out of sync for depth) */}
      <div 
        className="absolute w-[280px] h-[480px] bg-[#4F9CF9]/10 rounded-full filter blur-[90px] pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${rotateY * 1.5}px, ${-rotateX * 1.5}px, -50px)`,
          zIndex: -1
        }}
      />

      {/* 2. Phone Wrapper Container */}
      <div 
        className="w-full h-full bg-[#0A0C10] border-[8px] border-[#252A34] rounded-[48px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9)] relative overflow-hidden flex flex-col select-none"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${isHovered ? 1.025 : 1}, ${isHovered ? 1.025 : 1}, 1)`,
          transformStyle: "preserve-3d",
          transition: isHovered ? "none" : "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)"
        }}
      >
        {/* Dynamic Island Notch */}
        <div className="w-28 h-6 bg-black rounded-2xl absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center border border-white/[0.04]">
          {/* Pulsing Green status tracker beacon inside Dynamic Island */}
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] absolute right-4 animate-pulse" />
        </div>
        
        {/* Status Bar */}
        <div className="h-10 w-full px-7 flex items-center justify-between text-[10px] font-semibold text-white/30 absolute top-0 left-0 z-40 select-none pointer-events-none">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <div className="w-5 h-2.5 border border-white/20 rounded-md p-[1px] flex items-center">
              <div className="w-3.5 h-full bg-white/60 rounded-[2px]" />
            </div>
          </div>
        </div>

        {/* Screen/Map Container */}
        <div className="flex-1 bg-[#12151B] relative overflow-hidden flex flex-col pt-10">
          
          {/* Animated SVG Map Grid */}
          <svg className="absolute inset-0 w-full h-full text-white/5 opacity-80 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="phone-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#phone-grid)" />

            {/* Stylized dark map roads */}
            <path d="M-50 180 L450 180" fill="none" stroke="#252A34" strokeWidth="14" />
            <path d="M-50 180 L450 180" fill="none" stroke="#1C2029" strokeWidth="10" />
            
            <path d="M140 -50 L140 800" fill="none" stroke="#252A34" strokeWidth="14" />
            <path d="M140 -50 L140 800" fill="none" stroke="#1C2029" strokeWidth="10" />

            <path d="M260 -50 L260 800" fill="none" stroke="#252A34" strokeWidth="8" />
            <path d="M260 -50 L260 800" fill="none" stroke="#1C2029" strokeWidth="5" />

            <path d="M-50 380 Q 200 300 450 380" fill="none" stroke="#252A34" strokeWidth="12" />
            <path d="M-50 380 Q 200 300 450 380" fill="none" stroke="#1C2029" strokeWidth="8" />

            {/* Landmark City Park */}
            <rect x="180" y="40" width="160" height="100" rx="16" fill="#1C2A24" opacity="0.3" />
            <text x="260" y="95" fill="#00E5A0" fillOpacity="0.2" fontSize="9" fontWeight="bold" textAnchor="middle">GOLDEN GATE PARK</text>
            
            {/* Coordinates trail lines for participants */}
            <path d="M120 160 L140 200 L180 210 L210 260 L250 280 L290 260" fill="none" stroke="#4F9CF9" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
            <path d="M310 240 L280 280 L220 290 L180 340 L150 360 L120 340" fill="none" stroke="#00E5A0" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
          </svg>

          {/* Floating Header Card (Glassmorphic) */}
          <div className="absolute top-4 left-4 right-4 z-40 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-2xl p-3 flex items-center justify-between shadow-lg pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00E5A0] animate-ping" />
              <div className="text-left">
                <h4 className="text-[10px] font-bold tracking-wide text-white uppercase leading-none">Weekend peak hike</h4>
                <span className="text-[8px] text-[#A1A7B3] leading-none mt-0.5 block">3 active now</span>
              </div>
            </div>
            <div className="text-[9px] font-mono bg-white/[0.08] px-2 py-0.5 rounded text-[#4F9CF9] border border-white/[0.05]">
              05:48:12
            </div>
          </div>

          {/* Animated Location Markers */}
          {/* 1. YOU Marker */}
          <div 
            className="absolute z-30 flex flex-col items-center pointer-events-none transition-all duration-75 ease-linear"
            style={{ left: `${posYou[0]}px`, top: `${posYou[1]}px`, transform: "translate(-50%, -50%)" }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-8 w-8 rounded-full bg-[#4F9CF9]/20 animate-ping opacity-60" />
              <div className="w-7 h-7 rounded-full bg-[#4F9CF9] border-2 border-[#12151B] flex items-center justify-center text-[9px] font-black text-white shadow-lg shadow-[#4F9CF9]/20">
                ME
              </div>
            </div>
            <div className="mt-0.5 bg-black/85 px-1.5 py-0.5 rounded border border-white/5">
              <span className="text-[8px] font-bold text-white leading-none">You</span>
            </div>
          </div>

          {/* 2. SARAH Marker */}
          <div 
            className="absolute z-30 flex flex-col items-center pointer-events-none transition-all duration-75 ease-linear"
            style={{ left: `${posSarah[0]}px`, top: `${posSarah[1]}px`, transform: "translate(-50%, -50%)" }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-8 w-8 rounded-full bg-[#00E5A0]/20 animate-ping opacity-60" style={{ animationDelay: "0.4s" }} />
              <div className="w-7 h-7 rounded-full bg-[#00E5A0] border-2 border-[#12151B] flex items-center justify-center text-[9px] font-black text-black shadow-lg shadow-[#00E5A0]/10">
                SR
              </div>
            </div>
            <div className="mt-0.5 bg-black/85 px-1.5 py-0.5 rounded border border-white/5">
              <span className="text-[8px] font-bold text-white leading-none">Sarah</span>
            </div>
          </div>

          {/* 3. ALEX Marker */}
          <div 
            className="absolute z-30 flex flex-col items-center pointer-events-none transition-all duration-75 ease-linear"
            style={{ left: `${posAlex[0]}px`, top: `${posAlex[1]}px`, transform: "translate(-50%, -50%)" }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-8 w-8 rounded-full bg-white/10 animate-ping opacity-40" style={{ animationDelay: "0.8s" }} />
              <div className="w-7 h-7 rounded-full bg-[#171A20] border-2 border-[#12151B] flex items-center justify-center text-[9px] font-black text-white shadow-lg border-white/5">
                AX
              </div>
            </div>
            <div className="mt-0.5 bg-black/85 px-1.5 py-0.5 rounded border border-white/5">
              <span className="text-[8px] font-bold text-white leading-none">Alex</span>
            </div>
          </div>

          {/* Bottom Sheet Card Simulation */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/[0.04] backdrop-blur-lg border border-white/[0.08] rounded-[24px] p-3.5 flex flex-col shadow-2xl z-40 pointer-events-none">
            {/* Grab Handle */}
            <div className="w-8 h-1 bg-white/20 rounded-full mx-auto mb-2" />
            
            <div className="flex items-center justify-between mb-2">
              <div className="text-left">
                <h3 className="text-xs font-bold text-white leading-none">Event tracking</h3>
                <span className="text-[8px] text-[#A1A7B3] mt-1 block leading-none">Expires in 5 hours</span>
              </div>
              <span className="text-[8px] font-bold text-[#00E5A0] flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00E5A0]/10 border border-[#00E5A0]/10">
                <span className="w-1 h-1 rounded-full bg-[#00E5A0]" />
                Live Map
              </span>
            </div>

            <div className="h-[1px] bg-white/5 mb-2.5" />

            {/* Simulated Replay Slider timeline bar (loops with marker progress) */}
            <div className="w-full flex flex-col gap-1 mb-2.5">
              <div className="flex items-center justify-between text-[8px] font-bold text-[#A1A7B3]">
                <span>Replay Mode</span>
                <span className="font-mono text-[#4F9CF9]">{Math.floor(progress * 60)}m 00s</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#4F9CF9] rounded-full transition-all duration-75 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            {/* List of active participants */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-[#4F9CF9] border border-[#171A20] flex items-center justify-center text-[8px] font-bold">ME</div>
                <div className="w-6 h-6 rounded-full bg-[#00E5A0] border border-[#171A20] flex items-center justify-center text-[8px] font-bold text-black">SR</div>
                <div className="w-6 h-6 rounded-full bg-[#171A20] border border-[#171A20] flex items-center justify-center text-[8px] font-bold border-white/5">AX</div>
              </div>
              <span className="text-[9px] text-[#A1A7B3] font-semibold">3 active trackers</span>
            </div>

            {/* simulated button */}
            <button className="mt-3 w-full bg-white/10 text-xs font-semibold py-2 rounded-xl border border-white/5 flex items-center justify-center gap-1 text-white">
              <Share2 className="w-3 h-3 text-[#4F9CF9]" />
              <span>Invite Friends</span>
            </button>
          </div>

        </div>

        {/* 3. Glass Glare / Shifting Reflection overlay inside phone */}
        <div 
          className="absolute inset-0 pointer-events-none transition-transform duration-300 ease-out z-50 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent"
          style={{
            transform: `translate3d(${-rotateY * 4}px, ${-rotateX * 4}px, 0) scale(1.5)`
          }}
        />
      </div>
    </div>
  );
}
