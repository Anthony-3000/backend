import mongoose from "mongoose";
import { IMAGE_MIME_TYPES, MAX_MEDIA_SIZE_BYTES, VIDEO_MIME_TYPES } from "../middleware/upload.middleware.js";

const validationError = (errors) => {
    const error = new Error("Validation failed");
    error.statusCode = 400;
    error.errors = errors;
    return error;
};

export const validateMediaUpload = (req, res, next) => {
    try {
        const file = req.file;

        if (!file) throw validationError(["file is required"]);
        if (file.size > MAX_MEDIA_SIZE_BYTES) throw validationError(["File must not exceed 25MB"]);

        if (!IMAGE_MIME_TYPES.has(file.mimetype) && !VIDEO_MIME_TYPES.has(file.mimetype)) {
            throw validationError(["Unsupported file type"]);
        }

        next();
    } catch (error) {
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || "Validation failed",
            errors: error.errors || []
        });
    }
};

export const validateMediaId = (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid media id",
            errors: ["id must be a valid MongoDB ObjectId"]
        });
    }

    next();
};

export const validateMediaList = (req, res, next) => {
    const { page = "1", limit = "20", type } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const errors = [];

    if (!Number.isInteger(pageNumber) || pageNumber < 1) errors.push("page must be a positive integer");
    if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) errors.push("limit must be an integer between 1 and 100");
    if (type && !["image", "video"].includes(type)) errors.push("type must be image or video");

    if (errors.length) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    req.mediaQuery = { page: pageNumber, limit: limitNumber, type };
    next();
};
