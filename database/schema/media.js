import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema({

    bakery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bakery",
        required: true
    },

    type: {
        type: String,
        enum: ["image", "video"],
        required: true
    },

    url: {
        type: String,
        required: true
    },

    r2Key: {
        type: String,
        required: true
    },

    originalName: String,

    mimeType: String,

    size: Number,

    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account"
    }

}, {
    timestamps: true
});

export default mongoose.model("Media", MediaSchema);
