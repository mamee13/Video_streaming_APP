import React from 'react';

export default function Navbar() {
  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <h2>WebRTC MERN Demo</h2>
      <small>Signaling: {import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000"}</small>
    </header>
  );
}