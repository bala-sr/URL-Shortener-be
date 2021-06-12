import mongoose from "mongoose";

const ShortUrlSchema = mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    fullUrl: {
        type: String,
        required: true
    },
    shortUrl: {
        type: String,
        required: true,
    },
    clicks: {
        type: Number,
        required: true,
        default: 0
    }
});

export const ShortUrl = mongoose.model("Url", ShortUrlSchema)