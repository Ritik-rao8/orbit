"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

// Location update interval in ms
const LOCATION_INTERVAL = 3000;

export default function useSocket(roomId) {
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const latestLocationRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [error, setError] = useState(null);
  const [myUserId, setMyUserId] = useState(null);

  // Connect socket on mount
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✦ Socket connected:", socket.id);
      setIsConnected(true);
      setMyUserId(socket.id);
    });

    socket.on("disconnect", () => {
      console.log("✦ Socket disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("✦ Socket connection error:", err.message);
      setError("Unable to connect to server. Please try again.");
    });

    // Someone joined the room
    socket.on("user-joined", ({ participant }) => {
      setParticipants((prev) => {
        // Don't add duplicates
        if (prev.find((p) => p.id === participant.id)) return prev;
        return [...prev, participant];
      });
    });

    // Someone left the room
    socket.on("user-left", ({ userId }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    });

    // Location update from another participant
    socket.on("location-broadcast", ({ userId, lat, lng, battery, speed, status }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === userId
            ? { ...p, lat, lng, battery, speed, status }
            : p
        )
      );
    });

    // Room error
    socket.on("room-error", ({ message }) => {
      setError(message);
    });

    return () => {
      socket.disconnect();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  // Start watching GPS and emitting updates
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    // Watch position for high accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestLocationRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed || 0,
        };

        // Update own position locally immediately
        const socket = socketRef.current;
        if (socket) {
          setParticipants((prev) =>
            prev.map((p) =>
              p.isUser
                ? {
                    ...p,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    status: position.coords.speed > 1
                      ? `Moving • ${Math.round((position.coords.speed || 0) * 3.6)}km/h`
                      : "Stationary",
                  }
                : p
            )
          );
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        // Geolocation error codes: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
        if (!err || typeof err !== 'object') {
          console.error("Invalid geolocation error object");
          return;
        }
        
        switch (err.code) {
          case 1: // PERMISSION_DENIED
            setError("Location permission denied. Others won't see your position.");
            break;
          case 2: // POSITION_UNAVAILABLE
            setError("Location unavailable. Check your device settings and GPS.");
            break;
          case 3: // TIMEOUT
            setError("Location request timed out. Check your connection and try again.");
            break;
          default:
            if (err.message) {
              console.error("Geolocation error details:", err.message);
            }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      }
    );

    // Send location to server at a fixed interval (throttled)
    locationIntervalRef.current = setInterval(() => {
      const socket = socketRef.current;
      const loc = latestLocationRef.current;
      if (!socket || !loc) return;

      const speedKmh = Math.round((loc.speed || 0) * 3.6);
      const status = speedKmh > 1 ? `Moving • ${speedKmh}km/h` : "Stationary";

      socket.emit("location-update", {
        lat: loc.lat,
        lng: loc.lng,
        battery: 100, // Browser doesn't reliably expose battery
        speed: loc.speed || 0,
        status,
      });
    }, LOCATION_INTERVAL);
  }, []);

  // Join room
  const joinRoom = useCallback((userName) => {
    const socket = socketRef.current;
    if (!socket || !roomId) return;

    setError(null);

    socket.emit("join-room", { roomId, userName }, (response) => {
      if (response.success) {
        setHasJoined(true);
        setRoomInfo({
          roomId: response.roomId,
          name: response.roomName,
          expiresAt: response.expiresAt,
        });

        // Set initial participants (mark self)
        const mapped = response.participants.map((p) => ({
          ...p,
          isUser: p.id === socket.id,
        }));
        setParticipants(mapped);

        // Start geolocation tracking
        startLocationTracking();
      } else {
        setError(response.message || "Failed to join room");
      }
    });
  }, [roomId, startLocationTracking]);


  // Create room (used from landing page)
  const createRoom = useCallback((roomName) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) {
        reject(new Error("Not connected"));
        return;
      }

      socket.emit("create-room", { roomName }, (response) => {
        if (response.success) {
          resolve(response.roomId);
        } else {
          reject(new Error(response.message || "Failed to create room"));
        }
      });
    });
  }, []);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    const socket = socketRef.current;
    if (socket) {
      socket.disconnect();
    }
    setHasJoined(false);
    setParticipants([]);
  }, []);

  return {
    isConnected,
    hasJoined,
    participants,
    roomInfo,
    error,
    myUserId,
    joinRoom,
    createRoom,
    leaveRoom,
    setError,
  };
}
