/**
 * Video Streaming Server
 * Handles WebRTC signaling, stream management, and real-time communication
 * using Express, Socket.IO, and MongoDB.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const Stream = require('./models/Stream');
const User = require('./models/User');
const Comment = require('./models/Comment');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables with defaults
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/webrtc_demo';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// REST API Endpoints for Stream Management

/**
 * Create a new stream
 * POST /streams
 * Body: { title: string, broadcasterId: string }
 */
app.post('/streams', async (req, res) => {
  try {
    const { title, broadcasterId } = req.body;
    const stream = await Stream.create({ title, broadcasterId, isLive: false });
    res.json(stream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all live streams
 * GET /streams
 */
app.get('/streams', async (req, res) => {
  try {
    const streams = await Stream.find({ isLive: true }).sort({ createdAt: -1 });
    res.json(streams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get a specific stream by ID
 * GET /streams/:id
 */
app.get('/streams/:id', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    res.json(stream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Stop a stream
 * POST /streams/:id/stop
 */
app.post('/streams/:id/stop', async (req, res) => {
  try {
    await Stream.findByIdAndUpdate(req.params.id, { isLive: false });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Start a stream
 * POST /streams/:id/start
 */
app.post('/streams/:id/start', async (req, res) => {
  try {
    await Stream.findByIdAndUpdate(req.params.id, { isLive: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get likes and dislikes for a stream
 * GET /streams/:id/reactions
 */
app.get('/streams/:id/reactions', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    res.json({ likes: stream.likes, dislikes: stream.dislikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Like a stream
 * POST /streams/:id/like
 */
app.post('/streams/:id/like', async (req, res) => {
  try {
    const stream = await Stream.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    // Broadcast update to all viewers in the stream room
    io.to(req.params.id).emit('reaction-update', { likes: stream.likes, dislikes: stream.dislikes });
    res.json({ likes: stream.likes, dislikes: stream.dislikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Dislike a stream
 * POST /streams/:id/dislike
 */
app.post('/streams/:id/dislike', async (req, res) => {
  try {
    const stream = await Stream.findByIdAndUpdate(
      req.params.id,
      { $inc: { dislikes: 1 } },
      { new: true }
    );
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    // Broadcast update to all viewers in the stream room
    io.to(req.params.id).emit('reaction-update', { likes: stream.likes, dislikes: stream.dislikes });
    res.json({ likes: stream.likes, dislikes: stream.dislikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API Endpoints for Comments

/**
 * Create a new comment
 * POST /comments
 * Body: { streamId: string, username: string, text: string }
 */
app.post('/comments', async (req, res) => {
  try {
    const { streamId, username, text } = req.body;
    const comment = await Comment.create({ streamId, username, text });
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get comments for a stream
 * GET /comments/:streamId
 */
app.get('/comments/:streamId', async (req, res) => {
  try {
    const comments = await Comment.find({ streamId: req.params.streamId }).sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST']
  }
});

// Track broadcasters per stream (streamId -> socket.id)
const broadcasters = new Map();

// Socket.IO Event Handlers
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  /**
   * Register as broadcaster for a stream
   * Event: register-broadcaster
   * Data: { streamId: string }
   */
  socket.on('register-broadcaster', ({ streamId }) => {
    broadcasters.set(streamId, socket.id);
    socket.join(streamId);
    socket.data.streamId = streamId;
    socket.data.role = 'broadcaster';
    console.log(`Registered broadcaster for stream ${streamId} -> ${socket.id}`);
  });

  /**
   * Join a stream as viewer or broadcaster
   * Event: join-stream
   * Data: { streamId: string, role?: string }
   */
  socket.on('join-stream', ({ streamId, role }) => {
    socket.join(streamId);
    socket.data.streamId = streamId;
    socket.data.role = role || 'viewer';
    console.log(`${socket.id} joined stream ${streamId} as ${socket.data.role}`);

    // Notify broadcaster if a viewer joined
    if (socket.data.role === 'viewer') {
      const broadcasterId = broadcasters.get(streamId);
      if (broadcasterId) {
        io.to(broadcasterId).emit('viewer-joined', { viewerId: socket.id });
      }
    }
  });

  /**
   * Handle WebRTC offer from viewer to broadcaster
   * Event: offer
   * Data: { to?: string, streamId: string, sdp: string }
   */
  socket.on('offer', ({ to, streamId, sdp }) => {
    const target = to || broadcasters.get(streamId);
    if (!target) return;
    io.to(target).emit('offer', { from: socket.id, sdp, streamId });
  });

  /**
   * Handle WebRTC answer from broadcaster to viewer
   * Event: answer
   * Data: { to: string, streamId: string, sdp: string }
   */
  socket.on('answer', ({ to, streamId, sdp }) => {
    if (!to) return;
    io.to(to).emit('answer', { from: socket.id, sdp, streamId });
  });

  /**
   * Handle ICE candidate exchange
   * Event: ice-candidate
   * Data: { to: string, candidate: object }
   */
  socket.on('ice-candidate', ({ to, candidate }) => {
    if (!to) return;
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  /**
   * Handle new comment
   * Event: new-comment
   * Data: { streamId: string, username: string, text: string }
   */
  socket.on('new-comment', async ({ streamId, username, text }) => {
    try {
      // Save comment to database
      const comment = await Comment.create({ streamId, username, text });
      // Broadcast to all in the stream room
      io.to(streamId).emit('comment', comment);
    } catch (err) {
      console.error('Error saving comment:', err);
    }
  });

  /**
   * Handle socket disconnection
   * Event: disconnect
   */
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);

    // If broadcaster disconnected, clean up and notify room
    if (socket.data.role === 'broadcaster') {
      const streamId = socket.data.streamId;
      if (streamId && broadcasters.get(streamId) === socket.id) {
        broadcasters.delete(streamId);
        io.to(streamId).emit('broadcaster-left');
      }
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});