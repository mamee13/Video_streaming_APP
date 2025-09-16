import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "./api";
import { useAuth } from "./AuthContext";

export default function CreateStream() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const navigate = useNavigate();

  async function createStream() {
    try {
      const res = await API.post("/streams", { title, broadcasterId: user._id });
      navigate(`/broadcast/${res.data._id}`);
    } catch (err) {
      console.warn("Create stream error", err);
    }
  }

  return (
    <div style={{ padding: 12, width: '100%', margin: 0 }}>
      <h3>Start broadcasting</h3>
      <div style={{ background: "white", borderRadius: 8, padding: 12, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", maxWidth: 400, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
          Stream Title: <span style={{ color: "red" }}>*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter your stream title..."
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: !title.trim() ? "2px solid #ff6b6b" : "1px solid #ddd",
            fontSize: "16px"
          }}
        />
        {!title.trim() && (
          <small style={{ color: "#ff6b6b", marginTop: 4, display: "block" }}>
            Stream title is required
          </small>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={createStream}
          disabled={!title.trim()}
          style={{
            width: "100%",
            padding: "6px 0",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: !title.trim() ? "not-allowed" : "pointer",
            opacity: !title.trim() ? 0.5 : 1
          }}
        >
          Create & Start Broadcast
        </button>
      </div>
      </div>
    </div>
  );
}