import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Home from "./Home";
import BroadcastPage from "./BroadcastPage";
import ViewPage from "./ViewPage";

export default function App() {
  const location = useLocation();
  const isBroadcast = location.pathname.startsWith('/broadcast');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isBroadcast && <Navbar />}
      <div style={{ flex: 1, margin: "0 auto", padding: isBroadcast ? 0 : 16, height: isBroadcast ? '100vh' : 'auto' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/broadcast/:streamId" element={<BroadcastPage />} />
          <Route path="/view/:streamId" element={<ViewPage />} />
        </Routes>
      </div>
      {!isBroadcast && <Footer />}
    </div>
  );
}
