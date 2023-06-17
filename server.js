const express = require("express");
const app = express();
const bodyParser = require("body-parser"); //handling http post requests
const bcrypt = require("bcrypt");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();
const formidable = require("formidable");
const fs = require("fs");
const mv = require("mv");
const { getVideoDurationInSeconds } = require("get-video-duration")
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const user = require("./models/user.js");
const video = require("./models/video.js");

mongoose.set('strictQuery', false);
mongoose.connect(process.env.DB_URL).then(() => {
    console.log("Connected with database");
}).catch((err) => {
    console.log(err);
})

app.use(session({ //session middleware
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } //in ms
}))
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/static"));
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", async (req, res) => {
    try {
        const videos = await video.find({}).sort({ createdAt: -1 }); //returns all the documents present in the video collection sorted in descending order according to createdAt field and stores it to an array which can be accessed by videos parameter

        res.render("index", { isAuthenticated: req.session.userid ? true : false, videos: videos });
    } catch (err) {
        console.log(err);
    }
})

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/signup", (req, res) => {
    res.render("signup");
})

app.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.json({ msg: "Please fill in all fields", code: 501 });
        }
        const existingUser = await user.findOne({ email });
        if (existingUser) {
            return res.json({ msg: "User already exists", code: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new user({
            name,
            email,
            password: hashedPassword,
            coverPhoto: "",
            image: "",
            subscribers: 0,
            subscriptions: [],
            playlists: [],
            videos: [],
            history: [],
            notification: []
        });
        await newUser.save();
        res.json({ msg: "User created successfully", code: 201 })
    } catch (err) {
        res.json({ msg: err.message, code: 500 });
    }
})

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.json({ msg: "Please fill in all fields", code: 501 });
        }

        const existingUser = await user.findOne({ email });
        if (!existingUser) {
            return res.json({ msg: "User does not exist", code: 404 });
        }

        const isValidPassword = await bcrypt.compare(password, existingUser.password);
        if (!isValidPassword) {
            return res.json({ msg: "Invalid password", code: 401 });
        }

        //login successful
        req.session.userid = existingUser._id;
        // req.session.isLoggedIn = true;
        res.json({ msg: "Login successful", code: 200 });
    } catch (err) {
        res.json({ msg: err.message, code: 500 }); //failed to login
    }
})

app.get("/logout", (req, res) => {
    try {
        // console.log(req.session);
        // req.session.isLoggedIn = false;
        req.session.destroy((err) => {
            if (err) {
                // console.log(err);
                res.json({ msg: "Failed to logout", code: 500 });
            }
        })
        res.redirect("/");
    } catch (err) {
        res.json({ msg: err.message, code: 501 });
    }
})

app.get("/upload", (req, res) => {
    if (req.session.userid) { //authenticated user
        res.render("upload", { isAuthenticated: true });
    }
    else {
        res.redirect("/");
    }
})

app.post("/upload-video", async (req, res) => {
    try {
        if (req.session.userid) {
            const form = new formidable.IncomingForm();
            form.parse(req, (err, fields, files) => {
                if (err) {
                    return res.json({ msg: "Error parsing form data", code: 500 });
                }

                // console.log(files.video.filepath, files.thumbnail.filepath, fields.title, fields.description, fields.tags, fields.category)
                if (!files.video || !files.thumbnail) {
                    return res.json({ msg: "Select all the fields", code: 500 });
                }
                const videoPath = files.video.filepath;
                const thumbnailPath = files.thumbnail.filepath;
                const title = fields.title;
                const description = fields.description;
                const tags = fields.tags;
                const category = fields.category;
                // console.log(files.video, files.thumbnail);

                if (!title || !description || !tags || !category) {
                    return res.json({ msg: "Select all the fields", code: 500 });
                }

                const newThumbnailPath = "static/thumbnails/" + new Date().getTime() + "-" + files.thumbnail.originalFilename;
                // console.log(thumbnailPath, newThumbnailPath);
                mv(thumbnailPath, newThumbnailPath, (err) => {
                    if (err) console.log(err);
                })

                const newVideoPath = "static/videos/" + new Date().getTime() + "-" + files.video.originalFilename;
                // console.log(videoPath, newVideoPath);
                mv(videoPath, newVideoPath, async (err) => {
                    if (err) console.log(err);
                    const existingUser = await user.findById(req.session.userid);
                    // console.log(existingUser);
                    let currentTime = new Date().getTime();
                    const videoDuration = await getVideoDurationInSeconds(newVideoPath);
                    let hours = Math.floor(videoDuration / 3600);
                    let minutes = Math.floor(videoDuration / 60) - (hours * 60);
                    let seconds = Math.floor(videoDuration % 60);

                    const newVideo = new video({
                        user: {
                            _id: existingUser._id,
                            name: existingUser.name,
                            image: existingUser.image,
                            subscribers: existingUser.subscribers
                        },
                        filePath: newVideoPath,
                        thumbnail: newThumbnailPath,
                        title: title,
                        description: description,
                        tags: tags,
                        category: category,
                        createdAt: currentTime,
                        minutes: minutes,
                        seconds: seconds,
                        hours: hours,
                        watch: currentTime,
                        views: 0,
                        playlist: "",
                        likers: [],
                        dislikers: [],
                        comment: []
                    })
                    await newVideo.save();
                    user.findByIdAndUpdate(req.session.userid, {
                        $push: {
                            videos: {
                                _id: existingUser._id,
                                title: title,
                                views: 0,
                                thumbnail: newThumbnailPath,
                                watch: currentTime
                            }
                        }
                    }).then((updatedUser) => {
                        // console.log(updatedUser);
                    }).catch((error) => {
                        console.log(error);
                    })

                    res.json({ msg: "Video uploaded successfully", code: 400 })
                })
            })
        }
        else {
            res.redirect("/login");
        }
    } catch (err) {
        res.json({ msg: err.message, code: 500 })
    }
})

