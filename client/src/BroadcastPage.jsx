import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "./api";
import Broadcaster from "./Broadcaster";

export default function BroadcastPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStream();
  }, [streamId]);

  async function fetchStream() {
    try {
      const res = await API.get(`/streams/${streamId}`);
      setStream(res.data);
    } catch (err) {
      console.warn("Failed to fetch stream", err);
      navigate("/");
    } finally {
      setLoading(false);
    }
  }

  async function stopStream() {
    if (!stream) return;
    try {
      await API.post(`/streams/${stream._id}/stop`);
    } catch (err) {
      console.warn("Stop stream error", err);
    } finally {
      navigate("/");
    }
  }

  if (loading) return <div>Loading...</div>;
  if (!stream) return <div>Stream not found</div>;

  return (
    <div>
      <h3>Broadcaster — {stream.title}</h3>
      <Broadcaster streamId={stream._id} onStop={stopStream} />
    </div>
  );
}