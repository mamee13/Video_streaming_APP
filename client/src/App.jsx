import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Home from "./Home";
import CreateStream from "./CreateStream";
import BroadcastPage from "./BroadcastPage";
import ViewPage from "./ViewPage";
import Login from "./Login";
import Signup from "./Signup";
import Profile from "./Profile";
import ProtectedRoute from "./ProtectedRoute";

export default function App() {
  const location = useLocation();
  const isBroadcast = location.pathname.startsWith('/broadcast');

  const isHome = location.pathname === "/";

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isBroadcast && <Navbar />}
      <div style={{ flex: 1, margin: isHome ? 0 : "0 auto", padding: isBroadcast ? 0 : 16, height: isBroadcast ? '100vh' : 'auto' }}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/create-stream" element={<ProtectedRoute><CreateStream /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/broadcast/:streamId" element={<BroadcastPage />} />
          <Route path="/view/:streamId" element={<ViewPage />} />
        </Routes>
      </div>
      {!isBroadcast && <Footer />}
    </div>
  );
}
