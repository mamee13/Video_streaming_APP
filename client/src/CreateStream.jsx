import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "./api";

export default function CreateStream() {
  const [title, setTitle] = useState("");
  const navigate = useNavigate();

  async function createStream() {
    try {
      const res = await API.post("/streams", { title });
      navigate(`/broadcast/${res.data._id}`);
    } catch (err) {
      console.warn("Create stream error", err);
    }
  }

  return (
    <div style={{ padding: 12, background: "white", borderRadius: 8, maxWidth: 400, margin: "0 auto" }}>
      <h3>Start broadcasting</h3>
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
            opacity: !title.trim() ? 0.5 : 1,
            cursor: !title.trim() ? "not-allowed" : "pointer"
          }}
        >
          Create & Start Broadcast
        </button>
      </div>
    </div>
  );
}