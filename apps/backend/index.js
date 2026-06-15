const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// ─── Config ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const ROOM_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // check every 5 min
const FRONTEND_URL = process.env.FRONTEND_URL;

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  ...(FRONTEND_URL ? [FRONTEND_URL] : []),
];

// ─── App Setup ─────────────────────────────────────────
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ─── In-Memory Rooms Store ─────────────────────────────
// rooms: Map<roomId, {
//   name: string,
//   createdAt: number,
//   expiresAt: number,
//   participants: Map<socketId, { userId, userName, initials, color, lat, lng, battery, speed, status }>
// }>
const rooms = new Map();

// Color palette for participants
const COLORS = [
  "#4F9CF9", "#00E5A0", "#F99F4F", "#D14FF9", "#FF6B6B",
  "#45D9FD", "#FFD93D", "#C084FC", "#FB7185", "#34D399",
];

// Generate a short room code like "a3x9-k2m7"
function generateRoomId() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars
  let part1 = "", part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${part1}-${part2}`;
}

// Get initials from a name
function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Get a color for a participant based on their index
function getColor(index) {
  return COLORS[index % COLORS.length];
}

// ─── REST API ──────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", rooms: rooms.size });
});

// Check if a room exists
app.get("/api/room/:id", (req, res) => {
  const roomId = req.params.id.toLowerCase();
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ exists: false, message: "Room not found" });
  }

  const now = Date.now();
  if (now > room.expiresAt) {
    rooms.delete(roomId);
    return res.status(404).json({ exists: false, message: "Room has expired" });
  }

  res.json({
    exists: true,
    roomId,
    name: room.name,
    participantCount: room.participants.size,
    expiresAt: room.expiresAt,
  });
});

// ─── Socket.IO ─────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✦ Connected: ${socket.id}`);

  let currentRoomId = null;
  let currentUserName = null;

  // ── Create Room ──────────────────────────────────────
  socket.on("create-room", ({ roomName }, callback) => {
    const roomId = generateRoomId();
    const now = Date.now();

    rooms.set(roomId, {
      name: roomName || "Untitled Room",
      createdAt: now,
      expiresAt: now + ROOM_EXPIRY_MS,
      participants: new Map(),
    });

    console.log(`✦ Room created: ${roomId} — "${roomName}"`);

    if (typeof callback === "function") {
      callback({ success: true, roomId });
    }
  });

  // ── Join Room ────────────────────────────────────────
  socket.on("join-room", ({ roomId, userName }, callback) => {
    const id = roomId.toLowerCase();
    const room = rooms.get(id);

    if (!room) {
      socket.emit("room-error", { message: "Room not found. Check the code and try again." });
      if (typeof callback === "function") callback({ success: false, message: "Room not found" });
      return;
    }

    const now = Date.now();
    if (now > room.expiresAt) {
      rooms.delete(id);
      socket.emit("room-error", { message: "This room has expired." });
      if (typeof callback === "function") callback({ success: false, message: "Room expired" });
      return;
    }

    // Join the Socket.IO room
    socket.join(id);
    currentRoomId = id;
    currentUserName = userName;

    const participantIndex = room.participants.size;
    const participant = {
      userId: socket.id,
      userName: userName,
      initials: getInitials(userName),
      color: getColor(participantIndex),
      lat: 0,
      lng: 0,
      battery: 100,
      speed: 0,
      status: "Connecting...",
      joinedAt: now,
    };

    room.participants.set(socket.id, participant);

    // Build the full participants list for the joining user
    const participantsList = Array.from(room.participants.values()).map((p) => ({
      id: p.userId,
      name: p.userName,
      initials: p.initials,
      color: p.color,
      lat: p.lat,
      lng: p.lng,
      battery: p.battery,
      speed: p.speed,
      status: p.status,
      isUser: p.userId === socket.id,
    }));

    // Tell the joining user about the room
    if (typeof callback === "function") {
      callback({
        success: true,
        roomId: id,
        roomName: room.name,
        expiresAt: room.expiresAt,
        participants: participantsList,
      });
    }

    // Tell everyone else in the room
    socket.to(id).emit("user-joined", {
      userId: socket.id,
      userName: participant.userName,
      initials: participant.initials,
      color: participant.color,
      participant: {
        id: participant.userId,
        name: participant.userName,
        initials: participant.initials,
        color: participant.color,
        lat: participant.lat,
        lng: participant.lng,
        battery: participant.battery,
        speed: participant.speed,
        status: participant.status,
        isUser: false,
      },
    });

    console.log(`✦ ${userName} joined room ${id} (${room.participants.size} members)`);
  });

  // ── Location Update ──────────────────────────────────
  socket.on("location-update", ({ lat, lng, battery, speed, status }) => {
    if (!currentRoomId) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    // Update stored data
    participant.lat = lat;
    participant.lng = lng;
    if (battery !== undefined) participant.battery = battery;
    if (speed !== undefined) participant.speed = speed;
    if (status !== undefined) participant.status = status;

    // Broadcast to all OTHER members in the room
    socket.to(currentRoomId).emit("location-broadcast", {
      userId: socket.id,
      userName: participant.userName,
      initials: participant.initials,
      color: participant.color,
      lat,
      lng,
      battery: participant.battery,
      speed: participant.speed,
      status: participant.status,
    });
  });

  // ── Disconnect ───────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`✦ Disconnected: ${socket.id} (${currentUserName || "unknown"})`);

    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.participants.delete(socket.id);

        // Tell remaining members
        socket.to(currentRoomId).emit("user-left", {
          userId: socket.id,
        });

        console.log(`  → Room ${currentRoomId} now has ${room.participants.size} members`);

        // Don't delete empty rooms immediately — creator might come back
      }
    }
  });
});

// ─── Expired Room Cleanup ──────────────────────────────
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [roomId, room] of rooms) {
    if (now > room.expiresAt) {
      // Disconnect any remaining sockets in this room
      io.in(roomId).emit("room-error", { message: "This room has expired." });
      io.in(roomId).socketsLeave(roomId);
      rooms.delete(roomId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`✦ Cleaned up ${cleaned} expired room(s). Active rooms: ${rooms.size}`);
  }
}, CLEANUP_INTERVAL_MS);

// ─── Start ─────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n✦ Orbit server running on http://localhost:${PORT}`);
  console.log(`  → Socket.IO ready`);
  console.log(`  → Room expiry: ${ROOM_EXPIRY_MS / 1000 / 60 / 60}h\n`);
});
