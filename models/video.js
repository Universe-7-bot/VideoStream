const mongoose = require("mongoose");

let VideoSchema = new mongoose.Schema({
    user: {
        _id: String,
        name: String,
        image: String,
        subscribers: Number
    },
    filePath: {
        type: String,
    },
    thumbnail: {
        type: String,
    },
    title: {
        type: String
    },
    description: {
        type: String
    },
    tags: {
        type: String,
    },
    category: {
        type: String,
    },
    createdAt: {
        type: Number,
        default: 0
    },
    minutes: {
        type: Number,
        default: 0
    },
    seconds: {
        type: Number,
        default: 0
    },
    hours: {
        type: Number,
        default: 0
    },
    watch: {
        type: Number,
        default: 0
    },
    views: {
        type: Number,
        default: 0
    },
    playlist: {
        type: String
    },
    likers: [],
    dislikers: [],
    comments: []
})

module.exports = mongoose.model("video", VideoSchema);