app.get("/watch/:watch", async (req, res) => {
    try {
        if (req.session.userid) {
            const Video = await video.findOne({ watch: req.params.watch });
            if (Video) {
                video.findByIdAndUpdate(Video._id, {
                    $inc: {
                        views: 1
                    }
                }).then((Video) => {

                }).catch((error) => {
                    console.log(error);
                })
                res.render("video-page", { isAuthenticated: req.session.userid ? true : false, video: Video });
            }
            else {
                res.json({ msg: "Video does not exist", code: 500 });
            }
        }
        else {
            res.redirect("/");
        }
    } catch (err) {
        res.json({ msg: err.message, code: 501 });
    }
})

app.post("/do-like", (req, res) => {
    if (req.session.userid) {
        video.findOne({ //and operator is used to find by two fields
            $and: [{
                _id: req.body.videoId
            },
            {
                likers: {
                    _id: req.session.userid
                }
            }]
        }).then((Video) => {
            if (Video) {
                res.json({ msg: "Already liked this video", code: 500 });
            }
            else {
                video.findByIdAndUpdate(req.body.videoId, {
                    $push: {
                        likers: {
                            _id: req.session.userid
                        }
                    }
                }).then((Video) => {
                    res.json({ msg: "Video has been liked", code: 400, likeCount: Video.likers.length });
                })
            }
        }).catch((error) => {
            console.log(error);
        })
    }
    else {
        res.redirect("/");
    }
})

app.post("/do-dislike", (req, res) => {
    if (req.session.userid) {
        video.findOne({ //and operator is used to find by two fields
            $and: [{
                _id: req.body.videoId
            },
            {
                dislikers: {
                    _id: req.session.userid
                }
            }]
        }).then((Video) => {
            if (Video) {
                res.json({ msg: "Already disliked this video", code: 500 });
            }
            else {
                video.findByIdAndUpdate(req.body.videoId, {
                    $push: {
                        dislikers: {
                            _id: req.session.userid
                        }
                    }
                }).then((Video) => {
                    res.json({ msg: "Video has been disliked", code: 400, dislikeCount: Video.dislikers.length });
                })

            }
        }).catch((error) => {
            console.log(error);
        })
    }
    else {
        res.redirect("/");
    }
})

app.post("/do-comment", (req, res) => {
    try {
        if (req.session.userid) {
            if (req.body.comment.trim() == "") { //trim() removes leading and trailing spaces
                return res.json({ msg: "Please enter a comment", code: 300 })
            }
            user.findById(req.session.userid).then((User) => {
                // console.log(user); //commenter
                video.findByIdAndUpdate(req.body.videoId, {
                    $push: {
                        comments: {
                            _id: new mongoose.Types.ObjectId(), //generates a new id
                            user: {
                                _id: User._id,
                                name: User.name,
                                image: User.image
                            },
                            comment: req.body.comment,
                            createdAt: new Date().getTime(),
                            replies: []
                        }
                    }
                }).then((video) => {
                    // console.log(video);
                    // const newCommentIndex = video.comments.length - 1;
                    // const commentID = video.comments[newCommentIndex]._id;
                    user.findByIdAndUpdate(video.user._id, { //sending notification to the video publisher
                        $push: {
                            notification: {
                                _id: new mongoose.Types.ObjectId(),
                                type: "new_comment",
                                content: req.body.comment,
                                is_read: false,
                                video_watch: video.watch,
                                user: {
                                    _id: User._id,
                                    name: User.name,
                                    image: User.image
                                }
                            }
                        }
                    }).then((updatedUser) => {
                        // console.log(updatedUser);
                        res.json({
                            msg: "Comment has been posted", code: 400, user: {
                                _id: User._id,
                                name: User.name,
                                image: User.image,
                            }
                        })
                    })
                })
            }).catch((err) => {
                res.json({ msg: err.message, code: 500 });
            })
        }
        else {
            res.redirect("/");
        }
    } catch (error) {
        console.log(error)
    }
})

