import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:4000";
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

  useEffect(() => {
    return () => {
      stopBroadcast();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startBroadcast() {
    try {
      // get camera/mic first (so we can attach tracks to every PC)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // connect socket
      const socket = io(SIGNALING_SERVER);
      socketRef.current = socket;

      socket.on("connect", () => console.log("broadcaster socket connected", socket.id));
      socket.emit("register-broadcaster", { streamId });

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
              try { pc.close(); } catch (e) {}
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
        try { pc.close(); } catch (e) {}
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

  return (
    <div>
      <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%", maxWidth: 720, background: "black" }} />
      <div style={{ marginTop: 8 }}>
        {!publishing ? (
          <button onClick={startBroadcast}>Start Broadcasting</button>
        ) : (
          <button onClick={stopBroadcast}>Stop Broadcasting</button>
        )}
      </div>
    </div>
  );
}
