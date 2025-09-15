import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import API from "./api";

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000";
const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // add TURN here for production
  ],
};

export default function Viewer({ streamId }) {
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const broadcasterIdRef = useRef(null);

  // candidate queues for safety (buffer until remote desc or broadcaster id known)
  const outgoingCandidatesRef = useRef([]); // local -> remote
  const incomingCandidatesRef = useRef([]); // remote -> local (buffer until remote desc set)

  const [connected, setConnected] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [username, setUsername] = useState(`Viewer${Math.floor(Math.random() * 1000)}`);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const socket = io(SIGNALING_SERVER);
        socketRef.current = socket;

        socket.on("connect", async () => {
          console.log("viewer connected", socket.id);
          socket.emit("join-stream", { streamId, role: "viewer" });

          // Fetch existing comments
          try {
            const response = await API.get(`/comments/${streamId}`);
            setComments(response.data);
          } catch (err) {
            console.error("Failed to fetch comments:", err);
          }
        });

        // set up RTCPeerConnection
        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcRef.current = pc;

        pc.ontrack = (e) => {
          // attach first stream
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        };

        // when we have local ICE candidates (viewer side) -> send to broadcaster (when known)
        pc.onicecandidate = (e) => {
          if (!e.candidate) return;
          const candidate = e.candidate;
          if (broadcasterIdRef.current) {
            socket.emit("ice-candidate", { to: broadcasterIdRef.current, candidate });
          } else {
            outgoingCandidatesRef.current.push(candidate);
          }
        };

        // handle ICE candidates forwarded from broadcaster
        socket.on("ice-candidate", async ({ from, candidate }) => {
          if (!candidate) return;
          if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("Failed to add incoming candidate immediately:", e);
            }
          } else {
            incomingCandidatesRef.current.push(candidate);
          }
        });

        // If broadcaster uses offer pattern and sends an offer, handle it
        socket.on("offer", async ({ from, sdp }) => {
          try {
            broadcasterIdRef.current = from;
            await pcRef.current.setRemoteDescription({ type: "offer", sdp });

            // create answer
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            socket.emit("answer", { to: from, sdp: answer.sdp, streamId });

            // flush outgoing candidates
            outgoingCandidatesRef.current.forEach((c) => {
              socket.emit("ice-candidate", { to: from, candidate: c });
            });
            outgoingCandidatesRef.current = [];

            // flush incoming candidates
            for (const c of incomingCandidatesRef.current) {
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn(e); }
            }
            incomingCandidatesRef.current = [];

            setConnected(true);
          } catch (e) {
            console.error("Error handling offer:", e);
          }
        });

        // When broadcaster answers our offer
        socket.on("answer", async ({ from, sdp }) => {
          try {
            broadcasterIdRef.current = from;
            // set remote description
            await pcRef.current.setRemoteDescription({ type: "answer", sdp });

            // flush outgoing candidates
            outgoingCandidatesRef.current.forEach((c) => {
              socket.emit("ice-candidate", { to: from, candidate: c });
            });
            outgoingCandidatesRef.current = [];

            // flush incoming candidates
            for (const c of incomingCandidatesRef.current) {
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn(e); }
            }
            incomingCandidatesRef.current = [];

            setConnected(true);
          } catch (e) {
            console.warn("Failed to set remote answer:", e);
          }
        });

        // Listen for new comments
        socket.on("comment", (comment) => {
          setComments(prev => [...prev, comment]);
        });

        // Create recvonly transceivers to ensure offer contains m= lines
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        // create viewer offer and send to registered broadcaster (server will route to broadcaster for this streamId)
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: null, streamId, sdp: offer.sdp });

        // cleanup on unmount
      } catch (err) {
        console.error("Viewer init error:", err);
      }
    })();

    return () => {
      mounted = false;
      try { socketRef.current?.disconnect(); } catch (e) {}
      try { pcRef.current?.close(); } catch (e) {}
    };
  }, [streamId]);

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

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await remoteVideoRef.current.requestFullscreen();
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
        <video ref={remoteVideoRef} autoPlay playsInline controls={false} style={{ width: "100%", maxWidth: 720, background: "black" }} />
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!connected ? <small>Connecting...</small> : <small>Live</small>}
          <button onClick={toggleFullscreen} style={{ padding: '5px 10px', cursor: 'pointer' }}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
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
