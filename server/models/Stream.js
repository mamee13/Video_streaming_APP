const mongoose = require('mongoose');
const StreamSchema = new mongoose.Schema({
title: String,
broadcasterId: String,
isLive: { type: Boolean, default: true },
likes: { type: Number, default: 0 },
dislikes: { type: Number, default: 0 },
createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Stream', StreamSchema);