const mongoose = require('mongoose');
const StreamSchema = new mongoose.Schema({
title: String,
broadcasterId: String,
isLive: { type: Boolean, default: true },
createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Stream', StreamSchema);