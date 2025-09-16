import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "./api";

export default function Home() {
  const [streams, setStreams] = useState([]);
  const [title, setTitle] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchStreams();
  }, []);

  async function fetchStreams() {
    try {
      const res = await API.get("/streams");
      setStreams(res.data || []);
    } catch (err) {
      console.warn("Failed to fetch streams", err);
    }
  }

  async function createStream() {
    try {
      const res = await API.post("/streams", { title });
      navigate(`/broadcast/${res.data._id}`);
      // refresh list so other tabs/devices see it
      fetchStreams();
    } catch (err) {
      console.warn("Create stream error", err);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={{ padding: 12, background: "white", borderRadius: 8 }}>
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
          <button onClick={fetchStreams}>Refresh list</button>
        </div>
      </div>

      <div style={{ padding: 12, background: "white", borderRadius: 8 }}>
        <h3>Live streams</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {streams.length === 0 && <small>No active streams</small>}
          {streams.map((s) => (
            <div key={s._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 6 }}>
              <div>
                <strong>{s.title}</strong>
                <div><small>{new Date(s.createdAt).toLocaleString()}</small></div>
              </div>
              <div>
                <button onClick={() => navigate(`/view/${s._id}`)}>Watch</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}