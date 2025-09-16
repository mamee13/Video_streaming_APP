import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <h2>WebRTC MERN Demo</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {user ? (
          <>
            <span>Welcome, {user.name}</span>
            <Link to="/create-stream">
              <button style={{ padding: "6px 12px", background: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                Create Stream
              </button>
            </Link>
            <button onClick={handleLogout} style={{ padding: "6px 12px", background: "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
              Logout
            </button>
          </>
        ) : (
          <small>Signaling: {import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000"}</small>
        )}
      </div>
    </header>
  );
}