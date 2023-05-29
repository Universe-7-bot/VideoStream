const express = require("express");
const app = express();
const bodyParser = require("body-parser"); //handling http post requests
const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const user = require("./models/user.js");

mongoose.set('strictQuery', false);
mongoose.connect(process.env.DB_URL).then(() => {
    console.log("Connected with database");
}).catch((err) => {
    console.log(err);
})

app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/static"));
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.render("index");
})

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/signup", (req, res) => {
    res.render("signup");
})

app.listen(PORT, (err) => {
    if (err) console.log(err);
    else console.log("Server is running on PORT : " + PORT);
})