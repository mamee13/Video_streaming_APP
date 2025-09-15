import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

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

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const socket = io(SIGNALING_SERVER);
        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("viewer connected", socket.id);
          socket.emit("join-stream", { streamId, role: "viewer" });
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

  return (
    <div>
      <video ref={remoteVideoRef} autoPlay playsInline controls={false} style={{ width: "100%", maxWidth: 720, background: "black" }} />
      <div style={{ marginTop: 8 }}>
        {!connected ? <small>Connecting...</small> : <small>Live</small>}
      </div>
    </div>
  );
}
