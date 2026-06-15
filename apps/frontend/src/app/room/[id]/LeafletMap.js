"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom avatar marker icon factory
function createAvatarIcon(initials, color, isUser, isActive, name) {
  const borderColor = isUser ? "#FFFFFF" : color;
  const bgColor = isUser ? "#4F9CF9" : "#171A20";
  const dotColor = isActive ? "#00E5A0" : "#A1A7B3";
  const displayName = isUser ? "You" : name;

  const html = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      ${isUser ? `<div style="position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(79,156,249,0.2);top:-4px;left:-4px;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` : `<div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(0,229,160,0.15);top:0;left:0;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>`}
      <div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;background:${bgColor};border:2px solid ${borderColor};box-shadow:0 4px 20px rgba(0,0,0,0.5);position:relative;z-index:2;">
        ${initials}
        <span style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:${dotColor};border:2px solid #0F1115;"></span>
      </div>
      <div style="width:10px;height:10px;transform:rotate(45deg);margin-top:-6px;background:${bgColor};border-right:2px solid ${borderColor};border-bottom:2px solid ${borderColor};z-index:1;"></div>
      <div style="margin-top:2px;background:rgba(23,26,32,0.9);border:1px solid rgba(255,255,255,0.1);padding:2px 8px;border-radius:6px;backdrop-filter:blur(8px);z-index:2;">
        <span style="font-size:9px;font-weight:600;color:#fff;white-space:nowrap;letter-spacing:0.05em;">${displayName}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-avatar-marker",
    iconSize: [40, 72],
    iconAnchor: [20, 58],
    popupAnchor: [0, -58]
  });
}

// Component that pans the map to a target position
function MapController({ center, zoom, flyTo }) {
  const map = useMap();

  useEffect(() => {
    if (flyTo) {
      map.flyTo(center, zoom, { duration: 0.8, easeLinearity: 0.25 });
    }
  }, [flyTo, center, zoom, map]);

  return null;
}

// Animated marker wrapper that updates position smoothly
function AnimatedMarker({ participant, onClick, isSelected }) {
  const markerRef = useRef(null);

  const icon = useMemo(
    () => createAvatarIcon(
      participant.initials,
      participant.color,
      participant.isUser,
      participant.status !== "Stationary",
      participant.name
    ),
    [participant.initials, participant.color, participant.isUser, participant.status, participant.name]
  );

  // Smoothly update marker position when lat/lng change
  useEffect(() => {
    if (markerRef.current) {
      const marker = markerRef.current;
      const targetLatLng = L.latLng(participant.lat, participant.lng);
      // Use smooth setLatLng for gentle movement
      marker.setLatLng(targetLatLng);
    }
  }, [participant.lat, participant.lng]);

  return (
    <Marker
      ref={markerRef}
      position={[participant.lat, participant.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onClick(participant)
      }}
    >
      <Popup className="custom-popup">
        <div style={{ background: "#171A20", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "12px 16px", minWidth: "160px", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: participant.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700" }}>
              {participant.initials}
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>{participant.name}</div>
              <div style={{ fontSize: "10px", color: "#A1A7B3" }}>{participant.status}</div>
            </div>
          </div>
          <div style={{ fontSize: "10px", color: "#A1A7B3", display: "flex", alignItems: "center", gap: "4px" }}>
            🔋 {participant.battery}%
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function LeafletMap({
  participants,
  selectedUser,
  onSelectUser,
  flyToTarget,
  mapCenter,
  mapZoom
}) {
  return (
    <>
      {/* Inject keyframes + Leaflet overrides */}
      <style jsx global>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .custom-avatar-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-container {
          background: #0F1115 !important;
          font-family: system-ui, sans-serif;
        }
        /* Dark popup styles */
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 16px !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip {
          display: none !important;
        }
        /* Hide default Leaflet controls */
        .leaflet-control-zoom {
          display: none !important;
        }
        .leaflet-control-attribution {
          background: rgba(15, 17, 21, 0.8) !important;
          color: rgba(161, 167, 179, 0.5) !important;
          font-size: 9px !important;
          backdrop-filter: blur(8px);
          border-radius: 8px 0 0 0 !important;
          border: none !important;
        }
        .leaflet-control-attribution a {
          color: rgba(79, 156, 249, 0.5) !important;
        }
      `}</style>

      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        zoomControl={false}
        attributionControl={true}
        style={{ width: "100%", height: "100%", zIndex: 0 }}
      >
        {/* CartoDB Dark Matter — free dark theme without 401 errors on Vercel */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />

        {/* Map controller for fly-to animations */}
        <MapController
          center={flyToTarget || mapCenter}
          zoom={flyToTarget ? 16 : mapZoom}
          flyTo={!!flyToTarget}
        />

        {/* Participant markers */}
        {participants.map((p) => (
          <AnimatedMarker
            key={p.id}
            participant={p}
            onClick={onSelectUser}
            isSelected={selectedUser?.id === p.id}
          />
        ))}
      </MapContainer>
    </>
  );
}
