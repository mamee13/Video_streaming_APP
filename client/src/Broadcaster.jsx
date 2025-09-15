import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import API from "./api";

const SIGNALING_SERVER =
  import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000";

const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // add TURN server here in production
    // { urls: "turn:turn.example.com:3478", username: "user", credential: "pass" }
  ],
};

export default function Broadcaster({ streamId, onStop }) {
  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const pcsRef = useRef(new Map()); // viewerId -> RTCPeerConnection
  const localStreamRef = useRef(null);

  const [publishing, setPublishing] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [username, setUsername] = useState("Broadcaster");
  const [volume, setVolume] = useState(0); // Start muted
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Make sure local video updates when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [publishing]);

  async function startBroadcast() {
    try {
      // get camera/mic first (so we can attach tracks to every PC)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // connect socket
      const socket = io(SIGNALING_SERVER);
      socketRef.current = socket;

      socket.on("connect", async () => {
        console.log("broadcaster socket connected", socket.id);
        socket.emit("register-broadcaster", { streamId });

        // Fetch existing comments
        try {
          const response = await API.get(`/comments/${streamId}`);
          setComments(response.data);
        } catch (err) {
          console.error("Failed to fetch comments:", err);
        }
      });

      // viewer -> sends offer (from viewerId)
      socket.on("offer", async ({ from, sdp }) => {
        try {
          console.log("Received offer from viewer", from);

          // create PC for this viewer
          const pc = new RTCPeerConnection(ICE_CONFIG);
          pcsRef.current.set(from, pc);

          // send any ICE candidates to the viewer
          pc.onicecandidate = (e) => {
            if (e.candidate) {
              socket.emit("ice-candidate", { to: from, candidate: e.candidate });
            }
          };

          pc.onconnectionstatechange = () => {
            const st = pc.connectionState;
            if (st === "failed" || st === "closed" || st === "disconnected") {
              try {
                pc.close();
              } catch (e) {}
              pcsRef.current.delete(from);
            }
          };

          // publish local tracks to this peer
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
              pc.addTrack(track, localStreamRef.current);
            });
          }

          await pc.setRemoteDescription({ type: "offer", sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // send answer back to viewer
          socket.emit("answer", { to: from, sdp: answer.sdp, streamId });
          console.log("Sent answer to", from);
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      });

      // viewer -> emits ice-candidate (forwarded by server)
      socket.on("ice-candidate", async ({ from, candidate }) => {
        const pc = pcsRef.current.get(from);
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn("Failed to add remote candidate at broadcaster:", e);
          }
        }
      });

      socket.on("disconnect", () => {
        console.log("socket disconnected");
      });

      // Listen for new comments
      socket.on("comment", (comment) => {
        setComments(prev => [...prev, comment]);
      });

      setPublishing(true);
    } catch (err) {
      console.error("startBroadcast error:", err);
    }
  }

  function stopBroadcast() {
    try {
      socketRef.current?.disconnect();
    } catch (e) {}

    try {
      pcsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch (e) {}
      });
      pcsRef.current.clear();
    } catch (e) {}

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    setPublishing(false);
    if (onStop) onStop();
  }

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      socketRef.current.emit("new-comment", {
        streamId,
        username,
        text: newComment.trim()
      });
      setNewComment("");
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (localVideoRef.current) {
      localVideoRef.current.volume = newVolume;
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (localVideoRef.current) {
      const newMuted = !isMuted;
      localVideoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(localVideoRef.current.volume || 1);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await localVideoRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Failed to exit fullscreen:', err);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div style={{ display: "flex", gap: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ flex: 1 }}>
        <h2 className="text-lg font-bold mb-2">Broadcasting</h2>

        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            maxWidth: 720,
            background: "black",
            borderRadius: "8px",
          }}
        />

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {!publishing ? (
            <button type="button" onClick={startBroadcast}>
              Start Broadcasting
            </button>
          ) : (
            <button type="button" onClick={stopBroadcast}>
              Stop Broadcasting
            </button>
          )}
          {publishing && (
            <>
              <button onClick={toggleMute} style={{ padding: '5px 10px', cursor: 'pointer' }}>
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                style={{ width: '100px' }}
              />
              <button onClick={toggleFullscreen} style={{ padding: '5px 10px', cursor: 'pointer' }}>
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: "400px" }}>
        <h3>Comments</h3>
        <div className="comments-section">
          <div className="comments-list">
            {comments.map((comment, index) => (
              <div key={index} className="comment">
                <strong>{comment.username}:</strong> {comment.text}
                <br />
                <small>{new Date(comment.createdAt).toLocaleTimeString()}</small>
              </div>
            ))}
          </div>

          <form onSubmit={handlePostComment} className="comment-form">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Type a comment..."
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
