"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { io } from "socket.io-client";
import { 
  Play, 
  Pause, 
  Plus, 
  Share2, 
  MapPin, 
  Clock, 
  Users, 
  Copy, 
  Check, 
  ChevronRight, 
  ChevronDown,
  X, 
  Sparkles,
  ArrowRight,
  RotateCcw,
  LogIn
} from "lucide-react";

// Dynamic import for PhoneMockup to prevent SSR errors
const PhoneMockup = dynamic(() => import("./components/PhoneMockup"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#4F9CF9]/30 border-t-[#4F9CF9] rounded-full animate-spin" />
    </div>
  )
});

// Mock coordinates for participant paths (for replay showcase)
const ALEX_PATH = [
  [60, 80],
  [90, 100],
  [140, 110],
  [180, 160],
  [220, 180],
  [280, 160]
];

const SARAH_PATH = [
  [300, 70],
  [280, 110],
  [240, 130],
  [200, 150],
  [180, 200],
  [150, 250]
];

const YOU_PATH = [
  [80, 260],
  [110, 230],
  [150, 220],
  [170, 170],
  [200, 120],
  [230, 90]
];

// Helper to interpolate points along a 2D path
const getInterpolatedPoint = (path, t) => {
  if (!path || path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return { x: path[0][0], y: path[0][1] };
  
  const totalSegments = path.length - 1;
  const rawIndex = t * totalSegments;
  const segment = Math.min(Math.floor(rawIndex), totalSegments - 1);
  const segmentT = rawIndex - segment;
  
  const p1 = path[segment];
  const p2 = path[segment + 1];
  
  return {
    x: p1[0] + (p2[0] - p1[0]) * segmentT,
    y: p1[1] + (p2[1] - p1[1]) * segmentT
  };
};

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export default function Home() {
  const router = useRouter();
  const socketRef = useRef(null);

  // --- Create Room Simulation State ---
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomStep, setRoomStep] = useState(-1); // -1: configure, 0: loading, 1: completed
  const [generatedRoomId, setGeneratedRoomId] = useState("");
  const [copied, setCopied] = useState(false);
  const [roomName, setRoomName] = useState("Live Room");
  const [durationHours, setDurationHours] = useState(6);

  // --- Join Room State ---
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  // --- Replay Showcase State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0.3); // Starts at 30% for visual layout
  const replayIntervalRef = useRef(null);

  const startReplay = () => {
    setIsPlaying(true);
    if (replayProgress >= 1) {
      setReplayProgress(0);
    }
  };

  const pauseReplay = () => {
    setIsPlaying(false);
  };

  const handleSliderChange = (e) => {
    setReplayProgress(parseFloat(e.target.value));
  };

  useEffect(() => {
    if (isPlaying) {
      replayIntervalRef.current = setInterval(() => {
        setReplayProgress((prev) => {
          if (prev >= 1) {
            setIsPlaying(false);
            return 1;
          }
          return prev + 0.005; // Smooth incremental step
        });
      }, 16); // ~60fps
    } else {
      clearInterval(replayIntervalRef.current);
    }

    return () => clearInterval(replayIntervalRef.current);
  }, [isPlaying]);

  // Connect socket lazily (only when needed)
  const getSocket = () => {
    if (!socketRef.current || !socketRef.current.connected) {
      socketRef.current = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
      });
    }
    return socketRef.current;
  };

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Open create room modal configuration
  const triggerCreateRoom = () => {
    setIsCreatingRoom(true);
    setRoomStep(-1);
    setRoomName("Live Room");
    setDurationHours(6);
    setCopied(false);
  };

  // Perform the actual room creation
  const executeCreateRoom = () => {
    setRoomStep(0);
    const socket = getSocket();
    const payload = { roomName: roomName.trim() || "Live Room", durationHours };

    const handleResponse = (response) => {
      if (response.success) {
        setGeneratedRoomId(response.roomId.toUpperCase());
        setRoomStep(1);
      }
    };

    if (socket.connected) {
      socket.emit("create-room", payload, handleResponse);
    } else {
      socket.once("connect", () => {
        socket.emit("create-room", payload, handleResponse);
      });
      socket.connect();
    }
  };

  const copyToClipboard = () => {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/room/${generatedRoomId.toLowerCase()}`
      : `https://pingme.app/room/${generatedRoomId.toLowerCase()}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Join Room action — validate room exists first
  const handleJoinRoom = async () => {
    const code = joinCode.trim().toLowerCase();
    if (!code || code.length < 3) {
      setJoinError("Enter a valid room code.");
      setTimeout(() => setJoinError(""), 3000);
      return;
    }

    try {
      const res = await fetch(`${SOCKET_URL}/api/room/${code}`);
      const data = await res.json();
      if (data.exists) {
        router.push(`/room/${code}`);
      } else {
        setJoinError(data.message || "Room not found.");
        setTimeout(() => setJoinError(""), 3000);
      }
    } catch {
      // If server is unreachable, still allow navigation (room page will show error)
      router.push(`/room/${code}`);
    }
  };

  // Coordinates for the animated replay markers based on slider progress
  const alexPos = getInterpolatedPoint(ALEX_PATH, replayProgress);
  const sarahPos = getInterpolatedPoint(SARAH_PATH, replayProgress);
  const youPos = getInterpolatedPoint(YOU_PATH, replayProgress);

  return (
    <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center selection:bg-[#4F9CF9]/30 selection:text-white">
      
      {/* 1. NAVBAR */}
      <nav className="w-full fixed top-0 z-50 bg-[#0F1115]/80 backdrop-blur-md border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Minimal Logo */}
            <div className="w-8 h-8 rounded-xl bg-[#4F9CF9] flex items-center justify-center shadow-lg shadow-[#4F9CF9]/20">
              <span className="font-sans font-bold text-sm text-white tracking-tighter">O</span>
            </div>
            <span className="font-[var(--font-deltha)] text-xl tracking-wider text-white">Orbit</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00E5A0]/15 text-[#00E5A0] border border-[#00E5A0]/15 ml-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A0]"></span>
              LIVE
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#A1A7B3]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#replay" className="hover:text-white transition-colors">Replay Mode</a>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={triggerCreateRoom}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-[#4F9CF9] hover:bg-[#68AFFF] active:scale-[0.98] text-white shadow-md shadow-[#4F9CF9]/10 transition-all"
            >
              Create Room
            </button>
            <button 
              onClick={() => document.getElementById('join-input')?.focus()}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] text-white transition-all hidden sm:block"
            >
              Join Room
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="w-full max-w-7xl px-6 pt-32 flex flex-col items-center">

        {/* 2. HERO SECTION */}
        <section className="w-full flex flex-col lg:flex-row items-center justify-between gap-16 pb-24 lg:py-20">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl">
            {/* Pill label */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.05] text-[#4F9CF9] mb-8"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-gen live tracking web app</span>
            </motion.div>

            {/* Headline */}
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] text-white"
            >
              Stay together. <br />
              <span className="text-[#4F9CF9]">Move freely.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-lg text-[#A1A7B3] max-w-md animate-fade-in"
            >
              Create a room, share a link, and see everyone live.
            </motion.p>

            {/* CTA buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex flex-col items-center lg:items-start gap-6 w-full"
            >
              {/* Primary & Secondary CTA Row */}
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <button 
                  onClick={triggerCreateRoom}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#4F9CF9] hover:bg-[#68AFFF] active:scale-[0.97] text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#4F9CF9]/20 transition-all text-base"
                >
                  <Plus className="w-5 h-5" />
                  <span>Create Room</span>
                </button>
                
                <a 
                  href="#replay"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.97] text-white font-semibold flex items-center justify-center gap-2 transition-all text-base text-center"
                >
                  <Play className="w-4 h-4 text-[#4F9CF9]" />
                  <span>Watch Replay</span>
                </a>
              </div>

              {/* Join Room Input Flow (Sleek separate row) */}
              <div className="flex flex-col items-center lg:items-start gap-2.5 w-full max-w-sm">
                <span className="text-[10px] font-bold tracking-wider text-[#A1A7B3] uppercase">Have a passcode? Join Room</span>
                <div className="relative flex items-center w-full">
                  <input
                    id="join-input"
                    type="text"
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                    placeholder="Enter 8-character code"
                    className="w-full pl-4 pr-3 py-3 rounded-l-2xl bg-[#171A20] border border-white/[0.06] border-r-0 text-sm text-white placeholder:text-[#A1A7B3]/60 focus:outline-none focus:border-[#4F9CF9]/40 transition-colors font-mono tracking-wider"
                  />
                  <button
                    onClick={handleJoinRoom}
                    className="px-6 py-3 rounded-r-2xl bg-[#171A20] border border-white/[0.06] border-l-0 text-white hover:bg-[#1E222A] active:scale-[0.98] transition-all flex items-center gap-1.5 font-semibold text-sm"
                  >
                    <LogIn className="w-4 h-4 text-[#4F9CF9]" />
                    <span>Join</span>
                  </button>
                </div>
                {/* Join error message */}
                {joinError && (
                  <span className="text-xs text-red-400 font-medium">{joinError}</span>
                )}
              </div>

              <div className="text-xs text-[#A1A7B3] font-medium select-none py-2 px-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                No signup required. Private coordination.
              </div>
            </motion.div>
          </div>

          {/* Premium 3D Phone Mockup Section */}
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex items-center justify-center w-full"
          >
            <PhoneMockup />
          </motion.div>
        </section>

        {/* 3. HOW IT WORKS */}
        <section id="how-it-works" className="w-full py-24 border-t border-white/[0.03]">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white">How It Works</h2>
            <p className="mt-4 text-[#A1A7B3]">Three simple steps to connect in real time. Completely browser-based, no app store download required.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-[#171A20] border border-white/[0.03] p-8 rounded-[28px] relative overflow-hidden group hover:border-white/6 transition-all text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#4F9CF9]/10 border border-[#4F9CF9]/20 flex items-center justify-center text-[#4F9CF9] mb-6">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">1. Create Room</h3>
              <p className="text-sm text-[#A1A7B3] leading-relaxed">
                Generate a temporary link. Set your event description and select your room expiration limit.
              </p>
              <div className="absolute top-6 right-6 text-sm font-mono text-white/5 font-black group-hover:text-[#4F9CF9]/10 transition-colors">01</div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#171A20] border border-white/[0.03] p-8 rounded-[28px] relative overflow-hidden group hover:border-white/[0.06] transition-all text-left">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white mb-6">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">2. Share Link</h3>
              <p className="text-sm text-[#A1A7B3] leading-relaxed">
                Send the generated room URL via text, WhatsApp, or email. Your friends tap to open in any mobile browser instantly.
              </p>
              <div className="absolute top-6 right-6 text-sm font-mono text-white/5 font-black group-hover:text-[#4F9CF9]/10 transition-colors">02</div>
            </div>

            {/* Step 3 */}
            <div className="bg-[#171A20] border border-white/[0.03] p-8 rounded-[28px] relative overflow-hidden group hover:border-white/[0.06] transition-all text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#00E5A0]/10 border border-[#00E5A0]/20 flex items-center justify-center text-[#00E5A0] mb-6">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">3. Track Live</h3>
              <p className="text-sm text-[#A1A7B3] leading-relaxed">
                See everyone real-time on a unified map. Easily navigate to each other&apos;s pin coordinates on the go.
              </p>
              <div className="absolute top-6 right-6 text-sm font-mono text-white/5 font-black group-hover:text-[#4F9CF9]/10 transition-colors">03</div>
            </div>
          </div>
        </section>

        {/* 4. FEATURE HIGHLIGHTS */}
        <section id="features" className="w-full py-24 border-t border-white/[0.03]">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white">Built for instant coordinate sync</h2>
            <p className="mt-4 text-[#A1A7B3] text-sm">Designed with high-accuracy updates and absolute visual privacy in mind.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-[#171A20] border border-white/[0.03] p-8 rounded-[32px] flex flex-col justify-between h-[240px] hover:border-white/[0.06] transition-all text-left">
              <div className="w-10 h-10 rounded-xl bg-[#4F9CF9]/10 border border-[#4F9CF9]/20 flex items-center justify-center text-[#4F9CF9]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Real-Time Tracking</h3>
                <p className="text-xs text-[#A1A7B3] leading-relaxed">
                  Sub-second location latency updates keep avatars sliding smoothly across the map layout without lag.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#171A20] border border-white/[0.03] p-8 rounded-[32px] flex flex-col justify-between h-[240px] hover:border-white/[0.06] transition-all text-left">
              <div className="w-10 h-10 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/20 flex items-center justify-center text-[#00E5A0]">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Temporary Event Rooms</h3>
                <p className="text-xs text-[#A1A7B3] leading-relaxed">
                  Rooms and location data automatically self-destruct once your selected session expires. Complete privacy controls.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#171A20] border border-white/[0.03] p-8 rounded-[32px] flex flex-col justify-between h-[240px] hover:border-white/[0.06] transition-all text-left">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Event Replay</h3>
                <p className="text-xs text-[#A1A7B3] leading-relaxed">
                  Save event routes to your secure personal account. Replay movement paths like a video player timeline.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. REPLAY SHOWCASE */}
        <section id="replay" className="w-full py-24 border-t border-white/[0.03] flex flex-col items-center">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-white">Replay the entire event.</h2>
            <p className="mt-4 text-[#A1A7B3]">
              Select any event path from your dashboard history to view participant steps, timestamps, and movements.
            </p>
          </div>

          {/* Interactive Replay Player UI */}
          <div className="w-full max-w-3xl bg-[#171A20] border border-white/[0.04] rounded-[32px] overflow-hidden shadow-2xl relative">
            
            {/* Map Frame */}
            <div className="w-full aspect-[16/9] bg-[#12151B] relative overflow-hidden flex items-center justify-center">
              
              {/* Map SVG */}
              <svg className="absolute inset-0 w-full h-full text-white/5 opacity-80" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="replay-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#replay-grid)" />

                {/* Minimal Map Paths (Forest/Park Trails) */}
                {/* Alex Route (Dashed line) */}
                <path d="M 60 80 Q 75 90 90 100 T 140 110 T 180 160 T 220 180 T 280 160" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 4" opacity="0.1" />
                <path d="M 60 80 Q 75 90 90 100 T 140 110 T 180 160 T 220 180 T 280 160" fill="none" stroke="#4F9CF9" strokeWidth="1.5" opacity={replayProgress > 0.05 ? 0.4 : 0.05} />

                {/* Sarah Route */}
                <path d="M 300 70 Q 290 90 280 110 T 240 130 T 200 150 T 180 200 T 150 250" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 4" opacity="0.1" />
                <path d="M 300 70 Q 290 90 280 110 T 240 130 T 200 150 T 180 200 T 150 250" fill="none" stroke="#00E5A0" strokeWidth="1.5" opacity={replayProgress > 0.05 ? 0.4 : 0.05} />

                {/* Your Route */}
                <path d="M 80 260 Q 95 245 110 230 T 150 220 T 170 170 T 200 120 T 230 90" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 4" opacity="0.1" />
                <path d="M 80 260 Q 95 245 110 230 T 150 220 T 170 170 T 200 120 T 230 90" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={replayProgress > 0.05 ? 0.4 : 0.05} />

                {/* Map Landmarks */}
                <circle cx="180" cy="160" r="16" fill="#1C2A24" opacity="0.5" />
                <text x="180" y="163" fill="#00E5A0" fontSize="7" fontWeight="bold" textAnchor="middle">CAMP A</text>

                <circle cx="230" cy="90" r="16" fill="#202530" opacity="0.5" />
                <text x="230" y="93" fill="#4F9CF9" fontSize="7" fontWeight="bold" textAnchor="middle">PEAK</text>
              </svg>

              {/* Animated Path Avatars (placed coordinates computed in state) */}
              {/* You Marker */}
              <motion.div 
                className="absolute z-20"
                style={{ 
                  left: `${(youPos.x / 400) * 100}%`,
                  top: `${(youPos.y / 320) * 100}%`,
                  translateX: "-50%",
                  translateY: "-50%"
                }}
              >
                <div className="w-8 h-8 rounded-full bg-white border border-black shadow-md flex items-center justify-center font-bold text-[9px] text-[#000]">
                  ME
                </div>
              </motion.div>

              {/* Alex Marker */}
              <motion.div 
                className="absolute z-20"
                style={{ 
                  left: `${(alexPos.x / 400) * 100}%`,
                  top: `${(alexPos.y / 320) * 100}%`,
                  translateX: "-50%",
                  translateY: "-50%"
                }}
              >
                <div className="w-8 h-8 rounded-full bg-[#4F9CF9] border border-black shadow-md flex items-center justify-center font-bold text-[9px] text-white">
                  AX
                </div>
              </motion.div>

              {/* Sarah Marker */}
              <motion.div 
                className="absolute z-20"
                style={{ 
                  left: `${(sarahPos.x / 400) * 100}%`,
                  top: `${(sarahPos.y / 320) * 100}%`,
                  translateX: "-50%",
                  translateY: "-50%"
                }}
              >
                <div className="w-8 h-8 rounded-full bg-[#00E5A0] border border-black shadow-md flex items-center justify-center font-bold text-[9px] text-black">
                  SR
                </div>
              </motion.div>

              {/* Watermark Label */}
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-1.5">
                <span className="text-[10px] text-white/60 font-bold">REPLAY PANEL</span>
              </div>
            </div>

            {/* Playback Controls Footer (Glassmorphism layout) */}
            <div className="p-6 bg-[#171A20] border-t border-white/[0.04] flex flex-col md:flex-row items-center gap-6">
              
              <div className="flex items-center gap-4">
                {/* Play/Pause Action */}
                {isPlaying ? (
                  <button 
                    onClick={pauseReplay}
                    className="w-12 h-12 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center transition-colors active:scale-95 shadow-lg shadow-white/5"
                  >
                    <Pause className="w-5 h-5 fill-black" />
                  </button>
                ) : (
                  <button 
                    onClick={startReplay}
                    className="w-12 h-12 rounded-full bg-[#4F9CF9] hover:bg-[#68AFFF] text-white flex items-center justify-center transition-colors active:scale-95 shadow-lg shadow-[#4F9CF9]/10"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                )}

                {/* Reset Progress */}
                <button 
                  onClick={() => { pauseReplay(); setReplayProgress(0); }}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Custom styled slider timeline */}
              <div className="flex-1 w-full flex items-center gap-4">
                <span className="text-[11px] font-mono text-[#A1A7B3] select-none">
                  {Math.floor(replayProgress * 60)}m 00s
                </span>
                
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.001" 
                  value={replayProgress} 
                  onChange={handleSliderChange}
                  className="flex-1 accent-[#4F9CF9] bg-white/10 h-1 rounded-full cursor-pointer appearance-none focus:outline-none"
                />

                <span className="text-[11px] font-mono text-[#A1A7B3] select-none">60m 00s</span>
              </div>
            </div>

          </div>
        </section>

        {/* 6. FINAL CTA */}
        <section className="w-full py-28 flex flex-col items-center justify-center text-center relative overflow-hidden rounded-[40px] bg-linear-to-b from-[#171A20] to-[#0F1115] border border-white/[0.03] mb-20 px-6">
          <div className="absolute w-[300px] h-[300px] bg-[#4F9CF9]/10 rounded-full filter blur-[100px] pointer-events-none -top-20 -z-10" />

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">Ready to start?</h2>
          <p className="text-[#A1A7B3] max-w-sm mb-10 text-sm sm:text-base leading-relaxed">
            Create your event tracking room in seconds. Invite friends instantly. Real-time updates without app download hurdles.
          </p>

          <div className="flex flex-col items-center gap-4 w-full max-w-[280px]">
            <button 
              onClick={triggerCreateRoom}
              className="w-full py-4 px-8 rounded-2xl bg-[#4F9CF9] hover:bg-[#68AFFF] active:scale-[0.98] text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#4F9CF9]/20 transition-all text-base"
            >
              <span>Create Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <span className="text-xs text-[#A1A7B3] font-medium py-1">No app install required.</span>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/[0.03] bg-[#0A0C10] flex items-center justify-center">
        <p className="text-xs text-[#A1A7B3]">© 2026 Orbit app. Built for private coordination.</p>
      </footer>

      {/* SIMULATED CREATE ROOM POPUP CARD */}
      <AnimatePresence>
        {isCreatingRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            {/* Modal Body */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm bg-[#171A20] border border-white/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsCreatingRoom(false)}
                className="absolute top-4 right-4 text-[#A1A7B3] hover:text-white transition-colors w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>

              {roomStep === -1 ? (
                /* Step -1: Configure */
                <div className="py-2 text-left">
                  <div className="w-12 h-12 rounded-2xl bg-[#4F9CF9]/10 border border-[#4F9CF9]/20 flex items-center justify-center text-[#4F9CF9] mb-6 mx-auto">
                    <Clock className="w-6 h-6" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white text-center mb-1">Configure Live Room</h3>
                  <p className="text-xs text-[#A1A7B3] text-center mb-6">Set up your room name and expiration time.</p>

                  <div className="space-y-5">
                    {/* Room Name Input */}
                    <div>
                      <label className="text-[10px] font-bold text-[#A1A7B3] uppercase tracking-wider block mb-2">
                        Room Name
                      </label>
                      <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="e.g. Live Room"
                        maxLength={30}
                        className="w-full px-4 py-3 rounded-xl bg-[#0F1115] border border-white/[0.06] text-sm text-white placeholder:text-[#A1A7B3]/40 focus:outline-none focus:border-[#4F9CF9]/40 transition-colors"
                      />
                    </div>

                    {/* Expiry Selector */}
                    <div>
                      <label className="text-[10px] font-bold text-[#A1A7B3] uppercase tracking-wider block mb-2">
                        Room Expiration Time
                      </label>
                      <div className="relative">
                        <select
                          value={durationHours}
                          onChange={(e) => setDurationHours(Number(e.target.value))}
                          className="w-full px-4 py-3 rounded-xl bg-[#0F1115] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-[#4F9CF9]/40 transition-colors appearance-none cursor-pointer pr-10 font-medium"
                        >
                          <option value={1} className="bg-[#171A20]">1 Hour</option>
                          <option value={2} className="bg-[#171A20]">2 Hours</option>
                          <option value={3} className="bg-[#171A20]">3 Hours</option>
                          <option value={4} className="bg-[#171A20]">4 Hours</option>
                          <option value={6} className="bg-[#171A20]">6 Hours (Default)</option>
                          <option value={8} className="bg-[#171A20]">8 Hours</option>
                          <option value={12} className="bg-[#171A20]">12 Hours</option>
                          <option value={18} className="bg-[#171A20]">18 Hours</option>
                          <option value={24} className="bg-[#171A20]">24 Hours</option>
                          <option value={48} className="bg-[#171A20]">48 Hours (2 days)</option>
                          <option value={72} className="bg-[#171A20]">72 Hours (3 days)</option>
                          <option value={168} className="bg-[#171A20]">168 Hours (1 week)</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#A1A7B3]">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                      <span className="text-[10px] text-[#A1A7B3]/80 block mt-2.5 leading-relaxed">
                        After this time, the room and all live tracking data will be permanently deleted.
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button 
                      onClick={() => setIsCreatingRoom(false)}
                      className="flex-1 py-3 text-xs font-bold rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-white active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={executeCreateRoom}
                      className="flex-1 py-3 text-xs font-bold rounded-xl bg-[#4F9CF9] hover:bg-[#68AFFF] transition-colors text-white active:scale-[0.98] flex items-center justify-center gap-1 shadow-md shadow-[#4F9CF9]/10"
                    >
                      <span>Create Room</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : roomStep === 0 ? (
                /* Step 0: Loading */
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <div className="relative w-16 h-16 mb-6">
                    <span className="absolute inset-0 w-full h-full rounded-full border-2 border-[#4F9CF9]/20 animate-pulse" />
                    <span className="absolute inset-0 w-full h-full rounded-full border-2 border-transparent border-t-[#4F9CF9] animate-spin" />
                    <div className="absolute inset-3 rounded-full bg-[#4F9CF9]/10 flex items-center justify-center text-[#4F9CF9]">
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Creating live room...</h3>
                  <p className="text-xs text-[#A1A7B3] max-w-[200px]">Configuring secure peer tunnel and generating tracking link.</p>
                </div>
              ) : (
                /* Step 1: Ready */
                <div className="py-2">
                  <div className="w-12 h-12 rounded-full bg-[#00E5A0]/15 text-[#00E5A0] border border-[#00E5A0]/20 flex items-center justify-center mb-6 mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">Your room is ready</h3>
                  <p className="text-xs text-[#A1A7B3] mb-6">Your temporary room will automatically expire after {durationHours} hours. Invite friends to join live tracking.</p>

                  <div className="space-y-4">
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-[#A1A7B3] uppercase tracking-wider block mb-1.5">ROOM PASSCODE</span>
                      <div className="bg-[#0F1115] border border-white/5 px-4 py-3 rounded-xl text-white font-mono font-bold tracking-widest text-lg text-center select-all">
                        {generatedRoomId}
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] font-bold text-[#A1A7B3] uppercase tracking-wider block mb-1.5">SHAREABLE URL</span>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-[#0F1115] border border-white/5 px-3 py-2.5 rounded-xl text-xs text-[#A1A7B3] truncate select-all flex items-center">
                          {typeof window !== "undefined" ? window.location.host : "pingme.app"}/room/{generatedRoomId.toLowerCase()}
                        </div>
                        <button 
                          onClick={copyToClipboard}
                          className="px-4 bg-[#4F9CF9] hover:bg-[#68AFFF] active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-[#4F9CF9]/10 transition-all"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button 
                      onClick={() => setIsCreatingRoom(false)}
                      className="flex-1 py-3 text-xs font-bold rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-white active:scale-[0.98]"
                    >
                      Close
                    </button>
                    <a 
                      href={`/room/${generatedRoomId.toLowerCase()}`}
                      className="flex-1 py-3 text-xs font-bold rounded-xl bg-[#4F9CF9] hover:bg-[#68AFFF] transition-colors text-white active:scale-[0.98] flex items-center justify-center gap-1 shadow-md shadow-[#4F9CF9]/10"
                    >
                      <span>Enter Room</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
