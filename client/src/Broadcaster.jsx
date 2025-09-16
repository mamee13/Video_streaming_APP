import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import API from "./api";
import Navbar from "./Navbar";
import Footer from "./Footer";

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000";
const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function Broadcaster({ streamId, onStop }) {
  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const pcsRef = useRef(new Map());
  const localStreamRef = useRef(null);

  const [publishing, setPublishing] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [username] = useState("Broadcaster");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [streamTitle, setStreamTitle] = useState("Live Broadcast");

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [publishing]);

  async function startBroadcast() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const socket = io(SIGNALING_SERVER);
      socketRef.current = socket;

      socket.on("connect", async () => {
        console.log("broadcaster connected", socket.id);
        socket.emit("register-broadcaster", { streamId });

        try {
          await API.post(`/streams/${streamId}/start`);
          console.log("Stream started");
        } catch (err) {
          console.error("Failed to start stream:", err);
        }

        try {
          const response = await API.get(`/comments/${streamId}`);
          setComments(response.data);
        } catch (err) {
          console.error("Failed to fetch comments:", err);
        }

        try {
          const response = await API.get(`/streams/${streamId}/reactions`);
          setLikes(response.data.likes);
          setDislikes(response.data.dislikes);
        } catch (err) {
          console.error("Failed to fetch reactions:", err);
        }

        try {
          const streamResponse = await API.get(`/streams/${streamId}`);
          setStreamTitle(streamResponse.data.title || "Live Broadcast");
        } catch (err) {
          console.error("Failed to fetch stream:", err);
        }
      });

      socket.on("offer", async ({ from, sdp }) => {
        try {
          const pc = new RTCPeerConnection(ICE_CONFIG);
          pcsRef.current.set(from, pc);

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              socket.emit("ice-candidate", { to: from, candidate: e.candidate });
            }
          };

          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) =>
              pc.addTrack(track, localStreamRef.current)
            );
          }

          await pc.setRemoteDescription({ type: "offer", sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("answer", { to: from, sdp: answer.sdp, streamId });
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      });

      socket.on("ice-candidate", async ({ from, candidate }) => {
        const pc = pcsRef.current.get(from);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socket.on("comment", (comment) => {
        setComments((prev) => [...prev, comment]);
      });

      socket.on("reaction-update", ({ likes, dislikes }) => {
        setLikes(likes);
        setDislikes(dislikes);
      });

      setPublishing(true);
    } catch (err) {
      console.error("startBroadcast error:", err);
    }
  }

  async function stopBroadcast() {
    try {
      await API.post(`/streams/${streamId}/stop`);
      console.log("Stream stopped");
    } catch (err) {
      console.error("Failed to stop stream:", err);
    }

    socketRef.current?.disconnect();
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setPublishing(false);
    if (onStop) onStop();
  }

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    socketRef.current.emit("new-comment", { streamId, username, text: newComment.trim() });
    setNewComment("");
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await localVideoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div style={{ width: "93vw", height: "100vh", display: "flex", flexDirection: "row", background: "#000", margin: 0, padding: 0, overflow: "hidden" }}>
      {/* Video Container */}
      <div style={{ position: "relative", width: "70vw", height: "100vh" }}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "black", display: "block" }}
        />
        {/* Overlay Controls */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", gap: "10px", color: "#fff" }}>
          {!publishing ? <small>Ready</small> : <small style={{ color: "red", fontWeight: "bold" }}>● Broadcasting</small>}
          {!publishing ? (
            <button type="button" onClick={startBroadcast}>Start Broadcasting</button>
          ) : (
            <button type="button" onClick={stopBroadcast}>Stop Broadcasting</button>
          )}
          {publishing && (
            <button onClick={toggleFullscreen}>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</button>
          )}
          {publishing && <button disabled>👍 {likes}</button>}
          {publishing && <button disabled>👎 {dislikes}</button>}
        </div>
      </div>

      {/* Comments */}
      <div style={{ width: "30vw", height: "100vh", background: "#f8f8f8", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 20px 0 20px" }}>
          <h3>Comments</h3>
        </div>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 20px" }}>
          {comments.map((c, i) => (
            <div key={i} style={{ marginBottom: "8px", padding: "10px", borderRadius: "6px", background: "#fff", border: "1px solid #ccc" }}>
              <strong>{c.username}: </strong>{c.text}
              <br />
              <small>{new Date(c.createdAt).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 20px 20px 20px" }}>
          <form onSubmit={handlePostComment} style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Type a comment..."
              style={{ flex: 1 }}
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
