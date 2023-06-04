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
const mongoose = require("mongoose");
const user = require("./models/user.js");

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

app.get("/", (req, res) => {
    res.render("index", { isAuthenticated: req.session.userid ? true : false });
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
        const newUser = new user({ name, email, password: hashedPassword });
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

app.post("/upload-video", (req, res) => {
    if (req.session.userid) {
        const form = new formidable.IncomingForm();
        form.parse(req, (err, fields, files) => {
            if (err) {
                return res.json({ msg: "Error parsing form data", code: 500 });
            }

            // console.log(files.video.filepath, files.thumbnail.filepath, fields.title, fields.description, fields.tags, fields.category)
            const videoPath = files.video.filepath;
            const thumbnailPath = files.thumbnail.filepath;
            const title = fields.title;
            const description = fields.description;
            const tags = fields.tags;
            const category = fields.category;

            const newVideoPath = "static/videos/" + new Date().getTime() + "-" + files.video.newFilename;
            const newThumbnailPath = "static/thumbnails/" + new Date().getTime() + "-" + files.thumbnail.newFilename;
        })
    }
    else {
        res.redirect("/login");
    }
})

app.listen(PORT, (err) => {
    if (err) console.log(err);
    else console.log("Server is running on PORT : " + PORT);
})