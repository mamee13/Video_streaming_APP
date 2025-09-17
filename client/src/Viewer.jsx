import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import API from "./api";
import { useAuth } from "./AuthContext";

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000";
const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

export default function Viewer({ streamId }) {
  const { user } = useAuth();
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const broadcasterIdRef = useRef(null);

  const outgoingCandidatesRef = useRef([]);
  const incomingCandidatesRef = useRef([]);

  const [connected, setConnected] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [username] = useState(user?.username || "");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [stream, setStream] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const socket = io(SIGNALING_SERVER);
        socketRef.current = socket;

        socket.on("connect", async () => {
          console.log("viewer connected", socket.id);
          socket.emit("join-stream", { streamId, role: "viewer" });

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
            const response = await API.get(`/streams/${streamId}`);
            setStream(response.data);
            if (user && response.data.broadcasterId) {
              // Check if following
              const profileRes = await API.get('/profile');
              setIsFollowing(profileRes.data.following.some(f => f._id === response.data.broadcasterId._id));
            }
          } catch (err) {
            console.error("Failed to fetch stream:", err);
          }
        });

        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcRef.current = pc;

        pc.ontrack = (e) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            if (broadcasterIdRef.current) {
              socket.emit("ice-candidate", { to: broadcasterIdRef.current, candidate: e.candidate });
            } else {
              outgoingCandidatesRef.current.push(e.candidate);
            }
          }
        };

        socket.on("ice-candidate", async ({ candidate }) => {
          if (!candidate) return;
          if (pcRef.current?.remoteDescription?.type) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("Failed to add remote candidate:", e);
            }
          } else {
            incomingCandidatesRef.current.push(candidate);
          }
        });

        socket.on("offer", async ({ from, sdp }) => {
          broadcasterIdRef.current = from;
          await pc.setRemoteDescription({ type: "offer", sdp });

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", { to: from, sdp: answer.sdp, streamId });

          outgoingCandidatesRef.current.forEach((c) => {
            socket.emit("ice-candidate", { to: from, candidate: c });
          });
          outgoingCandidatesRef.current = [];

          for (const c of incomingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          incomingCandidatesRef.current = [];

          setConnected(true);
        });

        socket.on("answer", async ({ from, sdp }) => {
          broadcasterIdRef.current = from;
          await pc.setRemoteDescription({ type: "answer", sdp });

          outgoingCandidatesRef.current.forEach((c) => {
            socket.emit("ice-candidate", { to: from, candidate: c });
          });
          outgoingCandidatesRef.current = [];

          for (const c of incomingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          incomingCandidatesRef.current = [];

          setConnected(true);
        });

        socket.on("comment", (comment) => {
          setComments((prev) => [...prev, comment]);
        });

        socket.on("reaction-update", ({ likes, dislikes }) => {
          setLikes(likes);
          setDislikes(dislikes);
        });

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: null, streamId, sdp: offer.sdp });

      } catch (err) {
        console.error("Viewer init error:", err);
      }
    })();

    return () => {
      try { socketRef.current?.disconnect(); } catch (e) {}
      try { pcRef.current?.close(); } catch (e) {}
    };
  }, [streamId]);

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!user) {
      alert("You must be logged in to comment.");
      return;
    }
    socketRef.current.emit("new-comment", { streamId, username, text: newComment.trim() });
    setNewComment("");
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await remoteVideoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (remoteVideoRef.current) remoteVideoRef.current.volume = v;
    if (v > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => {
    if (remoteVideoRef.current) {
      const newMuted = !isMuted;
      remoteVideoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) setVolume(0);
    }
  };

  const handleLike = async () => {
    const res = await API.post(`/streams/${streamId}/like`);
    setLikes(res.data.likes);
    setDislikes(res.data.dislikes);
  };

  const handleDislike = async () => {
    const res = await API.post(`/streams/${streamId}/dislike`);
    setLikes(res.data.likes);
    setDislikes(res.data.dislikes);
  };

  const handleFollow = async () => {
    if (!user || !stream) return;
    try {
      if (isFollowing) {
        await API.post(`/users/${stream.broadcasterId._id}/unfollow`);
        setIsFollowing(false);
      } else {
        await API.post(`/users/${stream.broadcasterId._id}/follow`);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error("Failed to follow/unfollow:", err);
    }
  };

return (
  <div style={{ width: "93vw", height: "100vh", display: "flex", flexDirection: "row", background: "#000", margin: 0, padding: 0, overflow: "hidden" }}>

    {/* Video Container */}
    <div style={{ position: "relative", width: "70vw", height: "100vh" }}>
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "black",
          display: "block",
        }}
      />
      {/* Overlay Controls */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", gap: "10px", color: "#fff" }}>
        {!connected ? <small>Connecting...</small> : <small style={{ color: "red", fontWeight: "bold" }}>● Live</small>}
        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
        <input type="range" min="0" max="1" step="0.1" value={volume} onChange={handleVolumeChange} />
        <button onClick={toggleFullscreen}>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</button>
        <button onClick={handleLike}>👍 {likes}</button>
        <button onClick={handleDislike}>👎 {dislikes}</button>
        {user && stream && (
          <button
            onClick={handleFollow}
            style={{
              backgroundColor: isFollowing ? '#007bff' : '#28a745',
              color: '#fff',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
    </div>

    {/* Comments */}
    <div style={{ width: "30vw", height: "100vh", background: "#f8f8f8", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 0 20px" }}>
        <h3>Comments</h3>
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 20px" }}>
        <div style={{ border: "1px solid #ccc", padding: "10px", borderRadius: "6px", background: "#fff" }}>
          {comments.map((c, i) => (
            <div key={i} style={{ marginBottom: "8px" }}>
              <strong>{c.username}: </strong>{c.text}
              <br />
              <small>{new Date(c.createdAt).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "10px 20px 20px 20px" }}>
        <form onSubmit={handlePostComment} style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={user ? "Type a comment..." : "Login to comment..."}
            style={{ flex: 1 }}
            disabled={!user}
          />
          <button type="submit" disabled={!user}>Send</button>
        </form>
      </div>
    </div>
  </div>
);
}