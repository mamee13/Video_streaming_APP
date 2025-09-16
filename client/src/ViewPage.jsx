import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "./api";
import Viewer from "./Viewer";

export default function ViewPage() {
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

  if (loading) return <div>Loading...</div>;
  if (!stream) return <div>Stream not found</div>;

  return (
    <div style={{ marginTop: 80, padding: 12, background: "white", borderRadius: 8 }}>
      <h3>Viewer — {stream.title}</h3>
      <Viewer streamId={stream._id} />
      <div style={{ marginTop: 8 }}>
        <button onClick={() => navigate("/")}>Back</button>
      </div>
    </div>
  );
}