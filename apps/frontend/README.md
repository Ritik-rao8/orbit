# Orbit - Real-Time Location Sharing and Event Tracking

Orbit is a premium, web-based, real-time event tracking and location-sharing application built for mobile-first devices. Inspired by modern design patterns, Orbit allows users to create private temporary event rooms, share a link with friends, and monitor participant coordinates live on a dark-themed map.

No app store installs or account creation are required, delivering a friction-free browser-based coordination tool.

This is an npm workspaces monorepo:

- `apps/frontend` - Next.js frontend (deploy on Vercel)
- `apps/backend` - Socket.IO backend (deploy on Railway)

---

## Features

- **Full-Screen Dark Map**: Integrated with OpenStreetMap and React Leaflet utilizing Stadia Alidade Smooth Dark tiles for a high-contrast, premium interface.
- **Custom Participant Markers**: Circular status avatars displaying initials with smooth coordinate gliding animations, replacing standard map pins.
- **Real-Time Data Integration**: Live coordinate synchronization, device battery status, movement velocity, and activity descriptions (Walking, Biking, Running, Stationary).
- **Temporary Self-Expiring Rooms**: Events automatically expire after the countdown clock hits zero (e.g. 6 hours).
- **Shareable Links and Passcodes**: Fast passcode generation with single-click URL clipboard copying.
- **iOS-style Draggable Drawer**: Draggable bottom sheet containing the full participants directory, invite copy triggers, and exit button.
- **Custom Confirmation Dialog**: Built-in confirmation popup with spring animations using Framer Motion before exiting active rooms.

---

## Tech Stack

- **Framework**: Next.js (App Router, React 19, Turbopack)
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Maps**: React Leaflet & Leaflet.js (Dynamic Client-Side Import)
- **Icons**: Lucide React

---

## Getting Started

### Prerequisites

Ensure Node.js (v18+) and npm are installed on your local environment.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Ritik-rao8/orbit.git
   cd orbit
   ```

2. Install dependencies from the repo root:
   ```bash
   npm install
   ```

3. Start both apps in development:
   ```bash
   npm run dev
   ```

   Or run them individually:
   ```bash
   npm run dev:frontend   # http://localhost:3000
   npm run dev:backend    # http://localhost:3001
   ```

### Deployment

**Vercel (frontend)**
1. Import the repo in Vercel.
2. Set **Root Directory** to `apps/frontend`.
3. Add env var `NEXT_PUBLIC_SOCKET_URL` = your Railway backend URL.

**Railway (backend)**
1. Create a new service from the same repo.
2. Keep **Root Directory** at the repo root (`.`).
3. Railway will use `railway.toml` to start with `npm run start -w @orbit/backend`.
4. Add env var `FRONTEND_URL` = your Vercel URL (for CORS).

---

## Interface Previews

- **Landing Hero**: Premium dark interface showcasing event replays.
- **Join Code Flow**: Passcode input fields validating room entries instantly.
- **Live Tracking Map**: Interactive map featuring custom circular avatar nodes.
- **Participant Drawer**: Expanded bottom drawer showing device statuses (battery percentage, speeds).
