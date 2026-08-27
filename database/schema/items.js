import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({

    bakery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bakery",
        required: true
    },

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
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

    description: String,

    price: {
        type: Number,
        required: true
    },

    media: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media"
    }],

    badges: [{
        name: String,
        color: String,
        icon: String
    }],

    details: [{
        type: String
    }],

    weight: String,

    outOfStock: {
        type: Boolean,
        default: false
    },

    hidden: {
        type: Boolean,
        default: false
    },

    displayOrder: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});

export default mongoose.model("Item", ItemSchema);