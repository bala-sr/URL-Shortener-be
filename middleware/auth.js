import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export default function (req, res, next) {
    let token = req.header("Authorization");

    if(!token) {
        res.send(401).json({message: "Authentication failed"});
    }

    jwt.verify(token, process.env.JWT_TOKEN_KEY, (err, decoded) => {
        if(err) {
            res.send(500).json({message: "Authentication failed"});
        }
        else {
            res.userId = decoded.id;
            // console.log(decoded);   
            next(); 
        }

    });    
}

