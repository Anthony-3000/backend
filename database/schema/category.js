import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({

    bakery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bakery",
        required: true
    },

    name: {
        type: String,
        required: true
    },

    slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },

    image: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media"
    },

    tagline: {
        type: String
    },

    categoryBadges: [
        {
            name: String,
            color: String,
            icon: String
        }
    ],

    displayOrder: {
        type: Number,
        default: 0
    },

    active: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

export default mongoose.model("Category", CategorySchema);