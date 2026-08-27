import mongoose from "mongoose";

const BakerySchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    tagline: String, 

    description: String,
    
    establishedYear: Number,
    
    logo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media"
    },

    coverImages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media"
    }],
    coverVideo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media"
    }],

    locations: [{
        address: String
    }],

    social: {
        instagram: String,
        whatsapp: String
    },

    contact: {
        phone: String,
        email: String
    },

    fssaiLicenseNo: {
        type: String,
        trim: true
    },

    active: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

export default mongoose.model("Bakery", BakerySchema);