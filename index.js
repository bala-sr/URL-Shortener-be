import Express from "express";
import cors from "cors";
import mongodb from "mongodb";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import {User} from "./models/UsersCredentials.js"
import jwt from "jsonwebtoken";
import {ShortUrl} from "./models/ShortUrl.js";
import shortid from "shortid";
import nodemailer from "nodemailer";
import auth from "./middleware/auth.js";

const MongoClient = mongodb.MongoClient;
const app = Express();
dotenv.config();

const port = process.env.PORT || 3000;
const mongoClient = mongodb.MongoClient;
// const objectId = mongodb.ObjectID;
const dbUrl = process.env.DBUrl || "mongodb://127.0.0.1:27017";

//Connecting to MongoDB
// mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true  });
// const con = mongoose.connection;

// con.on("open", () => {
//     console.log("MongoDB connected");
// })

app.use(cors());
app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.send("Url is working");
})

app.get("/homepage", async (req, res) => {
    const shortUrl = await ShortUrl.find();
    res.send("Homepage", { shortUrl: shortUrl});
})

//-----Signup new user-----//
app.post("/signup", async (req, res) => {
    
    let email = req.body.email;
    let password = req.body.password;
    try {
        const client = await mongoClient.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true});
        let db = client.db("UrlShortener");
        let salt = await bcrypt.genSalt(10);
        //Hashing password
        let hashedPassword = await bcrypt.hash(password, salt);
    
        console.log("email = " + email);
        console.log("password = " + password);
        console.log("hashed password = " + hashedPassword);
        
        //Saving New User data into DB
        let user = new User({
            "email": email,
            "password": hashedPassword
        });
        
        //Checking if the email id exist already in DB
        let checkUser = await db.collection("users").find({
            email: email}).count();
        
        console.log("Check User: ", checkUser);
        if(checkUser) {
            res.status(201).json({message: "Email already exists"});
        }
        else {
            //Inserting data into DB
            let newUser = await db.collection("users").insertOne(user);

            if(!newUser) {
                res.status(202).json({message: "Unable to signup"});
            }
            else {
                console.log("New user signed up:", newUser.ops[0].email);
                res.status(200).send("Sign up successful");
                client.close();
            }                
        } 
    }
        
    catch(err) {
        console.log("Error: ", err);
        res.status(300).send(err);
    }
})

//Checking Login credentials of the user
app.post("/login", async(req, res) => {
    // let client = await mongoClient.connect(dbUrl);
    const client = await mongoClient.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true});
    let db = client.db("UrlShortener");
    const UserEmail = req.body.email;
    const UserPassword = req.body.password;
    let user = await db.collection("users").findOne({ email: UserEmail });
    console.log("Email given: " + UserEmail);

    if(!user) {
        return res.status(400).json({
            message: "User does not exist"
        });
    }
    else {
        let token = jwt.sign({
            data: user._id
        }, process.env.JWT_TOKEN_KEY, { expiresIn: "1h"});
        const isMatch = await bcrypt.compare(UserPassword, user.password);
        if(isMatch) {
            return res.status(200).json({ message: "User logged in successfully", token, UserEmail });
        }
        else {
            return res.status(400).json({
                message: "Incorrect password"
            });
        }
    }
});

//Forgot password
app.post("/forgotPassword", async(req, res) => {
    const client = await mongoClient.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true});
    let db = client.db("UrlShortener");
    const UserEmail = req.body.email;
    const OldPassword = req.body.oldPassword;
    const NewPassword = req.body.newPassword;
    // console.log("UserEmail = ", UserEmail);
    // console.log("OldPassword = ", OldPassword);
    // console.log("NewPassword = ", NewPassword);

    //Check if email exist
    let user = await db.collection("users").findOne({ email: UserEmail });
    // console.log("Email given: " + UserEmail);

    if(!user) {
        return res.status(400).json({
            message: "User does not exist"
        });
    }
    else {
        const isMatch = await bcrypt.compare(OldPassword, user.password);
        if(isMatch) {
            console.log("Password matches");
            let salt = await bcrypt.genSalt(10);
            //Hashing password
            let hashedPassword = await bcrypt.hash(NewPassword, salt);
            console.log(NewPassword);
            console.log(hashedPassword);
            await db.collection("users").updateOne({
                "email": UserEmail
            },
            {
                $set: {"password": hashedPassword}
            })
            return res.status(200).json({message: "Password reset successful!"});
        }
        else {
            return res.status(202).json({message: "Password is wrong"});
        }
    }
})

//-----Shorten URL-----//
app.post("/shortenUrl", auth, async (req, res) => {
    // let url = req.longUrl;
    // await ShortUrl.create({
    //     email: req.body.email, 
    //     fullUrl: req.body.url
    // });
    // res.redirect("/");
    let longUrl = req.body.longUrl;
    let email = req.body.email;
    let shortUrl = shortid.generate();

    console.log("longurl = " + longUrl);
    console.log("email = " + email);
    console.log("shorturl = " + shortUrl);

    //Saving the Url details into DB
    let url = new ShortUrl({
        "email": email,
        "fullUrl": longUrl,
        "shortUrl": shortUrl,
        "clicks": 0
    });
    try {
        let client = await MongoClient.connect(dbUrl);
        let db = client.db("UrlShortener");
        let insertedUrl = await db.collection("urls").insertOne({
            "email": email,
            "fullUrl": longUrl,
            "shortUrl": shortUrl,
            "clicks": 0
        });
        // const newUrl = await url.save();
        console.log("Url inserted successfully");
        res.status(200).json({"message": "Url inserted", "shortUrl": shortUrl, "longUrl": longUrl});
        client.close();
    }
    catch(err) {
        console.log(err);
        res.send(err);
    }

})

//-----Retrieve URLs of a user-----//
app.get("/getUrl/:email", async(req, res) => {
    let email = req.params.email;

    try {
        let client = await MongoClient.connect(dbUrl);
        let db = client.db("UrlShortener");
        let allUrls = await db.collection("urls").find({
            "email": email
        }).toArray();
        client.close();
        console.log("URLs retrieved for the user");
        res.status(200).send(allUrls);
    }
    catch(err) {
        res.status(400).send(err);
    }
});

app.listen(port, () => console.log("App started"));
