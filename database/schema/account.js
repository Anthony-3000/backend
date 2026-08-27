import mongoose from "mongoose";

const AccountSchema = new mongoose.Schema({

    bakery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bakery",
        required: true
    },

    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },

    password: {
        type: String,
        required: true
    },

    // Only a hash of the one-time password-reset secret is stored.
    passwordResetSecretHash: String,

    passwordResetExpiresAt: Date,

    active: {
        type: Boolean,
        default: true
    },

    lastLogin: Date

}, {
    timestamps: true
});

export default mongoose.model("Account", AccountSchema);