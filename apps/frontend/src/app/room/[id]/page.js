"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { 
  MapPin, 
  Clock, 
  Share2, 
  UserPlus, 
  LogOut, 
  Check, 
  Battery,
  Navigation,
  Wifi,
  WifiOff,
  Loader2,
  Eye,
  EyeOff,
  Gauge,
  Crosshair,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
} from "lucide-react";
import useSocket from "./useSocket";

// Dynamically import LeafletMap with SSR disabled (Leaflet requires browser APIs)
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#0F1115] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-[#4F9CF9]/30 border-t-[#4F9CF9] rounded-full animate-spin" />
        <span className="text-xs text-[#A1A7B3] font-medium">Loading map...</span>
      </div>
    </div>
  )
});

// Default map center (will be overridden by user's location)
const DEFAULT_CENTER = [28.6139, 77.2090]; // New Delhi
const DEFAULT_ZOOM = 15;

// ── Haversine Distance Utility ────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in meters
}

// Format distance for display
function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

// Format speed for display
function formatSpeed(speedMs) {
  const kmh = Math.round((speedMs || 0) * 3.6);
  if (kmh <= 0) return "0 km/h";
  return `${kmh} km/h`;
}

export default function LiveRoom() {
  const { id } = useParams();
  const router = useRouter();

  // Socket hook
  const {
    isConnected,
    hasJoined,
    participants,
    roomInfo,
    error,
    joinRoom,
    leaveRoom,
    setError,
    // ── New premium features ──
    meetingPin,
    notification,
    isInvisible,
    setMeetingPin,
    toggleInvisible,
  } = useSocket(id);

  // Local UI state
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [expandedParticipant, setExpandedParticipant] = useState(null);
  const [isPinPlacementMode, setIsPinPlacementMode] = useState(false);
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const isLeavingRef = useRef(false);

  // Join screen state
  const [userName, setUserName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Timer state
  const [timeLeft, setTimeLeft] = useState("");

  // Countdown timer based on room expiry
  useEffect(() => {
    if (!roomInfo?.expiresAt) return;

    const timer = setInterval(() => {
      const diff = roomInfo.expiresAt - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00:00");
        clearInterval(timer);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft([h, m, s].map(v => String(v).padStart(2, "0")).join(":"));
    }, 1000);

    return () => clearInterval(timer);
  }, [roomInfo?.expiresAt]);

  // Intercept back button popstate when hasJoined is true
  useEffect(() => {
    if (!hasJoined) return;

    // Push initial dummy state so we have history to pop
    window.history.pushState({ isRoomEntry: true }, "", window.location.href);

    const handlePopState = (event) => {
      if (isLeavingRef.current) return;

      // Show leave confirmation modal
      setShowLeaveConfirm(true);

      // Re-push history entry to prevent back navigation and allow catching next popstate
      window.history.pushState({ isRoomEntry: true }, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasJoined]);

  // Map center: use the current user's position, or default
  const myPosition = participants.find(p => p.isUser);
  const mapCenter = myPosition && myPosition.lat !== 0
    ? [myPosition.lat, myPosition.lng]
    : DEFAULT_CENTER;

  // ── Distance computation ────────────────────────────
  const participantsWithDistance = participants.map((p) => {
    if (p.isUser || !myPosition || myPosition.lat === 0 || p.lat === 0) {
      return { ...p, distance: null };
    }
    const dist = haversineDistance(myPosition.lat, myPosition.lng, p.lat, p.lng);
    return { ...p, distance: dist };
  });

  // Sort others by distance (nearest first), keep current user at top
  const sortedParticipants = [...participantsWithDistance].sort((a, b) => {
    if (a.isUser) return -1;
    if (b.isUser) return 1;
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });

  // Determine closest non-user participant (with valid distance)
  const closestParticipant = sortedParticipants.find(
    (p) => !p.isUser && p.distance !== null && !p.invisible
  );

  // Recenter map on Current User
  const handleRecenter = () => {
    if (myPosition && myPosition.lat !== 0) {
      setFlyToTarget([myPosition.lat, myPosition.lng]);
      setTimeout(() => setFlyToTarget(null), 1200);
    }
    setSelectedUser(null);
  };

  // Focus Map on a specific Participant
  const handleFocusUser = (user) => {
    setSelectedUser(user);
    if (user.lat !== 0) {
      setFlyToTarget([user.lat, user.lng]);
      setTimeout(() => setFlyToTarget(null), 1200);
    }
  };

  // Fly to meeting pin
  const handleFlyToMeetPin = () => {
    if (meetingPin) {
      setFlyToTarget([meetingPin.lat, meetingPin.lng]);
      setTimeout(() => setFlyToTarget(null), 1200);
    }
  };

  // Meet Here: enter pin placement mode (user picks on map)
  const handleEnterPinMode = () => {
    setIsPinPlacementMode(true);
    setIsBottomSheetExpanded(false);
  };

  // Map click/long-press places the meeting pin (when in pin mode, or always on long-press)
  const handleMapClick = (lat, lng) => {
    if (isPinPlacementMode) {
      setMeetingPin(lat, lng);
      setIsPinPlacementMode(false);
    }
  };

  const handleMapLongPress = (lat, lng) => {
    setMeetingPin(lat, lng);
    setIsPinPlacementMode(false);
  };

  const copyInviteLink = () => {
    const url = typeof window !== "undefined" 
      ? `${window.location.origin}/room/${id}`
      : `https://pingme.app/room/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    setShowLeaveConfirm(true);
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    const name = userName.trim();
    if (!name || name.length < 1) return;
    setIsJoining(true);
    joinRoom(name);
  };

  // Toggle expanded detail row for a participant
  const handleToggleExpand = (participantId) => {
    setExpandedParticipant((prev) => (prev === participantId ? null : participantId));
  };

  // Reset joining state when joined or error
  useEffect(() => {
    if (hasJoined || error) {
      setTimeout(() => setIsJoining(false), 0);
    }
  }, [hasJoined, error]);

  const activeCount = participants.filter(p => p.lat !== 0 && !p.invisible).length;

  // ─── JOIN SCREEN ─────────────────────────────────────
  if (!hasJoined) {
    return (
      <div className="relative w-full h-screen bg-[#0F1115] overflow-hidden flex items-center justify-center text-white select-none">
        {/* Background glow */}
        <div className="absolute w-[400px] h-[400px] bg-[#4F9CF9]/8 rounded-full filter blur-[120px] pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-sm mx-4 bg-[#171A20]/95 backdrop-blur-xl border border-white/[0.08] rounded-[32px] p-8 shadow-2xl"
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#4F9CF9] flex items-center justify-center shadow-lg shadow-[#4F9CF9]/20">
              <span className="font-bold text-base text-white">P</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide text-white leading-none">Join Room</h1>
              <span className="text-[10px] text-[#A1A7B3] font-medium">{id}</span>
            </div>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-2 mb-6 text-[11px] font-medium">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-[#00E5A0]">
                <Wifi className="w-3 h-3" />
                Connected to server
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[#F99F4F]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting...
              </span>
            )}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name Input Form */}
          <form onSubmit={handleJoinSubmit}>
            <div className="mb-2">
              <label className="text-[10px] font-bold text-[#A1A7B3] uppercase tracking-wider block mb-2">
                Your display name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => { setUserName(e.target.value); setError(null); }}
                placeholder="e.g. Ritik"
                maxLength={20}
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl bg-[#0F1115] border border-white/[0.06] text-sm text-white placeholder:text-[#A1A7B3]/50 focus:outline-none focus:border-[#4F9CF9]/40 transition-colors"
              />
            </div>

            <p className="text-[10px] text-[#A1A7B3] mb-6 leading-relaxed">
              This name will be visible to all room members on the map.
            </p>

            <button
              type="submit"
              disabled={!isConnected || !userName.trim() || isJoining}
              className="w-full py-3.5 rounded-xl bg-[#4F9CF9] hover:bg-[#68AFFF] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#4F9CF9]/15 transition-all active:scale-[0.98]"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>Join & Start Tracking</span>
                </>
              )}
            </button>
          </form>

          {/* Back link */}
          <button
            onClick={() => router.push("/")}
            className="mt-4 w-full py-2 text-[11px] text-[#A1A7B3] hover:text-white transition-colors font-medium"
          >
            ← Back to home
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── MAIN ROOM VIEW ──────────────────────────────────
  return (
    <div className="relative w-full h-screen bg-[#0F1115] overflow-hidden flex justify-center text-white select-none">
      
      {/* 1. FULL SCREEN LEAFLET MAP */}
      <div className="absolute inset-0 z-0">
        <LeafletMap
          participants={participants}
          selectedUser={selectedUser}
          onSelectUser={handleFocusUser}
          flyToTarget={flyToTarget}
          mapCenter={mapCenter}
          mapZoom={DEFAULT_ZOOM}
          meetingPin={meetingPin}
          onLongPress={handleMapLongPress}
          onMapClick={handleMapClick}
          isPinPlacementMode={isPinPlacementMode}
        />
      </div>

      {/* 2. FLOATING CONTROL OVERLAYS */}
      <div className="relative w-full max-w-md h-full pointer-events-none flex flex-col justify-between p-4 z-10">
        
        {/* ROOM CARD (TOP) */}
        <div className="w-full pt-1.5">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-[#0F1115]/70 backdrop-blur-xl border border-white/[0.08] rounded-[24px] p-4 flex items-center justify-between shadow-2xl pointer-events-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-lg shadow-inner">
                📍
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-semibold tracking-wide text-white leading-none">
                    {roomInfo?.name || "Live Room"}
                  </h1>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] animate-pulse" />
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex -space-x-1.5">
                    {participants.slice(0, 3).map((p) => (
                      <div 
                        key={p.id} 
                        className="w-4 h-4 rounded-full border border-[#171A20] text-[7px] font-black flex items-center justify-center text-white"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.initials[0]}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#A1A7B3] font-medium leading-none">
                    {participants.length} tracking live
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {/* Expiry counter */}
              {timeLeft && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-[#4F9CF9] bg-[#4F9CF9]/10 border border-[#4F9CF9]/15 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3" />
                  <span>{timeLeft}</span>
                </div>
              )}
              
              {/* Invite button */}
              <button 
                onClick={() => setShowInvitePopup(true)}
                className="px-2.5 py-1 text-[9px] font-bold rounded-lg bg-[#4F9CF9] text-white hover:bg-[#68AFFF] active:scale-95 transition-all flex items-center gap-1 shadow-md shadow-[#4F9CF9]/10"
              >
                <Share2 className="w-2.5 h-2.5" />
                <span>Invite</span>
              </button>
            </div>
          </motion.div>

          {/* Connection indicator */}
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[#F99F4F] font-medium bg-[#F99F4F]/10 border border-[#F99F4F]/20 rounded-xl py-1.5 pointer-events-auto"
            >
              <WifiOff className="w-3 h-3" />
              Reconnecting...
            </motion.div>
          )}

          {/* ── FLOATING NOTIFICATION TOAST ─────────────── */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="mt-2 flex items-center justify-center gap-2 text-[11px] font-semibold text-white bg-gradient-to-r from-[#4F9CF9]/20 to-[#00E5A0]/20 border border-[#4F9CF9]/25 rounded-2xl py-2.5 px-4 pointer-events-auto backdrop-blur-xl"
              >
                <span className="text-sm">📍</span>
                <span>{notification}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PIN PLACEMENT MODE BANNER ─────────────── */}
          <AnimatePresence>
            {isPinPlacementMode && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-white bg-gradient-to-r from-[#4F9CF9]/15 to-[#00E5A0]/15 border border-[#4F9CF9]/30 rounded-2xl py-2.5 px-4 pointer-events-auto backdrop-blur-xl"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4F9CF9] animate-pulse" />
                  <span>Tap on the map to set meeting point</span>
                </div>
                <button
                  onClick={() => setIsPinPlacementMode(false)}
                  className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors active:scale-95"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM CONTAINER */}
        <div className="w-full flex flex-col gap-3 items-end pb-2">
          
          {/* FLOATING ACTION BUTTONS */}
          <div className="flex flex-col gap-2.5">

            {/* Navigate to Meeting Pin */}
            <AnimatePresence>
              {meetingPin && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleFlyToMeetPin}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4F9CF9] to-[#00E5A0] flex items-center justify-center text-white shadow-2xl shadow-[#4F9CF9]/20 pointer-events-auto active:scale-95 transition-all"
                  title="Go to meeting point"
                >
                  <Crosshair className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Go Invisible Toggle */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleInvisible(!isInvisible)}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl pointer-events-auto active:scale-95 transition-all border ${
                isInvisible 
                  ? "bg-[#F99F4F]/15 border-[#F99F4F]/30 text-[#F99F4F]"
                  : "bg-[#171A20] border-white/10 text-white hover:bg-[#1E222A]"
              }`}
              title={isInvisible ? "Go visible" : "Go invisible"}
            >
              {isInvisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </motion.button>

            {/* Recenter */}
            <motion.button 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRecenter}
              className="w-12 h-12 rounded-full bg-[#171A20] border border-white/10 flex items-center justify-center text-white shadow-2xl pointer-events-auto hover:bg-[#1E222A] active:scale-95 transition-all group"
            >
              <Navigation className="w-5 h-5 text-[#4F9CF9] -rotate-45 group-hover:scale-110 transition-transform" />
            </motion.button>
          </div>

          {/* INTERACTIVE DRAGGABLE BOTTOM SHEET */}
          <motion.div 
            drag="y"
            dragConstraints={{ top: -400, bottom: 0 }}
            dragElastic={0.12}
            dragMomentum={false}
            animate={{ y: isBottomSheetExpanded ? -400 : 0 }}
            onDragEnd={(e, info) => {
              if (info.offset.y < -80) {
                setIsBottomSheetExpanded(true);
              } else if (info.offset.y > 80) {
                setIsBottomSheetExpanded(false);
              }
            }}
            className="w-full bg-[#171A20]/95 backdrop-blur-xl border border-white/[0.06] rounded-[28px] shadow-[0_-15px_30px_-5px_rgba(0,0,0,0.5)] p-4 flex flex-col pointer-events-auto cursor-ns-resize"
            style={{
              height: "480px",
              marginBottom: "-400px"
            }}
          >
            {/* Grab Handle Wrapper (provides a larger touch target for mobile) */}
            <div 
              onClick={() => setIsBottomSheetExpanded(!isBottomSheetExpanded)}
              className="w-full py-3 -mt-2 cursor-pointer flex items-center justify-center group"
            >
              <div className="w-16 h-1.5 bg-white/25 rounded-full group-hover:bg-white/40 transition-colors" />
            </div>
            
            {/* Header info / Collapsed bar */}
            <div 
              onClick={() => setIsBottomSheetExpanded(!isBottomSheetExpanded)}
              className="flex items-center justify-between pb-3 cursor-pointer"
            >
              <div className="text-left">
                <span className="text-xs font-bold text-white leading-none">Participants Directory</span>
                <span className="text-[10px] text-[#A1A7B3] block mt-0.5 leading-none">
                  {participants.length} member{participants.length !== 1 ? "s" : ""} in this room
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Invisible badge (shown when you're invisible) */}
                {isInvisible && (
                  <div className="flex items-center gap-1 bg-[#F99F4F]/15 text-[#F99F4F] border border-[#F99F4F]/25 px-2 py-0.5 rounded-full text-[9px] font-bold">
                    <EyeOff className="w-2.5 h-2.5" />
                    Invisible
                  </div>
                )}
                <div className="flex items-center gap-1 bg-[#00E5A0]/15 text-[#00E5A0] border border-[#00E5A0]/25 px-2 py-0.5 rounded-full text-[9px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] animate-ping" />
                  {activeCount} Active
                </div>
              </div>
            </div>

            {/* Scrollable list section */}
            <div className={`flex-1 overflow-y-auto mt-2 pr-1 pointer-events-auto ${isBottomSheetExpanded ? "" : "pointer-events-none opacity-40"}`}>
              <div className="space-y-2.5">
                {sortedParticipants.map((p) => {
                  const isSelected = selectedUser?.id === p.id;
                  const isExpanded = expandedParticipant === p.id;
                  const isClosest = closestParticipant?.id === p.id;

                  return (
                    <div key={p.id} className="flex flex-col">
                      <div 
                        onClick={() => handleFocusUser(p)}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-[#4F9CF9]/10 border-[#4F9CF9]/30" 
                            : "bg-white/[0.02] border-white/5 hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${p.invisible && !p.isUser ? "opacity-40" : ""}`}
                            style={{ backgroundColor: p.color }}
                          >
                            {p.initials}
                          </div>
                          
                          <div className="text-left">
                            <h4 className="text-xs font-bold text-white leading-none flex items-center gap-1.5">
                              {p.name}
                              {p.isUser && (
                                <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-md bg-white/10 text-white/80">You</span>
                              )}
                              {isClosest && !p.isUser && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-[#00E5A0]/15 text-[#00E5A0] border border-[#00E5A0]/20">Closest</span>
                              )}
                              {p.invisible && (
                                <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-md bg-[#F99F4F]/10 text-[#F99F4F] border border-[#F99F4F]/15 flex items-center gap-0.5">
                                  <EyeOff className="w-2 h-2" />
                                  Invisible
                                </span>
                              )}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-[#A1A7B3] leading-none">
                                {p.invisible
                                  ? "Location hidden"
                                  : p.lat === 0
                                    ? "Waiting for location..."
                                    : (p.status || "Active")}
                              </span>
                              {/* Distance badge */}
                              {!p.isUser && p.distance !== null && !p.invisible && (
                                <span className="text-[9px] text-[#4F9CF9] font-semibold leading-none">
                                  • {formatDistance(p.distance)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-medium text-[#A1A7B3]">
                          {/* Expand/collapse detail toggle */}
                          {!p.isUser && p.lat !== 0 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleToggleExpand(p.id); }}
                              className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                          {p.lat !== 0 && !p.invisible && (
                            <div className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                              <MapPin className="w-3 h-3 text-[#4F9CF9]" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expandable detail row */}
                      <AnimatePresence>
                        {isExpanded && !p.isUser && p.lat !== 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="mx-1 mt-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-4">
                              {/* Distance */}
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <div className="w-6 h-6 rounded-lg bg-[#4F9CF9]/10 flex items-center justify-center">
                                  <MapPin className="w-3 h-3 text-[#4F9CF9]" />
                                </div>
                                <div className="text-left">
                                  <span className="text-[8px] text-[#A1A7B3] uppercase font-bold block leading-none">Distance</span>
                                  <span className="text-white font-semibold leading-none">
                                    {p.distance !== null ? formatDistance(p.distance) : "—"}
                                  </span>
                                </div>
                              </div>
                              {/* Speed */}
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <div className="w-6 h-6 rounded-lg bg-[#00E5A0]/10 flex items-center justify-center">
                                  <Gauge className="w-3 h-3 text-[#00E5A0]" />
                                </div>
                                <div className="text-left">
                                  <span className="text-[8px] text-[#A1A7B3] uppercase font-bold block leading-none">Speed</span>
                                  <span className="text-white font-semibold leading-none">{formatSpeed(p.speed)}</span>
                                </div>
                              </div>
                              {/* Status */}
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                                  <Wifi className="w-3 h-3 text-white/60" />
                                </div>
                                <div className="text-left">
                                  <span className="text-[8px] text-[#A1A7B3] uppercase font-bold block leading-none">Status</span>
                                  <span className="text-white font-semibold leading-none">{p.status || "Active"}</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {participants.length === 1 && (
                  <div className="text-center py-6">
                    <p className="text-[11px] text-[#A1A7B3] font-medium">Waiting for others to join...</p>
                    <button
                      onClick={copyInviteLink}
                      className="mt-3 px-4 py-2 text-[10px] font-bold rounded-lg bg-[#4F9CF9]/10 border border-[#4F9CF9]/20 text-[#4F9CF9] hover:bg-[#4F9CF9]/15 transition-all"
                    >
                      Share Invite Link
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions footer */}
            <div className={`pt-4 border-t border-white/5 mt-4 flex items-center gap-2.5 ${isBottomSheetExpanded ? "" : "pointer-events-none opacity-0"}`}>
              {/* Meet Here action — enters pin placement mode */}
              <button 
                onClick={handleEnterPinMode}
                className={`flex-1 py-3 transition-all text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 ${
                  isPinPlacementMode
                    ? "bg-[#4F9CF9]/20 border border-[#4F9CF9]/40 text-[#4F9CF9]"
                    : "bg-gradient-to-r from-[#4F9CF9]/10 to-[#00E5A0]/10 hover:from-[#4F9CF9]/15 hover:to-[#00E5A0]/15 border border-[#4F9CF9]/15 text-white"
                }`}
              >
                <MapPin className="w-4 h-4 text-[#4F9CF9]" />
                <span>{isPinPlacementMode ? "Picking..." : "Meet Here"}</span>
              </button>

              <button 
                onClick={() => setShowInvitePopup(true)}
                className="flex-1 py-3 bg-[#171A20] hover:bg-white/[0.04] transition-all text-xs font-semibold rounded-xl border border-white/5 flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4 text-[#4F9CF9]" />
                <span>Invite</span>
              </button>

              <button 
                onClick={handleLeaveRoom}
                className="py-3 px-4 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 transition-all text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </motion.div>
        </div>

      </div>

      {/* 3. LEAVE ROOM CONFIRMATION MODAL */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 380 }}
              className="w-full max-w-sm bg-[#171A20]/95 border border-white/[0.08] rounded-[28px] p-6 shadow-2xl text-center flex flex-col items-center gap-5"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <LogOut className="w-5 h-5" />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-white tracking-wide">Leave Event Room?</h3>
                <p className="text-xs text-[#A1A7B3] leading-relaxed px-2">
                  Are you sure you want to leave this room? Your live coordinates will stop tracking immediately.
                </p>
              </div>

              <div className="w-full flex items-center gap-3 mt-1">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    isLeavingRef.current = true;
                    setShowLeaveConfirm(false);
                    leaveRoom();
                    router.push("/");
                  }}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-500/10 active:scale-[0.98]"
                >
                  Leave Room
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. INVITE POPUP WITH ROOM PASSCODE */}
      <AnimatePresence>
        {showInvitePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md pointer-events-auto"
            onClick={() => setShowInvitePopup(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              transition={{ type: "spring", damping: 28, stiffness: 400 }}
              className="w-full max-w-sm bg-[#171A20]/95 border border-white/[0.08] rounded-[28px] p-6 shadow-2xl flex flex-col items-center gap-5 mb-4 sm:mb-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button 
                onClick={() => setShowInvitePopup(false)}
                className="absolute top-4 right-4 text-[#A1A7B3] hover:text-white transition-colors w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-[#4F9CF9]/10 border border-[#4F9CF9]/20 flex items-center justify-center text-[#4F9CF9]">
                <Share2 className="w-5 h-5" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white tracking-wide">Invite Friends</h3>
                <p className="text-[10px] text-[#A1A7B3]">Share this code to let friends join your room</p>
              </div>

              {/* Room Passcode — big and prominent */}
              <div className="w-full">
                <span className="text-[9px] font-bold text-[#A1A7B3] uppercase tracking-widest block mb-1.5 text-center">Room Passcode</span>
                <div className="bg-[#0F1115] border border-white/[0.06] px-4 py-3.5 rounded-2xl text-white font-mono font-bold tracking-[0.25em] text-2xl text-center select-all">
                  {id.toUpperCase()}
                </div>
              </div>

              {/* Shareable link with copy */}
              <div className="w-full">
                <span className="text-[9px] font-bold text-[#A1A7B3] uppercase tracking-widest block mb-1.5 text-center">Or share link</span>
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#0F1115] border border-white/[0.06] px-3 py-2.5 rounded-xl text-[11px] text-[#A1A7B3] truncate select-all flex items-center">
                    {typeof window !== "undefined" ? window.location.host : "orbit.app"}/room/{id}
                  </div>
                  <button 
                    onClick={copyInviteLink}
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

              <button 
                onClick={() => setShowInvitePopup(false)}
                className="w-full py-3 text-xs font-bold rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors text-white active:scale-[0.98]"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
