import React from 'react';

export default function Navbar() {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h2>WebRTC MERN Demo</h2>
      <small>Signaling: {import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000"}</small>
    </header>
  );
}