app.get("/get-user", (req, res) => {
    try {
        if (req.session.userid) {
            user.findById(req.session.userid).then((user) => {
                // console.log(user);
                res.json({ msg: "Records have been fetched", user: user, code: 500 });
            })
        }
        else {
            // res.json({ msg: "Please login to perform this action", code: 300 });
            res.redirect("/");
        }
    } catch (error) {
        console.log(error);
    }
})

app.post("/read-notification", (req, res) => {
    try {
        if (req.session.userid) {
            user.updateOne({
                $and: [{
                    _id: req.session.userid
                },
                {
                    "notification._id": new ObjectId(req.body.notificationId)
                }]
            }, {
                $set: {
                    "notification.$.is_read": true
                }
            }).then(() => {
                return res.json({ msg: "Notification has been marked as read", code: 500 });
            }).catch((error) => {
                console.log(error);
            })
        }
        else {
            // res.json({ msg: "Please login to perform this action", code: 300 });
            res.redirect("/");
        }
    } catch (error) {
        console.log(error);
    }
})

app.post("/do-reply", (req, res) => {
    try {
        if (req.session.userid) {
            const { commentId, reply } = req.body;
            if (reply.trim() == "") {
                return res.json({ msg: "Please enter a reply", code: 300 })
            }
            user.findById(req.session.userid).then((existingUser) => {
                video.findOneAndUpdate({
                    "comments._id": new ObjectId(commentId)
                }, {
                    $push: {
                        "comments.$.replies": {
                            _id: new mongoose.Types.ObjectId(),
                            user: {
                                _id: existingUser._id,
                                name: existingUser.name,
                                image: existingUser.image
                            },
                            reply: reply,
                            createdAt: new Date().getTime()
                        }
                    }
                }).then((updatedVideo) => {
                    const videoWatch = updatedVideo.watch;
                    const comments = updatedVideo.comments;
                    for (var i = 0; i < comments.length; i++) {
                        if (comments[i]._id == commentId) {
                            user.findByIdAndUpdate(comments[i].user._id, { //sending notification to the commenter
                                $push: {
                                    notification: {
                                        _id: new mongoose.Types.ObjectId(),
                                        type: "new_reply",
                                        content: reply,
                                        is_read: false,
                                        video_watch: videoWatch,
                                        user: {
                                            id: existingUser._id,
                                            name: existingUser.name,
                                            image: existingUser.image
                                        }
                                    }
                                }
                            }).then(() => {
                                return res.json({
                                    msg: "Reply has been posted", code: 400, user: {
                                        _id: existingUser._id,
                                        name: existingUser.name,
                                        image: existingUser.image
                                    }
                                })
                            })
                            break;
                        }
                    }
                })
            })
        }
        else {
            // return res.json({ msg: "Please login to perform this operation", code: 500});
            res.redirect("/");
        }
    } catch (error) {
        console.log(error);
    }
})

app.post("/do-subscribe", (req, res) => {
    try {
        if (req.session.userid) {
            const { videoId } = req.body;
            video.findById(videoId).then((Video) => {
                if (req.session.userid == Video.user._id)
                    return res.json({ msg: "You can't subscribe to your own channel", code: 300 });
                else {
                    // checking whether channel is already subscribed or not
                    user.findById(req.session.userid).then((User) => {
                        const subscriptions = User.subscriptions;
                        var isSubscribed = false;
                        for (var i = 0; i < subscriptions.length; i++) {
                            if (subscriptions[i]._id == Video.user._id) {
                                isSubscribed = true;
                                break;
                            }
                        }
                        if (isSubscribed) {
                            return res.json({ msg: "You have already subscribed", code: 400 });
                        }
                        else {
                            user.findOneAndUpdate({ //incrementing subscriber count of the video publisher
                                _id: Video.user._id
                            }, {
                                $inc: {
                                    subscribers: 1
                                }
                            }, {
                                returnOriginal: false
                            }).then((updatedUser) => {
                                user.updateOne({
                                    _id: new ObjectId(req.session.userid)
                                }, {
                                    $push: {
                                        subscriptions: {
                                            _id: Video.user._id,
                                            name: Video.user.name,
                                            subscribers: updatedUser.subscribers,
                                            image: updatedUser.image
                                        }
                                    }
                                }).then((userData) => {
                                    video.updateMany({
                                        "user._id": Video.user._id
                                    }, {
                                        $inc: {
                                            "user.subscribers": 1
                                        }
                                    }).then(() => {
                                        return res.json({ msg: "Subscription has been added", code: 500 });
                                    })
                                })
                            })
                        }
                    })
                }
            })
        }
        else {
            // res.json({ msg: "Please login to perform this operation", code: 300 });
            res.redirect("/");
        }
    } catch (error) {
        console.log(error);
    }
})

app.listen(PORT, (err) => {
    if (err) console.log(err);
    else console.log("Server is running on PORT : " + PORT);
})