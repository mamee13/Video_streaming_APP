import React, { useEffect, useState } from "react";
import API from "./api";
import Broadcaster from "./Broadcaster";
import Viewer from "./Viewer";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function App() {
  const [streams, setStreams] = useState([]);
  const [title, setTitle] = useState("My Live Stream");
  const [mode, setMode] = useState(null); // 'broadcaster' | 'viewer'
  const [currentStream, setCurrentStream] = useState(null);

  useEffect(() => {
    fetchStreams();
    // optional: poll every 10s
    // const id = setInterval(fetchStreams, 10000);
    // return () => clearInterval(id);
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
      setCurrentStream(res.data);
      setMode("broadcaster");
      // refresh list so other tabs/devices see it
      fetchStreams();
    } catch (err) {
      console.warn("Create stream error", err);
    }
  }

  async function stopStream() {
    if (!currentStream) return;
    try {
      await API.post(`/streams/${currentStream._id}/stop`);
    } catch (err) {
      console.warn("Stop stream error", err);
    } finally {
      setMode(null);
      setCurrentStream(null);
      fetchStreams();
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, maxWidth: 1000, margin: "0 auto", padding: 16 }}>
        {!mode && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, background: "white", borderRadius: 8 }}>
              <h3>Start broadcasting</h3>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 6, border: "1px solid #ddd" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={createStream}>Create & Start Broadcast</button>
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
                      <button onClick={() => { setCurrentStream(s); setMode("viewer"); }}>Watch</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === "broadcaster" && currentStream && (
          <div style={{ marginTop: 12, padding: 12, background: "white", borderRadius: 8 }}>
            <h3>Broadcaster — {currentStream.title}</h3>
            <Broadcaster streamId={currentStream._id} onStop={stopStream} />
          </div>
        )}

        {mode === "viewer" && currentStream && (
          <div style={{ marginTop: 12, padding: 12, background: "white", borderRadius: 8 }}>
            <h3>Viewer — {currentStream.title}</h3>
            <Viewer streamId={currentStream._id} />
            <div style={{ marginTop: 8 }}>
              <button onClick={() => { setMode(null); setCurrentStream(null); }}>Back</button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
