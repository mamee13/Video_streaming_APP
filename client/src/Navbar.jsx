import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <h2>WebRTC MERN Demo</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/create-stream">
          <button style={{ padding: "6px 12px", background: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Create Stream
          </button>
        </Link>
        <small>Signaling: {import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000"}</small>
      </div>
    </header>
  );
}