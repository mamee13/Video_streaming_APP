const mongoose = require('mongoose');
const StreamSchema = new mongoose.Schema({
    title: String,
    broadcasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isLive: { type: Boolean, default: false },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Stream', StreamSchema);