const mongoose = require("mongoose");

let UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    coverPhoto: String,
    image: String,
    subscribers: {
        type: Number,
        default: 0
    },
    subscriptions: [],
    playlists: [],
    videos: [],
    history: [],
    notification: []
})

module.exports = mongoose.model("user", UserSchema);