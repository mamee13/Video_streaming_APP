import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "./api";

export default function Home() {
  const [streams, setStreams] = useState([]);
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


  const liveStreams = streams.filter(s => s.isLive);

  return (
    <div style={{ padding: 12, width: '100%', margin: 0 }}>
      <h3>Live streams</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
        {liveStreams.length === 0 && <small>No active streams</small>}
        {liveStreams.map((s) => (
          <div key={s._id} style={{ background: "white", borderRadius: 8, padding: 12, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", cursor: "pointer" }} onClick={() => navigate(`/view/${s._id}`)}>
            <div style={{ width: "100%", height: 150, background: "#f0f0f0", borderRadius: 4, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#666" }}>Stream Thumbnail</span>
            </div>
            <h4 style={{ margin: 0, marginBottom: 4 }}>{s.title}</h4>
            <small>by {s.broadcasterId?.username || 'Unknown'}</small>
            <br />
            <small>{new Date(s.createdAt).toLocaleString()}</small>
            <div style={{ marginTop: 8 }}>
              <button style={{ width: "100%", padding: "6px 0", background: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>Watch Live</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={fetchStreams} style={{ marginTop: 12, padding: "8px 16px", background: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>Refresh</button>
    </div>
  );
}