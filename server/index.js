require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Stream = require('./models/Stream');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());


const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/webrtc_demo';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';


// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Simple REST endpoints for stream metadata
app.post('/streams', async (req, res) => {
try {
const { title, broadcasterId } = req.body;
const s = await Stream.create({ title, broadcasterId, isLive: true });
res.json(s);
} catch (err) {
res.status(500).json({ error: err.message });
}
});


app.get('/streams', async (req, res) => {
try {
const list = await Stream.find({ isLive: true }).sort({ createdAt: -1 });
res.json(list);
} catch (err) {
res.status(500).json({ error: err.message });
}
});


app.post('/streams/:id/stop', async (req, res) => {
try {
await Stream.findByIdAndUpdate(req.params.id, { isLive: false });
res.json({ ok: true });
} catch (err) {
res.status(500).json({ error: err.message });
}
});


const server = http.createServer(app);
const io = new Server(server, {
cors: {
origin: ALLOWED_ORIGIN,
methods: ["GET", "POST"]
}
});

// Keep track of who is broadcaster per streamId
const broadcasters = new Map(); // streamId -> socket.id


io.on('connection', socket => {
console.log('socket connected', socket.id);


socket.on('register-broadcaster', ({ streamId }) => {
broadcasters.set(streamId, socket.id);
socket.join(streamId);
socket.data.streamId = streamId;
socket.data.role = 'broadcaster';
console.log(`Registered broadcaster for stream ${streamId} -> ${socket.id}`);
});


socket.on('join-stream', ({ streamId, role }) => {
socket.join(streamId);
socket.data.streamId = streamId;
socket.data.role = role || 'viewer';
console.log(`${socket.id} joined stream ${streamId} as ${role}`);


// If viewer joined and broadcaster exists, notify broadcaster of new viewer
if (role === 'viewer') {
const bId = broadcasters.get(streamId);
if (bId) {
io.to(bId).emit('viewer-joined', { viewerId: socket.id });
}
}
});

// Viewer sends offer -> server forwards to broadcaster
socket.on('offer', ({ to, streamId, sdp }) => {
// `to` expected to be broadcaster socket id, but if not provided, route to registered broadcaster
const target = to || broadcasters.get(streamId);
if (!target) return;
io.to(target).emit('offer', { from: socket.id, sdp, streamId });
});


// Broadcaster sends answer -> forward to viewer
socket.on('answer', ({ to, streamId, sdp }) => {
if (!to) return;
io.to(to).emit('answer', { from: socket.id, sdp, streamId });
});


// ICE candidates routing
socket.on('ice-candidate', ({ to, candidate }) => {
if (!to) return;
io.to(to).emit('ice-candidate', { from: socket.id, candidate });
});


socket.on('disconnect', () => {
console.log('disconnect', socket.id);
// If a broadcaster disconnects, clear entry and notify room
if (socket.data.role === 'broadcaster') {
const sid = socket.data.streamId;
if (sid && broadcasters.get(sid) === socket.id) {
broadcasters.delete(sid);
io.to(sid).emit('broadcaster-left');
}
}
});
});


server.listen(PORT, () => console.log('Signaling server running on', PORT));